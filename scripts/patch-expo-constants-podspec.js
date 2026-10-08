#!/usr/bin/env node
/**
 * Quote the checkout path in expo-constants' Xcode build phase.
 *
 * node_modules/expo-constants/ios/EXConstants.podspec generates this build
 * phase for the EXConstants pod:
 *
 *     bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"
 *
 * Xcode's shell expands $PODS_TARGET_SRCROOT into that string, and `bash -c`
 * then re-parses the whole string as a command line. A space anywhere in the
 * checkout path is therefore a word boundary. Cloned into
 * "~/Documents/Github projects/education-managment", the build runs
 * "/Users/haskhr/Documents/Github" and dies before compiling anything:
 *
 *     Script '[CP-User] Generate app.config for prebuilt Constants.manifest' failed
 *     No such file or directory: /Users/haskhr/Documents/Github
 *
 * Nothing in that message mentions the path, and `expo prebuild` regenerates
 * the Pods project from the podspec every time, so the fix has to live here.
 * Single-quoting the expansion makes it one word again. The PROJECT_ROOT
 * assignment one line up has the same hole and is quoted too.
 *
 * expo-constants is the only podspec in the dependency tree with this pattern,
 * so one patch covers the build.
 *
 * Idempotent and self-retiring: it no-ops when the text is already quoted, when
 * upstream rewrites the line, and when the package isn't installed. Run from
 * the root `postinstall`, because npm restores the unpatched file on install.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const candidates = [
  path.join(root, 'node_modules/expo-constants/ios/EXConstants.podspec'),
  path.join(root, 'mobile/node_modules/expo-constants/ios/EXConstants.podspec'),
];

const edits = [
  {
    from: '"bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\""',
    to: '"bash -l -c \\"#{env_vars}\'$PODS_TARGET_SRCROOT\'/../scripts/get-app-config-ios.sh\\""',
  },
  {
    from: '"PROJECT_ROOT=#{ENV[\'PROJECT_ROOT\']} "',
    to: '"PROJECT_ROOT=\'#{ENV[\'PROJECT_ROOT\']}\' "',
  },
];

let patched = 0;
let alreadyOk = 0;

for (const file of candidates) {
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const { from, to } of edits) {
    if (after.includes(from)) after = after.replace(from, to);
  }
  if (after === before) {
    if (before.includes("'$PODS_TARGET_SRCROOT'")) alreadyOk++;
    continue;
  }
  fs.writeFileSync(file, after);
  patched++;
  console.log(`[patch-expo-constants] quoted the project path in ${path.relative(root, file)}`);
}

if (patched === 0 && alreadyOk === 0) {
  // Not installed, or upstream changed the line. Either way, not our problem to
  // force — a build failure will be louder and more accurate than a guess here.
  console.log('[patch-expo-constants] nothing to patch (package absent or upstream changed)');
}
