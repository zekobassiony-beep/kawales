-- ============================================================
-- كواليس (Kawalees) — دالة تجميع أرقام التذاكر للوحة الإدارة
-- ------------------------------------------------------------
-- يُشغَّل مرة واحدة على مشروع Supabase (SQL Editor أو psql).
--
-- الغرض: تُعطي لوحة السوبر أدمن **أرقامًا إجمالية دقيقة** بنداء واحد صغير
-- بدل تحميل كل صفوف التذاكر إلى المتصفح (عند ٢٥٦٠٠ تذكرة كان كل تحميل ≈٩ ميجابايت).
--
-- التطبيع مطابق لدالة `normalizeTicketStatus` في الكود: أي مرادف للقبول
-- (ACTIVE/confirmed/paid…) يُحسب «مقبولًا»، وأي مرادف للحضور يُحسب «حضورًا».
-- ============================================================

create or replace function public.kawalees_ticket_stats()
returns table (
  total      bigint,
  pending    bigint,
  approved   bigint,
  rejected   bigint,
  checked_in bigint,
  seats      bigint,
  revenue    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      lower(coalesce(status, '')) as s,
      coalesce(total_price, 0) as price,
      case
        when jsonb_typeof(seats) = 'array' then jsonb_array_length(seats)
        else 1
      end as seat_count
    from public.tickets
  ),
  flags as (
    select
      s,
      price,
      seat_count,
      s in ('approved', 'active', 'confirmed', 'paid', 'completed') as is_approved,
      s in ('checked_in', 'used') as is_checked_in,
      s in ('rejected', 'declined', 'cancelled', 'canceled') as is_rejected
    from normalized
  )
  select
    count(*)::bigint,
    count(*) filter (where not is_approved and not is_checked_in and not is_rejected)::bigint,
    count(*) filter (where is_approved)::bigint,
    count(*) filter (where is_rejected)::bigint,
    count(*) filter (where is_checked_in)::bigint,
    coalesce(sum(seat_count) filter (where is_approved or is_checked_in), 0)::bigint,
    coalesce(sum(price) filter (where is_approved or is_checked_in), 0)::bigint
  from flags;
$$;

comment on function public.kawalees_ticket_stats() is
  'أرقام التذاكر الإجمالية للوحة الإدارة (بديل تحميل كل الصفوف إلى المتصفح).';

grant execute on function public.kawalees_ticket_stats() to service_role;

-- اختبار سريع بعد التشغيل:
--   select * from public.kawalees_ticket_stats();
