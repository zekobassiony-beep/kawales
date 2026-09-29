-- ============================================================
-- كواليس (Kawalees) — جدول ملفات المستخدمين (profiles) على Supabase
-- ------------------------------------------------------------
-- شغّل هذا الملف مرة واحدة من SQL Editor في مشروع Supabase:
--   https://supabase.com/dashboard/project/yvixrtlonpubbjxhprld/sql/new
-- (إنشاء الجداول يحتاج SQL Editor — مفاتيح الـ API لا تُنفّذ DDL)
--
-- سبب الجدول: كانت بيانات إكمال الملف (الاسم/الفرقة/المسرح…) تُحفظ في
-- `localStorage` فقط، فتضيع عند تغيير الجهاز أو الخروج. هذا الجدول يجعل
-- الحساب والملف **محفوظين فعليًا** في قاعدة البيانات ليستطيع المستخدم
-- تسجيل الدخول لاحقًا من أي متصفح ويرى بياناته كما تركها.
-- ============================================================

create table if not exists public.profiles (
  -- نفس معرّف المستخدم في Supabase Auth (حذف المستخدم يحذف ملفه معه).
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  role       text not null default 'customer',   -- customer | actor | troupe | venue
  provider   text not null default 'password',   -- password | google
  onboarded  boolean not null default false,     -- هل أكمل بيانات /onboarding؟
  full_name  text not null default '',
  avatar_url text not null default '',
  profile    jsonb not null default '{}'::jsonb, -- كل حقول الملف كاملة
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- تحديث `updated_at` تلقائيًا مع كل تعديل.
create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();

-- RLS: لا كتابة إطلاقًا من المتصفح (الحفظ من السيرفر بمفتاح service_role)،
-- ويُسمح للمستخدم المسجَّل بقراءة صفّه هو فقط — دفاع إضافي لا أكثر.
alter table public.profiles enable row level security;

drop policy if exists "owner can read own profile" on public.profiles;
create policy "owner can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);
