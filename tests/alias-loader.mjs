// Minimal ESM resolve hook so the project's `@/*` path alias and extension-less
// relative imports work when files are run directly with plain Node (no bundler).
//
// Used by `tests/register-hooks.mjs` and therefore by `npm test`.
import { statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// tests/ -> project root
const root = path.resolve(import.meta.dirname, "..")

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx", ".json"]

function isFile(candidate) {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function firstExisting(base) {
  if (isFile(base)) return base
  for (const ext of EXTENSIONS) {
    if (isFile(base + ext)) return base + ext
  }
  for (const ext of EXTENSIONS) {
    const indexFile = path.join(base, `index${ext}`)
    if (isFile(indexFile)) return indexFile
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  let base = null

  if (specifier.startsWith("@/")) {
    base = path.join(root, specifier.slice(2))
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    if (context.parentURL?.startsWith("file:")) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    }
  } else if (path.isAbsolute(specifier)) {
    base = specifier
  }

  if (base) {
    const hit = firstExisting(base)
    if (hit) return nextResolve(pathToFileURL(hit).href, context)
  }

  return nextResolve(specifier, context)
}
