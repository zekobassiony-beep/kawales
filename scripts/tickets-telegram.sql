-- ============================================================
-- كواليس (Kawalees) — أعمدة تكامل تليجرام على جدول التذاكر
-- شغّل مرة واحدة على قاعدة البيانات (Postgres).
--
-- telegram_chat_id : معرّف محادثة العميل على تليجرام (يُملأ عندما يرسل
--                    `/start KW-XXXXXX` للبوت) لإرسال بطاقة التذكرة له.
-- ticket_image_url : رابط صورة التذكرة/الـ QR التي يولّدها البوت ويخزّنها
--                    في Supabase Storage — والموقع يعرضها فقط (Viewer).
--
-- ملاحظة: الأعمدة اختيارية؛ التطبيق يعمل بدونها (يفشل بحذر ويُسجّل تحذيرًا)
-- لكن ميزات إرسال التذكرة للمستخدم وعرض صورتها تحتاج تنفيذها.
-- ============================================================

alter table if exists public.tickets
  add column if not exists telegram_chat_id text,
  add column if not exists ticket_image_url text;

create index if not exists tickets_telegram_chat_id_idx on public.tickets (telegram_chat_id);
