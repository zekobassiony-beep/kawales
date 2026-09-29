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
    // ⚠️ حوض صغير مقصود: كل نسخة دالة في الاستضافة تفتح حوضًا خاصًا بها،
    // والحجم الافتراضي (10) يستهلك حد الاتصالات في قاعدة البيانات بسرعة
    // (٦ نسخ متزامنة = ٦٠ اتصالًا). واحد لكل نسخة هو النمط الصحيح للاستضافة
    // بلا خادم، ويمكن رفعه بمتغيّر البيئة عند التشغيل على خادم ثابت.
    max: Math.max(1, Number(process.env.PG_POOL_MAX ?? 1) || 1),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
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
  // بدون مستمع للأخطاء، أي عميل خامل يخطئ (انقطاع شبكة/إغلاق الخادم للاتصال)
  // يُسقط العملية بالكامل. هنا نسجّله ونترك الحوض يُنشئ اتصالًا جديدًا.
  globalForDb.pool.on("error", (error) => {
    console.error(`[db] خطأ في اتصال خامل — سيُعاد إنشاء الاتصال تلقائيًا: ${error.message}`)
  })
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
