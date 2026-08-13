#!/usr/bin/env node
const { execFileSync } = require("child_process");

const bannedPatterns = [
  /^\.DS_Store$/,
  /\/\.DS_Store$/,
  /^packages\/server\/coverage\//,
  /^packages\/server\/uploads\//,
  /^packages\/server\/reports\//,
  /^packages\/server\/certificates\//,
  /^packages\/server\/mushaf-pages\//,
];

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const offenders = trackedFiles.filter((file) =>
  bannedPatterns.some((pattern) => pattern.test(file)),
);

if (offenders.length) {
  console.error(
    "check-repo-hygiene: generated/runtime files are tracked in git:",
  );
  for (const file of offenders) console.error(`- ${file}`);
  console.error(
    "\nRemove them from the index with git rm --cached and keep them ignored.",
  );
  process.exit(1);
}

console.log(
  `check-repo-hygiene: OK (${trackedFiles.length} tracked files scanned)`,
);
