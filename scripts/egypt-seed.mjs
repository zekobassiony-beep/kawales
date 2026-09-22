// يجعل قاعدة بيانات Neon مصرية بالكامل: مسارح وفرق وعروض بالعربية وأسعار بالجنيه.
//
//   node scripts/egypt-seed.mjs            # تقرير فقط (بدون تعديل)
//   node scripts/egypt-seed.mjs --apply    # تنفيذ التغييرات داخل معاملة واحدة
//
// يحذف بيانات الإمارات القديمة ويُدخل البيانات المصرية، بما فيها عرض الاختبار
// «سجن الأميرة العاشقة» (id 99) بسعر أساسي 100 ج.م ⬅️ 110 ج.م مع رسمة الخدمة.
// حماية: يتوقف فورًا لو وُجدت حجوزات فعلية حتى لا تُفقد أي تذاكر.
import pg from "pg"
import { resolveConnectionString } from "../tests/load-env.mjs"

const { Client } = pg
const apply = process.argv.includes("--apply")
const connectionString = resolveConnectionString()

if (!connectionString) {
  console.error("لا يوجد DATABASE_URL/POSTGRES_URL مهيأ — لا شيء لنفعله.")
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
})

// الأسعار بالقرش (1 ج.م = 100 قرش) والصفوف بترقيم يبدأ من الصفر (VIP = صفوف 0 و 1).
const VENUES = [
  { id: 1, slug: "hanager-arts-centre", name: "مسرح الهوسابير", city: "القاهرة", address: "أرض أوبرا الروضي، الزمالك", rows: 8, seatsPerRow: 12 },
  { id: 2, slug: "sayed-darwish-theatre", name: "مسرح سيد درويش", city: "الإسكندرية", address: "شارع فؤاد، وسط البلد", rows: 8, seatsPerRow: 12 },
  { id: 3, slug: "talia-theatre", name: "مسرح الطليعة", city: "القاهرة", address: "شارع التحرير، وسط البلد", rows: 8, seatsPerRow: 12 },
  { id: 4, slug: "el-felucca-theatre", name: "مسرح الفلكي", city: "الإسكندرية", address: "سيدي جابر، كورنيش الإسكندرية", rows: 6, seatsPerRow: 10 },
  { id: 5, slug: "sakia-al-sawy", name: "ساقية الصاوي", city: "القاهرة", address: "26 شارع 10 رمضان، الزمالك", rows: 6, seatsPerRow: 10 },
]

const TROUPES = [
  { id: 1, slug: "al-masrah-al-hur", name: "مسرح الحر المستقل", bio: "فرقة مستقلة تعرض الدراما العربية المعاصرة بين القاهرة والإسكندرية منذ 2008، وتجمع بين النصوص التأليفية والاقتباسات الجريئة.", foundedYear: 2008, city: "القاهرة" },
  { id: 2, slug: "bayt-al-hikma", name: "فرقة بيت الحكمة", bio: "فرقة تمثيلية معروفة بإحياء كلاسيكيات المسرح المصري وتقديم أعمال تأليفية جديدة على خشبات الإسكندرية.", foundedYear: 1999, city: "الإسكندرية" },
  { id: 3, slug: "masrah-al-funoon-al-shabia", name: "فرقة مسرح الفنون الشعبية", bio: "فرقة قديمة تحفظ تراث المسرح الشعبي المصري من الحكواتية والأراجوز وتعيد تقديمه بلغة مسرحية حديثة.", foundedYear: 1985, city: "القاهرة" },
  { id: 4, slug: "studio-al-masrah", name: "مجموعة ستوديو المسرح", bio: "مجموعة شبابية تجريبية تختبر أشكالًا جديدة من العرض المسرحي القصير في القاهرة والإسكندرية.", foundedYear: 2013, city: "الإسكندرية" },
  { id: 5, slug: "el-barouaz", name: "فرقة البرواز", bio: "فرقة مسرحية تصنع عروضًا موسيقية وغنائية مستوحاة من التراث المصري وأغاني الحارة القديمة.", foundedYear: 2004, city: "القاهرة" },
]

// صور Unsplash عالية الجودة (مسرح وفن): بوستر 3:4 وغلاف عريض لكل عرض.
const SHOW_IMAGES = {
  "night-at-the-qahwa": {
    posterUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=1600&q=80",
  },
  "the-last-tram": {
    posterUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80",
  },
  "hikayat-el-zel": {
    posterUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1493225457124-a3ad161e5e93?auto=format&fit=crop&w=1600&q=80",
  },
  "layali-al-andalus": {
    posterUrl: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
  },
  "ghurfet-204": {
    posterUrl: "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1600&q=80",
  },
  "el-bwaba": {
    posterUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=1600&q=80",
  },
  "sijn-al-amira-al-ashqa": {
    posterUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1478147427282-58a87a120781?auto=format&fit=crop&w=1600&q=80",
  },
}

function showImages(slug) {
  return SHOW_IMAGES[slug] ?? { posterUrl: "/placeholder.svg", heroUrl: "/placeholder.svg" }
}

const EVENTS = [
  {
    id: 1, slug: "night-at-the-qahwa", title: "ليلة في القهوة", troupeId: 1, venueId: 1,
    tagline: "كوميديا عن حيوات تُتنصَّت فوق طاولة واحدة في قلب وسط البلد.",
    description: "غرباء يجتمعون حول طاولة وراديو قديم في قهوة وسط البلد، وبين فنجان وآخر تنكشف أسرار لا تُقال إلا بعد منتصف الليل. عرض كوميدي عن المدينة التي لا تنام.",
    category: "كوميديا", durationMinutes: 95, startsAt: "2026-10-12T19:00:00+02:00", featured: true,
    priceTiers: [
      { id: "orchestra", name: "أوركسترا", priceCents: 25000, color: "#c9a227", rows: [0, 1, 2, 3] },
      { id: "balcony", name: "بلكونة", priceCents: 15000, color: "#6b7280", rows: [4, 5, 6, 7] },
    ],
  },
  {
    id: 2, slug: "the-last-tram", title: "آخر ترام", troupeId: 2, venueId: 2,
    tagline: "مسرحية ذكرى على كورنيش الإسكندرية.",
    description: "أخوان ينتظران آخر ترام في الليل على كورنيش الإسكندرية، وكل انتظار يعيد إليهما ذكرى البيت الذي هجراه. نص شعري عن المدينة والحنين والوداع.",
    category: "دراما", durationMinutes: 110, startsAt: "2026-11-02T20:00:00+02:00", featured: true,
    priceTiers: [
      { id: "stalls", name: "بارتر", priceCents: 30000, color: "#c9a227", rows: [0, 1, 2, 3] },
      { id: "circle", name: "صف أول بلكونة", priceCents: 18000, color: "#6b7280", rows: [4, 5, 6, 7] },
    ],
  },
  {
    id: 3, slug: "hikayat-el-zel", title: "حكاية الظل", troupeId: 3, venueId: 5,
    tagline: "حكاية حكواتي وظلٍّ قرر أن يستقل.",
    description: "حكواتي عجوز يروي الحكايات في ساقية على النيل، وفي ليلة يكتشف أن ظله يروي حكاية أخرى لا يرضاها. عرض عن الحكواتية والتراث الشعبي المصري.",
    category: "دراما", durationMinutes: 80, startsAt: "2026-09-24T20:00:00+02:00", featured: false,
    priceTiers: [{ id: "general", name: "عام", priceCents: 12000, color: "#c9a227", rows: [0, 1, 2, 3, 4, 5] }],
  },
  {
    id: 4, slug: "layali-al-andalus", title: "ليالي الأندلس", troupeId: 5, venueId: 3,
    tagline: "عرض موسيقي غنائي من التراث المصري.",
    description: "عرض موسيقي غنائي يمزج أغاني الحارة المصرية القديمة بمقامات الأندلس، بأداء حي لفرقة البرواز على خشبة مسرح الطليعة.",
    category: "رومانسي", durationMinutes: 100, startsAt: "2026-10-05T19:30:00+02:00", featured: false,
    priceTiers: [{ id: "general", name: "عام", priceCents: 9000, color: "#c9a227", rows: [0, 1, 2, 3, 4, 5, 6, 7] }],
  },
  {
    id: 5, slug: "ghurfet-204", title: "غرفة 204", troupeId: 4, venueId: 1,
    tagline: "غموض في غرفة فندق لا يخرج منها أحد.",
    description: "نزيل يسجّل غرفة 204 في فندق قديم، وفي الصباح لا يخرج منها أحد. عرض غموض نفسي في فصل واحد يُمهّد فيه الجمهور ليلًا لن ينساه.",
    category: "غموض", durationMinutes: 75, startsAt: "2026-10-24T21:00:00+02:00", featured: false,
    priceTiers: [{ id: "general", name: "عام", priceCents: 14000, color: "#c9a227", rows: [0, 1, 2, 3, 4, 5, 6, 7] }],
  },
  {
    id: 6, slug: "el-bwaba", title: "البوابة", troupeId: 5, venueId: 3,
    tagline: "دراما عائلية خلف بابٍ لم يُفتح منذ عشرين عامًا.",
    description: "ثلاثة أشقاء يجتمعون بعد رحيل الأب لفتح باب غرفة أُغلقت منذ عشرين عامًا. ما وراء الباب ليس أثاثًا فقط، بل عائلة كاملة دُفنت حية.",
    category: "دراما", durationMinutes: 120, startsAt: "2026-11-14T20:00:00+02:00", featured: false,
    priceTiers: [{ id: "general", name: "عام", priceCents: 11000, color: "#c9a227", rows: [0, 1, 2, 3, 4, 5, 6, 7] }],
  },
  {
    // عرض الاختبار المطلوب: السعر الأساسي 100 ج.م ⬅️ الإجمالي 110 ج.م (رسمة 10%)
    id: 99, slug: "sijn-al-amira-al-ashqa", title: "سجن الأميرة العاشقة", troupeId: 1, venueId: 3,
    tagline: "حكاية خرافية عن أميرة سُجنّت في قصرها وحبٌّ يعرف الأبواب السرية.",
    description: "أميرة حبسها والدها في قصر فوق تل، وعازف ناي يجد النفق السري الذي لا تعرفه الحراسة. حكاية خرافية موسيقية عن الحرية والحب والبوابات التي تُفتح دائمًا من الداخل.",
    category: "عائلي", durationMinutes: 85, startsAt: "2026-10-30T20:00:00+02:00", featured: true,
    priceTiers: [{ id: "general", name: "عام", priceCents: 10000, color: "#c9a227", rows: [0, 1, 2, 3, 4, 5, 6, 7] }],
  },
]

try {
  await client.connect()

  const { rows: counts } = await client.query(
    "SELECT (SELECT COUNT(*)::int FROM bookings) AS bookings, (SELECT COUNT(*)::int FROM booked_seats) AS seats",
  )
  console.log(`bookings: ${counts[0].bookings} · booked_seats: ${counts[0].seats}`)

  // الحجوزات الحقيقية تُحفظ: تتحقق أن كل كرسي محجوز يشير إلى عرض من المجموعة الجديدة (ids 1..6 و 99).
  const seededIds = new Set([...EVENTS.map((e) => e.id)])
  const { rows: foreignSeats } = await client.query(
    "SELECT DISTINCT event_id FROM booked_seats WHERE event_id <> ALL($1::int[])",
    [[...seededIds]],
  )
  if (foreignSeats.length > 0) {
    console.error(
      `توجد مقاعد محجوزة على عروض خارج المجموعة الجديدة (${foreignSeats.map((r) => r.event_id).join(", ")}) — أوقف التنفيذ احتياطًا.`,
    )
    process.exit(1)
  }
  if (counts[0].bookings > 0) {
    console.log("ستُحفظ الحجوزات الحالية كما هي (العروض تُستبدل بنفس المعرّفات).")
  }

  const { rows: before } = await client.query(
    "SELECT (SELECT COUNT(*)::int FROM events) AS events, (SELECT COUNT(*)::int FROM venues) AS venues, (SELECT COUNT(*)::int FROM troupes) AS troupes",
  )
  console.log(`قبل التنفيذ — events: ${before[0].events} · venues: ${before[0].venues} · troupes: ${before[0].troupes}`)

  if (!apply) {
    console.log("\nوضع التقرير فقط — أعد التشغيل بـ --apply لتنفيذ التمصير.")
    process.exit(0)
  }

  await client.query("BEGIN")
  await client.query("DELETE FROM events")
  await client.query("DELETE FROM venues")
  await client.query("DELETE FROM troupes")

  for (const v of VENUES) {
    await client.query(
      `INSERT INTO venues (id, slug, name, city, address, rows, seats_per_row)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [v.id, v.slug, v.name, v.city, v.address, v.rows, v.seatsPerRow],
    )
  }

  for (const t of TROUPES) {
    await client.query(
      `INSERT INTO troupes (id, slug, name, bio, founded_year, city)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [t.id, t.slug, t.name, t.bio, t.foundedYear, t.city],
    )
  }

  for (const e of EVENTS) {
    await client.query(
      `INSERT INTO events (id, slug, title, tagline, description, category, language, duration_minutes,
                           poster_url, hero_url, troupe_id, venue_id, starts_at, price_tiers, featured, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'on_sale')`,
      [
        e.id, e.slug, e.title, e.tagline, e.description, e.category, "عربي", e.durationMinutes,
        showImages(e.slug).posterUrl, showImages(e.slug).heroUrl, e.troupeId, e.venueId, e.startsAt,
        JSON.stringify(e.priceTiers), e.featured,
      ],
    )
  }

  // أعد ضبط التسلسلات بعد الإدخال بمعرفات صريحة.
  await client.query(
    `SELECT setval(pg_get_serial_sequence('venues','id'),  (SELECT MAX(id) FROM venues)),
            setval(pg_get_serial_sequence('troupes','id'), (SELECT MAX(id) FROM troupes)),
            setval(pg_get_serial_sequence('events','id'),  (SELECT MAX(id) FROM events))`,
  )
  await client.query("COMMIT")

  const { rows: princess } = await client.query("SELECT id, title, price_tiers FROM events WHERE id = 99")
  if (princess[0]) {
    const tiers = princess[0].price_tiers ?? []
    const min = Math.min(...tiers.map((t) => t.priceCents))
    console.log(
      `عرض الاختبار: ${princess[0].title} (id ${princess[0].id}) — أقل سعر ${min / 100} ج.م ⬅️ الإجمالي مع رسمة الخدمة ${(min + Math.max(min * 0.1, 500)) / 100} ج.م`,
    )
  }

  const { rows: after } = await client.query(
    "SELECT (SELECT COUNT(*)::int FROM events) AS events, (SELECT COUNT(*)::int FROM venues) AS venues, (SELECT COUNT(*)::int FROM troupes) AS troupes",
  )
  console.log(`بعد التنفيذ — events: ${after[0].events} · venues: ${after[0].venues} · troupes: ${after[0].troupes}`)
  console.log("التمصير المصري تم بنجاح ✅")
} catch (error) {
  await client.query("ROLLBACK").catch(() => {})
  console.error(`فشل سكربت التمصير: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}