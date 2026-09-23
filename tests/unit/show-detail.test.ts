import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ageRatingFor,
  buildShowtimeCards,
  castRoster,
  groupDiscount,
  mapsUrlFor,
  metalForTier,
  occupancyInfo,
  starDistribution,
} from "../../lib/show-detail"

describe("فئات التذاكر المعدنية", () => {
  it("يمنح أغلى فئة «دايموند» ثم الذهبي والفضي والبرونزي", () => {
    assert.equal(metalForTier("VIP", 0).label, "دايموند")
    assert.equal(metalForTier("صالة", 1).label, "ذهبي")
    assert.equal(metalForTier("بلكون", 2).label, "فضي")
    assert.equal(metalForTier("إضافي", 3).label, "برونزي")
  })

  it("لا يتجاوز آخر فئة عند زيادة العدد", () => {
    assert.equal(metalForTier("x", 9).label, "برونزي")
  })
})

describe("التصنيف العمري", () => {
  it("يميّز عروض الأطفال والعروض الحساسة والمدة الطويلة", () => {
    assert.equal(ageRatingFor({ category: "مسرح أطفال", durationMinutes: 60 }), "عائلي")
    assert.equal(ageRatingFor({ category: "رعب", durationMinutes: 90 }), "+16")
    assert.equal(ageRatingFor({ category: "دراما", durationMinutes: 130 }), "+16")
    assert.equal(ageRatingFor({ category: "كوميديا", durationMinutes: 95 }), "+12")
  })
})

describe("رابط الخريطة", () => {
  it("يستخدم الرابط المحفوظ إن وُجد", () => {
    assert.equal(
      mapsUrlFor({ googleMapsUrl: "https://maps.app.goo.gl/abc", name: "مسرح", address: "شارع", city: "القاهرة" }),
      "https://maps.app.goo.gl/abc",
    )
  })

  it("يبني بحثًا تلقائيًا عند غياب الرابط", () => {
    const url = mapsUrlFor({ googleMapsUrl: null, name: "مسرح الهوسابير", address: "الزمالك", city: "القاهرة" })
    assert.ok(url.startsWith("https://www.google.com/maps/search/?api=1&query="))
    assert.ok(decodeURIComponent(url).includes("مسرح الهوسابير"))
  })
})

describe("الإشغال", () => {
  it("يحسب النسبة والمتبقي وحالة الكارت", () => {
    assert.equal(occupancyInfo(0, 100).status, "available")
    assert.equal(occupancyInfo(60, 100).status, "trending")
    assert.equal(occupancyInfo(90, 100).status, "limited")
    assert.equal(occupancyInfo(100, 100).status, "sold_out")
  })

  it("يعالج القيم الشاذة ويُظهر «مباع» بنسبة 100%", () => {
    const info = occupancyInfo(500, 100)
    assert.equal(info.remaining, 0)
    assert.equal(info.pct, 100)
    assert.equal(info.label, "مباع")
    // سعة صفرية لا تسبب قسمة على صفر: تُعامل كسعة 1 ⇒ مباع بالكامل.
    assert.equal(occupancyInfo(10, 0).remaining, 0)
    assert.equal(occupancyInfo(0, 0).pct, 0)
  })
})

describe("خصم الشلة", () => {
  it("يطبّق 15% عند 5 تذاكر أو أكثر فقط", () => {
    assert.equal(groupDiscount(4, 10000).pct, 0)
    const deal = groupDiscount(5, 10000)
    assert.equal(deal.pct, 15)
    assert.equal(deal.totalCents, 42500)
    assert.equal(deal.savingsCents, 7500)
  })
})

describe("توزيع النجوم", () => {
  it("يبني أعمدة 5 → 1 بنسب صحيحة", () => {
    const buckets = starDistribution([5, 5, 4, 3, 1])
    assert.deepEqual(
      buckets.map((bucket) => bucket.stars),
      [5, 4, 3, 2, 1],
    )
    assert.equal(buckets[0].count, 2)
    assert.equal(buckets[0].pct, 40)
    assert.equal(buckets[3].count, 0)
  })

  it("يتعامل مع قائمة فارغة", () => {
    assert.equal(starDistribution([]).every((bucket) => bucket.pct === 0), true)
  })
})

describe("قائمة الممثلين", () => {
  it("يستخدم طاقم العمل المقبول عند توفره", () => {
    const cast = castRoster({
      seed: "ليلة في القهوة",
      crew: [
        { name: "كريم عادل", part: "البطل", status: "accepted" },
        { name: "سلمى منصور", part: "البطلة", status: "accepted" },
        { name: "مرفوض", part: "دور", status: "rejected" },
      ],
    })
    assert.equal(cast.length, 2)
    assert.equal(cast[0].name, "كريم عادل")
    assert.equal(cast[0].role, "البطل")
    assert.equal(cast[0].kind, "lead")
  })

  it("يولّد قائمة ثابتة حتمية عند غياب الطاقم", () => {
    const first = castRoster({ seed: "آخر ترام" })
    const second = castRoster({ seed: "آخر ترام" })
    assert.equal(first.length, 8)
    assert.deepEqual(first, second)
    assert.ok(first.some((member) => member.kind === "lead"))
  })
})

describe("بطاقات المواعيد", () => {
  it("يرتّب المواعيد ويميّز المبيع والحالي", () => {
    const cards = buildShowtimeCards(
      [
        { id: 2, slug: "b", startsAt: "2026-11-02T20:00:00+02:00", sold: 100, capacity: 100 },
        { id: 1, slug: "a", startsAt: "2026-10-12T19:00:00+02:00", sold: 10, capacity: 100 },
      ],
      1,
      () => "تاريخ",
      () => "٨:٠٠ م",
    )
    assert.equal(cards[0].id, 1)
    assert.equal(cards[0].status, "available")
    assert.equal(cards[0].isCurrent, true)
    assert.equal(cards[1].status, "sold_out")
    assert.equal(cards[1].statusLabel, "مباع")
  })
})
