/**
 * lint-staged appends the staged file paths to every command it runs, which
 * is wrong for a whole-project typecheck (`tsc -p` refuses to be mixed with
 * file arguments). A function entry returns the exact command to run instead,
 * so the typecheck sees the workspace tsconfig and nothing else.
 *
 * This config used to live in package.json as
 * `cd packages/server && npx tsc --noEmit`, which lint-staged v16 could never
 * run at all — it spawns commands without a shell, so every commit touching
 * server code failed the hook with ENOENT.
 */
module.exports = {
  'packages/server/src/**/*.ts': (files) => [
    `prettier --write ${files.map((f) => JSON.stringify(f)).join(' ')}`,
    'tsc --noEmit -p packages/server/tsconfig.json',
  ],
  'packages/shared/src/**/*.ts': 'prettier --write',
  'mobile/src/**/*.{ts,tsx}': 'prettier --write',
  'mobile/app/**/*.{ts,tsx}': 'prettier --write',
};
