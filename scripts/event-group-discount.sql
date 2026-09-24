-- ============================================================
-- كواليس (Kawalees) — دعم خصم الشلة (Group Discount) للعروض
-- شغّل مرة واحدة على قاعدة البيانات (Postgres).
-- ============================================================

alter table if exists public.events
  add column if not exists has_group_discount boolean not null default false;
