"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * عميل Supabase للمتصفح بمفتاح `anon` — للقراءة فقط ضمن سياسات RLS.
 * يُنشأ مرة واحدة (singleton) لتجنّب إعادة إنشاء العميل في كل استدعاء.
 */
let browserClient: SupabaseClient | null | undefined

export function getSupabaseBrowser(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient
  if (!isSupabaseConfigured()) {
    browserClient = null
    return null
  }
  browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return browserClient
}
