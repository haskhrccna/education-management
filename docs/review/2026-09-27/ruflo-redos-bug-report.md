# `analyze circular`/`modules`/`boundaries`/`dependencies` hang forever (ReDoS) on files whose text contains "import" without a following `from '...'`

## Summary

`ruflo analyze circular`, `modules`, `boundaries`, and `dependencies` can hang indefinitely (100% CPU, no timeout, no error) when scanning a directory that contains a source file with the literal word `import` anywhere in it — in a comment, a string, JSDoc prose, anything — that isn't immediately followed by a well-formed `from '...'` clause. This is a classic ReDoS (catastrophic regex backtracking), not a slow-but-working case: a single ~80-character string reproduces a hang lasting 15+ seconds with no upper bound observed.

## Environment

- `ruflo` / `@claude-flow/cli`: v3.46.1
- Node.js: v22.23.2
- OS: Linux

## Root cause

`extractImports()` in `v3/@claude-flow/cli/src/ruvector/graph-analyzer.js` uses:

```js
const esImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s*['"]([^'"]+)['"]/g;
```

The nested quantifier `(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*` has exponentially many ways to partition a run of word-like tokens between its repeated alternation and the optional `\s*,?\s*` separator. When the text after `import\s+` is *not* a real import clause (no `from '...'` ever arrives), the engine has to exhaust all of those partitions before failing the match — and that count grows exponentially with the number of words.

This function is called by `buildDependencyGraph()` → `processFile()` for every scanned file, which backs all four `analyze` subcommands that need the import graph (`circular`, `modules`, `boundaries`, `dependencies`). `analyze complexity` is unaffected since it doesn't parse imports.

## Minimal reproduction

No file I/O needed — this is purely in the regex engine:

```js
// repro.mjs
const re = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s*['"]([^'"]+)['"]/g;
const s = "import instead of separately wiring the settings store, getColors, and useIsRTL.";
console.log('input length:', s.length); // 80
re.exec(s); // never returns
```

```
$ timeout 15 node repro.mjs
input length: 80
$ echo $?
124   # killed by timeout, still running
```

### Reproduction in the wild

Any real source file containing a sentence like this in a comment triggers it:

```ts
/**
 * ...so screens need a single
 * import instead of separately wiring the settings store, getColors, and
 * useIsRTL.
 */
```

We hit this in a real file (`useTheme.ts`) whose JSDoc happened to contain the word "import" in ordinary prose. Running `ruflo analyze circular <dir>` on a directory containing that one file hangs the whole scan indefinitely; the other 4 checks that call `buildDependencyGraph` (`modules`, `boundaries`, `dependencies`) hang the same way.

## Suggested fix

Strip comments (and arguably string/template literal contents) from the file content before running the import/export extraction regexes — comments can't contain real import statements, so there's nothing to lose:

```js
function stripComments(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}
```

This fixes the JSDoc/comment case, but the underlying regex is still ReDoS-prone for any *non-comment* text that starts with `import` and doesn't resolve into `from '...'` (e.g. inside a string literal, or just malformed/incomplete code mid-edit). A more robust fix would replace the nested-quantifier pattern with either:
- an atomic-group / possessive-quantifier equivalent (not natively supported by JS regex, would need a manual non-backtracking scanner), or
- a linear-time hand-written parser for the import clause instead of one monolithic regex, or
- a per-`exec()` timeout/budget (e.g. run via a worker thread with `Atomics.wait`-based cancellation) so a pathological file degrades to "skipped" instead of hanging the whole CLI run.

We worked around this locally by patching `extractImports()` to strip comments first (option 1 above), which fixed our case, but the general regex is still unsafe against adversarial or coincidental non-comment input.

## Impact

Any codebase where a comment (or, as shown, potentially other text) contains the bare word "import" not part of a real import statement will silently hang `analyze circular/modules/boundaries/dependencies` with no error, no timeout, and no indication of which file is responsible — it just spins at 100% CPU forever. This is easy to trigger accidentally (English prose commonly uses "import" as a regular word) and does not require any malicious intent.

---

# Second, unrelated bug: `security scan -o json`/`-o sarif` silently ignored

## Summary

`ruflo security scan` declares an `-o, --output` option documented as "Output format: text, json, sarif", but `scanCommand`'s `action` in `v3/@claude-flow/cli/src/commands/security.js` never reads `ctx.flags.output` anywhere. Regardless of `-o json` or `-o sarif`, the command always prints the same human-readable ASCII table. Piping that to a `.json` or `.sarif` file produces a file with that extension containing plain text, not valid JSON/SARIF — this will silently break any downstream tooling that expects to parse the output.

(`security secrets`'s own `-o/--output` flag, by contrast, is correctly wired — this bug is specific to the `scan` subcommand.)

## Reproduction

```
$ ruflo security scan -t . --type code -o json | head -3
Security Scan
──────────────────────────────────────────────────
Scan complete
```

Same result with `--output json`, `-o=json`, or `-o sarif` — the flag value is never consulted.

## Root cause

`scanCommand.options` declares `{ name: 'output', short: 'o', ... }` (line 54), but the `action` function builds up a `findings` array (with severities baked in as ANSI-colored strings via `output.warning('HIGH')` etc.) and unconditionally renders it with `output.printTable(...)` / `output.printBox(...)`. `ctx.flags.output` is dead: parsed by the option definition, never referenced by the handler.

## Local workaround

We patched our local install to add:
1. A `rawSeverity` field (plain string, alongside the existing colored `severity`) on each of the three `findings.push(...)` call sites.
2. A check on `ctx.flags.output === 'json'` immediately after `spinner.succeed(...)`/`spinner.stop()` that, when true, suppresses the banner/table/box and instead prints `JSON.stringify({ target, depth, type, summary, findings }, null, 2)` using the plain `rawSeverity`.
3. Gated the leading `output.writeln(output.bold('Security Scan')); ...` banner and the spinner's success message so they don't precede the JSON on stdout (otherwise the output isn't valid JSON even after fixing the format branch — the banner text is still there).

We did **not** implement real SARIF (`-o sarif` still falls through to text) — SARIF is a large, formal schema (runs/tool/rules/results) that felt like overkill for what was actually needed (machine-readable JSON), but a maintainer fixing this upstream should decide whether to support it too or make `-o sarif` explicitly error out with "not yet implemented" instead of silently no-op'ing.

## Impact

Anyone piping `security scan -o json` (or `sarif`) into a file for CI/tooling consumption gets a text file with the right extension and wrong content, with no error to indicate the format request was ignored.
