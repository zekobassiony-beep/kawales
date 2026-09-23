-- ============================================================
-- كواليس (Kawalees) — إضافة رابط Google Maps لجدول المسارح
-- شغّل مرة واحدة على قاعدة البيانات (Postgres):
--   psql "$DATABASE_URL" -f scripts/venue-google-maps.sql
-- أو عبر Supabase SQL Editor / أي عميل Postgres.
-- ============================================================

alter table if exists public.venues
  add column if not exists google_maps_url text;

comment on column public.venues.google_maps_url is
  'رابط اللوكيشن المباشر من Google Maps — يُدخله مدير المسرح من لوحته، ويظهر كزر «افتح في خريطة» في صفحة العرض.';
