-- ============================================================
-- كواليس (Kawalees) — جدول الأدمنز على Supabase (Postgres)
-- شغّل هذا الملف مرة واحدة من SQL Editor في مشروع Supabase:
--   https://supabase.com/dashboard/project/yvixrtlonpubbjxhprld/sql/new
-- (لا يمكن إنشاء الجداول عبر مفاتيح الـ API، لذا هذه الخطوة يدوية مرة واحدة)
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- قراءة عامة (يستعملها الوسيط `middleware.ts` بمفتاح anon للتحقق من البريد)،
-- والكتابة/الحذف تتم من السيرفر بمفتاح service_role (يتجاوز RLS).
alter table public.admin_users enable row level security;

drop policy if exists "allow public read admin_users" on public.admin_users;
create policy "allow public read admin_users"
  on public.admin_users for select
  using (true);

-- السوبر أدمن الأساسي (Master Admin) — مصرّح دائمًا وغير قابل للحذف من الواجهة.
insert into public.admin_users (email)
values ('zeko.bassiony@gmail.com')
on conflict (email) do nothing;
