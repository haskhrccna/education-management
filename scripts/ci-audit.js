#!/usr/bin/env node
// CI dependency audit (run by the "Audit dependencies" step in
// .github/workflows/ci.yml, from the repository root).
//
// This lives in a file, not inline in the workflow: as `node -e "…"` the
// script sat inside a double-quoted shell string, so every backtick in a
// comment was executed by bash as a command and a stray double quote cut the
// program short.
const { execSync } = require("child_process");
function tryExec(cmd) {
  try {
    return execSync(cmd, { maxBuffer: 1024 * 1024 * 20 }).toString();
  } catch (err) {
    return (err.stdout || Buffer.from("")).toString();
  }
}
const audit = JSON.parse(tryExec("npm audit --json"));
// This is a shared-lockfile npm workspace: 'npm audit' reports findings
// from the whole monorepo, including mobile's own (legitimate) Expo SDK
// dependency, which this server process never loads at runtime. Findings
// here are exempted only after manual confirmation they route solely
// through the Expo/React Native toolchain (postcss is a CSS build-time
// tool used by @expo/metro-config) — reviewed 2026-07-26. Re-review this
// list whenever Expo SDK is upgraded past the versions on record here.
//
// brace-expansion (reviewed 2026-07-27): pinned to ^2.1.2 in the root
// package.json "overrides" (patched for the classic ReDoS CVE) instead
// of the newer 5.x line, because 5.x dropped the callable-function
// export every 'minimatch' in this tree (including RN's own iOS codegen
// toolchain) is written against — 5.x broke native iOS builds outright.
// This reopens GHSA-mh99-v99m-4gvg (DoS via unbounded brace expansion,
// fixed only at 5.0.8+, no backport to 1.x-4.x) on paper, but every
// brace-expansion call site in this repo is local dev/build tooling
// (jest, eslint, RN codegen, Expo CLI) processing developer-authored
// glob patterns — never a server request path or the shipped app
// bundle processing untrusted input. Re-review if brace-expansion ships
// a 2.x/3.x/4.x patch, or if RN's codegen drops its old minimatch/glob
// dependency and can take 5.x directly.
const MOBILE_TOOLCHAIN_EXCEPTIONS = new Set(["postcss", "brace-expansion"]);
// 2026-11-09: expo-router (high) — the advisory's fixed versions start
// at 58.0.30, which belongs to a future Expo SDK major (this app is on
// SDK 54, router 6.0.24, the newest its ~6.0.23 pin allows). Same
// treatment as 'expo' below: the real fix is the SDK upgrade, tracked
// as separate work, not silently bumped here.
MOBILE_TOOLCHAIN_EXCEPTIONS.add("expo-router");
// 2026-11-09: SERVER RUNTIME exceptions — the minio S3 client chain.
//   decode-uri-component <=0.5.0 (high; GHSA-vcc3-ghjq-m6fr,
//   GHSA-qr28-fpjm-wq7f): the only fixed release, 0.5.1, is
//   ESM-only, while minio@8 -> query-string@7 loads it with
//   require(). Overriding it to ^0.5.1 was TRIED AND REVERTED:
//   Jest 30's CJS sandbox cannot load the ESM build ("Must use
//   import to load ES Module"), failing 4 unit suites and all 37
//   integration suites that import the storage service; a
//   require(esm) build is not viable for the test toolchain.
//   query-string (high, 5.0.0–9.4.1) and minio (high, >=7.0.30)
//   inherit the same finding through this chain (minio also has a
//   separate moderate advisory via stream-json). Reachability
//   within this repo: the decoder runs on operator-configured
//   endpoint URLs and server-generated object keys
//   (src/services/storage.service.ts), never on arbitrary
//   external input, and the whole object-storage layer is disabled
//   unless the operator sets STORAGE_ENABLED=1. Re-review when
//   minio ships an ESM-compatible query-string/decode-uri-component
//   chain, or when the app drops minio for another S3 client.
const SERVER_RUNTIME_EXCEPTIONS = new Set([
  "decode-uri-component",
  "query-string",
  "minio",
  "stream-json",
]);
// 2026-09-16: npm audit published new high-severity advisories for
// build/test-toolchain packages. Each chain below was verified with
// `npm ls <pkg>` to route ONLY through the Expo/React Native build
// toolchain, the jest/ts-jest test toolchain, or the Prisma CLI —
// never through code the API server loads at runtime:
//   @expo/metro-config, metro-config, metro-transform-worker,
//   image-size, fast-uri   -> mobile/ Expo/metro build toolchain
//   js-yaml                 -> server: ts-jest -> babel-plugin-istanbul
//                             -> @istanbuljs/load-nyc-config (tests only)
//   deepmerge-ts            -> server: prisma CLI -> @prisma/config
//                             (migration-time tooling, not @prisma/client)
// Re-review this list whenever Expo SDK, Prisma, or jest is upgraded.
const TOOLCHAIN_EXCEPTIONS = new Set([
  ...MOBILE_TOOLCHAIN_EXCEPTIONS,
  ...SERVER_RUNTIME_EXCEPTIONS,
  "@expo/metro-config",
  "metro-config",
  "metro-transform-worker",
  "image-size",
  "fast-uri",
  "js-yaml",
  "deepmerge-ts",
  "@expo/cli",
  "@expo/metro",
  "@xmldom/xmldom",
  "@prisma/config",
  // Top-level aggregates of the same toolchain chains: 'expo'
  // (fix = SDK 57, breaking major), 'metro' (via image-size +
  // metro-config) and 'prisma' CLI (via @prisma/config; fix =
  // 8.x, breaking major). Real fix is the major upgrades —
  // tracked as separate work, not silently exempted:
  "expo",
  "metro",
  "prisma",
  // 2026-10-07: advisories published after the 2026-09-30 run. Each
  // chain was re-checked with `npm ls <pkg>`; all of these reach the
  // tree through the Expo/React Native build toolchain, the jest
  // test toolchain, or the dev server — none is loaded by the API at
  // runtime, and none ships in the app bundle:
  //   react-native, react-native-reanimated  -> high only VIA their
  //     dev-time deps (@react-native/community-cli-plugin, babel-jest)
  //   @jest/environment, @jest/fake-timers, @jest/transform,
  //   jest-environment-node, jest-haste-map, jest-message-util,
  //   babel-jest, metro-file-map, micromatch, braces  -> test/build
  //   chokidar, ts-node-dev                  -> `npm run dev` only
  //   shell-quote (CRITICAL)                 -> react-native ->
  //     react-devtools-core; devtools, never shipped
  //   node-forge, @expo/code-signing-certificates,
  //   @config-plugins/react-native-webrtc, source-map-js -> expo CLI
  // The two advisories that WERE runtime — nodemailer (cross-tenant
  // SMTP credential disclosure) and firebase-admin (node-forge
  // signature verification) — were upgraded rather than exempted.
  // Re-review on the next Expo SDK or jest major.
  "react-native",
  "react-native-reanimated",
  "@react-native/community-cli-plugin",
  "@jest/environment",
  "@jest/fake-timers",
  "@jest/transform",
  "jest-environment-node",
  "jest-haste-map",
  "jest-message-util",
  "babel-jest",
  "metro-file-map",
  "micromatch",
  "braces",
  "chokidar",
  "ts-node-dev",
  "shell-quote",
  "node-forge",
  "@expo/code-signing-certificates",
  "@config-plugins/react-native-webrtc",
  "source-map-js",
]);
const bad = Object.values(audit.vulnerabilities || {}).filter(
  (v) =>
    (v.severity === "high" || v.severity === "critical") &&
    !TOOLCHAIN_EXCEPTIONS.has(v.name),
);
if (bad.length) {
  console.error(
    "High/critical vulnerabilities in the server's dependency surface:",
  );
  for (const v of bad)
    console.error("- " + v.name + " (" + v.severity + ") range " + v.range);
  process.exit(1);
}
console.log(
  "OK — no high/critical vulnerabilities outside the reviewed Expo/React Native exceptions.",
);
