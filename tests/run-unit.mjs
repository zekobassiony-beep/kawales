// Discovers `tests/unit/**/*.test.ts` and hands the explicit file list to
// Node's built-in test runner (which does not expand globs reliably on Windows).
import { readdirSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..")

function collect(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collect(full))
    else if (entry.name.endsWith(".test.ts")) files.push(full)
  }
  return files.sort()
}

const testFiles = collect(path.join(root, "tests", "unit"))

if (testFiles.length === 0) {
  console.error("No test files found under tests/unit")
  process.exit(1)
}

console.log(`Running ${testFiles.length} unit test file(s):\n`)

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./tests/register-hooks.mjs",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--test",
    "--test-reporter=spec",
    ...testFiles,
  ],
  { cwd: root, stdio: "inherit" },
)

process.exit(result.status ?? 1)
