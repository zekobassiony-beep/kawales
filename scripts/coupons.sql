-- ============================================================
-- كواليس (Kawalees) — كوبونات الخصم على Postgres (Supabase)
-- ------------------------------------------------------------
-- ملاحظة: الواجهة تعمل الآن من مخزن منصة واحد (`lib/coupons.ts` على نمط
-- باقي مخازن غرفة العمليات). شغّل هذا الملف مرة واحدة عند رغبتك في تشغيل
-- الكوبونات **لكل الزوار من أي جهاز**، ثم بدّل قراءة المخزن لتصبح من الجدول
-- (نفس الدوال: `findCoupon` / `validateCoupon` / `redeemCoupon`) بلا أي تغيير
-- في الشاشات.
-- ============================================================

create table if not exists public.coupons (
  code                  text primary key,                          -- FEST-2026-X8Y
  label                 text    not null default '',               -- اسم الحملة
  discount_pct          integer not null default 0,                -- 0..100 (100 = مجاني)
  service_fee_mode      text    not null default 'none',           -- none | same | waived
  max_uses              integer not null default 0,                -- 0 = بلا حد
  max_uses_per_customer integer not null default 0,                -- 0 = بلا حد
  max_discount_cents    integer not null default 0,                -- 0 = بلا سقف
  scope_kind            text    not null default 'all',            -- all | event | troupe | venue
  scope_ids             integer[] not null default '{}',
  starts_at             timestamptz,
  ends_at               timestamptz,
  status                text    not null default 'active',         -- active | disabled | expired | exhausted
  used_count            integer not null default 0,
  created_by            text    not null default '',
  note                  text    not null default '',
  created_at            timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id                     serial primary key,
  code                   text not null references public.coupons(code) on delete cascade,
  ticket_id              text not null default '',
  customer_id            text not null default '',                 -- بريد العميل
  discount_cents         integer not null default 0,
  service_fee_saving_cents integer not null default 0,
  total_cents            integer not null default 0,
  created_at             timestamptz not null default now()
);

create index if not exists coupons_status_idx on public.coupons (status);
create index if not exists coupon_redemptions_code_idx on public.coupon_redemptions (code);
create index if not exists coupon_redemptions_customer_idx on public.coupon_redemptions (customer_id);

-- القراءة العامة للأكواد (التحقق من صحة الكود عند الحجز)، والكتابة بمفتاح service_role.
alter table public.coupons enable row level security;

drop policy if exists "allow public read coupons" on public.coupons;
create policy "allow public read coupons"
  on public.coupons for select
  using (true);
