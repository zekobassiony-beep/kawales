-- ============================================================
-- كواليس (Kawalees) — مساحة عمل الإنتاج على Supabase
-- ------------------------------------------------------------
-- شغّل هذا الملف مرة واحدة من SQL Editor في مشروع Supabase:
--   https://supabase.com/dashboard/project/yvixrtlonpubbjxhprld/sql/new
--
-- سبب الجداول: كان «الإنتاج والأودشنات والدعوات» كله في `localStorage`
-- (متصفح واحد فقط) فلا يصل أي أودشن أو دعوة لأي فنان على جهاز آخر.
-- بهذه الجداول تصبح:
--   • أودشنات حقيقية تُغلق وتُفتح لايف ويراها كل الفنانين.
--   • دعوات طاقم عمل تصل للفنان ببريده على أي جهاز.
--   • أعمال مسرحية محفوظة مع فئاتها ومسارحها (والمسرح الخارجي كتابةً).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- الأعمال المسرحية ----------
create table if not exists public.productions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  owner_email   text not null,
  title         text not null,
  poster_url    text not null default '',
  status        text not null default 'coming_soon',   -- coming_soon | on_sale | archived
  venue_kind    text not null default 'later',         -- platform | custom | later
  venue_name    text,                                  -- نص حر للمسرح (قد يكون مسرحًا خارج المنصة)
  venue_city    text,
  seating_mode  text not null default 'numbered',       -- numbered | general_admission
  rows          integer not null default 6,
  seats_per_row integer not null default 10,
  blocked_seats jsonb not null default '[]'::jsonb,
  capacity      integer not null default 0,
  tiers         jsonb not null default '[]'::jsonb,     -- فئات الأسعار (اسم/سعر/لون/نطاق صفوف)
  gallery       jsonb not null default '[]'::jsonb,
  starts_at     timestamptz,
  event_slug    text,                                   -- رابط العرض المنشور للجمهور (يُملأ عند الربط بقاعدة العروض)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists productions_owner_idx on public.productions (lower(owner_email));

-- ---------- طاقم العمل والدعوات ----------
create table if not exists public.crew_members (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  name          text not null,
  email         text not null,
  part          text not null default 'طاقم',
  status        text not null default 'invited',        -- invited | accepted | declined | left | removed
  invited_at    timestamptz not null default now(),
  responded_at  timestamptz
);

create unique index if not exists crew_members_unique_idx on public.crew_members (production_id, lower(email));
create index if not exists crew_members_email_idx on public.crew_members (lower(email));

-- ---------- الأودشنات ----------
create table if not exists public.auditions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  owner_email   text not null,
  production_id uuid references public.productions (id) on delete set null,
  title         text not null,
  role          text not null default '',
  requirements  text not null default '',
  pay           text not null default '',
  venue         text not null default '',
  date_text     text not null default '',
  status        text not null default 'open',           -- open | closed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists auditions_status_idx on public.auditions (status);

-- ---------- طلبات الأودشن ----------
create table if not exists public.audition_applications (
  id           uuid primary key default gen_random_uuid(),
  audition_id  uuid not null references public.auditions (id) on delete cascade,
  actor_email  text not null,
  actor_name   text not null default '',
  profile_url  text not null default '',
  status       text not null default 'pending',         -- pending | second_round | shortlist | rejected
  applied_at   timestamptz not null default now()
);

create unique index if not exists audition_applications_unique_idx
  on public.audition_applications (audition_id, lower(actor_email));

-- ---------- إنجازات الفنانيين ----------
create table if not exists public.achievements (
  id          uuid primary key default gen_random_uuid(),
  actor_email text not null,
  actor_name  text not null default '',
  kind        text not null default 'workshop',         -- course | workshop | external
  title       text not null,
  organizer   text not null default '',
  year        text not null default '',
  link        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists achievements_actor_idx on public.achievements (lower(actor_email));

-- ---------- تحديث updated_at تلقائيًا ----------
create or replace function public.touch_productions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productions_touch_updated_at on public.productions;
create trigger productions_touch_updated_at
  before update on public.productions
  for each row execute function public.touch_productions_updated_at();

drop trigger if exists auditions_touch_updated_at on public.auditions;
create trigger auditions_touch_updated_at
  before update on public.auditions
  for each row execute function public.touch_productions_updated_at();

-- ---------- RLS ----------
-- كل الكتابة تمر من السيرفر بمفتاح service_role (يتجاوز RLS)، وهذه السياسات
-- حماية إضافية: يقرأ المستخدم ما يملكه فقط، والأودشنات المفتوحة يراها من سجّل دخوله.
alter table public.productions enable row level security;
alter table public.crew_members enable row level security;
alter table public.auditions enable row level security;
alter table public.audition_applications enable row level security;
alter table public.achievements enable row level security;

drop policy if exists "owner reads own productions" on public.productions;
create policy "owner reads own productions"
  on public.productions for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "owner reads own auditions" on public.auditions;
create policy "owner reads own auditions"
  on public.auditions for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "open auditions are visible" on public.auditions;
create policy "open auditions are visible"
  on public.auditions for select to authenticated
  using (status = 'open');

drop policy if exists "member reads own crew rows" on public.crew_members;
create policy "member reads own crew rows"
  on public.crew_members for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "actor reads own applications" on public.audition_applications;
create policy "actor reads own applications"
  on public.audition_applications for select to authenticated
  using (lower(actor_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "actor reads own achievements" on public.achievements;
create policy "actor reads own achievements"
  on public.achievements for select to authenticated
  using (lower(actor_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
