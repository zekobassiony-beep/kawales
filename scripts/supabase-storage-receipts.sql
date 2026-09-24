-- ============================================================
-- كواليس (Kawalees) — Bucket تخزين إيصالات الدفع (Supabase Storage)
-- ------------------------------------------------------------
-- الإيصالات تُرفع من السيرفر بمفتاح service_role (يتجاوز سياسات RLS)،
-- وتُقرأ علنًا لأن الـ Bucket عام (public). لذا لا حاجة لأي سياسة RLS
-- إضافية على storage.objects للقراءة العامة أو للرفع من السيرفر.
--
-- لإنشاء الـ Bucket اختر إحدى الطريقتين:
--   1) شغّل:  node scripts/setup-receipts-storage.mjs
--   2) أو نفّذ هذا الملف من SQL Editor.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;
