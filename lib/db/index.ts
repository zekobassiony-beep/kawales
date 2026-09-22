import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

type DbGlobal = {
  pool?: Pool
  db?: ReturnType<typeof drizzle<typeof schema>>
  connectionString?: string
}

const globalForDb = globalThis as unknown as DbGlobal

export function getConnectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || ""
}

function createPool(connectionString: string) {
  return new Pool({
    connectionString: connectionString || undefined,
    ssl:
      connectionString && /sslmode=require/i.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
  })
}

function getOrCreatePool() {
  const connectionString = getConnectionString()
  if (globalForDb.pool && globalForDb.connectionString === connectionString) {
    return globalForDb.pool
  }

  if (globalForDb.pool) {
    void globalForDb.pool.end().catch(() => {})
  }

  globalForDb.connectionString = connectionString
  globalForDb.pool = createPool(connectionString)
  globalForDb.db = drizzle(globalForDb.pool, { schema })
  return globalForDb.pool
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const actual = getOrCreatePool()
    const value = Reflect.get(actual, prop, actual)
    return typeof value === "function" ? value.bind(actual) : value
  },
})

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    getOrCreatePool()
    const actual = globalForDb.db!
    const value = Reflect.get(actual, prop, actual)
    return typeof value === "function" ? value.bind(actual) : value
  },
})
