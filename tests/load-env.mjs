// Shared helper so every standalone script (probe, cleanup, integration)
// resolves the project root and reads `.env.local` the same way.
import { readFileSync } from "node:fs"
import path from "node:path"

export const projectRoot = path.resolve(import.meta.dirname, "..")

export function loadEnvLocal() {
  const env = {}
  for (const file of [".env.local", "app/.env.local"]) {
    try {
      const contents = readFileSync(path.join(projectRoot, file), "utf8")
      for (const line of contents.split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (match) env[match[1]] = match[2].replace(/^"(.*)"$/, "$1")
      }
    } catch {
      // file missing – keep going
    }
  }
  return env
}

/** Telegram credentials for standalone scripts (same keys Next reads). */
export function resolveTelegramConfig() {
  const env = loadEnvLocal()
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_ADMIN_CHAT_ID || "",
  }
}

/** Same precedence as `lib/db/index.ts`: DATABASE_URL then POSTGRES_URL. */
export function resolveConnectionString() {
  const env = loadEnvLocal()
  return process.env.DATABASE_URL || env.DATABASE_URL || process.env.POSTGRES_URL || env.POSTGRES_URL || ""
}
