-- ============================================================
-- كواليس (Kawalees) — جدول التذاكر على Supabase (Postgres)
-- ------------------------------------------------------------
-- ملاحظة: الجدول موجود بالفعل في مشروع Supabase بالأعمدة التالية.
-- هذا الملف توثيقي/مرجعي (في حال إنشاء بيئة جديدة).
-- ============================================================

create table if not exists public.tickets (
  id           text primary key,                     -- مرجع التذكرة KW-XXXXXX
  show_id      text not null default '',             -- معرّف العرض
  user_id      text,                                 -- بريد العميل (CustomerID في المنصة)
  sender_phone text,                                 -- رقم الموبايل المحوَّل منه
  receipt_url  text,                                 -- رابط/Base64 لصورة الإيصال
  status       text not null default 'pending',      -- pending | approved | rejected | checked_in
  total_price  integer not null default 0,           -- الإجمالي بالقروش (piastres)
  seats        jsonb not null default '[]'::jsonb,   -- مصفوفة المقاعد
  created_at   timestamptz not null default now()
);

create index if not exists tickets_user_id_idx on public.tickets (user_id);
create index if not exists tickets_status_idx on public.tickets (status);

-- الكتابة تتم عبر مفتاح service_role (يتجاوز RLS)، والقراءة العامة عبر anon.
alter table public.tickets enable row level security;

drop policy if exists "allow public read tickets" on public.tickets;
create policy "allow public read tickets"
  on public.tickets for select
  using (true);

