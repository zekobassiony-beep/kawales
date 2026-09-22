// Entry point for `node --import ./tests/register-hooks.mjs`.
// Registers the `@/` + extension-less resolver and enables Node's built-in
// TypeScript type stripping for the test run.
import { register } from "node:module"

register("./alias-loader.mjs", import.meta.url)
