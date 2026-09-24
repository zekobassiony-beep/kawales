-- ============================================================
-- كواليس (Kawalees) — دعم المقاعد التفاعلية (Interactive Seats) للعروض
-- شغّل مرة واحدة على قاعدة البيانات (Postgres).
--
-- has_interactive_seats = true  ⇒ صفحة العرض تعرض خريطة كراسي تفاعلية ثم
--                                  نافذة الدفع الموحّدة.
-- has_interactive_seats = false ⇒ صفحة العرض تعرض كارت الفئات + العداد ثم
--                                  نافذة الدفع الموحّدة مباشرة.
-- ============================================================

alter table if exists public.events
  add column if not exists has_interactive_seats boolean not null default false;
