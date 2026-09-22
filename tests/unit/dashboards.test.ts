import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applicationStatusLabel,
  getTroupeWallet,
  mockActorApplications,
  mockActorProfile,
  mockApplications,
  mockAuditions,
  mockOffPeakDeals,
  mockVenueSchedule,
} from "../../lib/dashboards"

describe("dashboard wallet math", () => {
  it("returns a zeroed wallet without a database", async () => {
    const wallet = await getTroupeWallet(1)
    assert.deepEqual(wallet, {
      grossCents: 0,
      ticketsSold: 0,
      bookingsCount: 0,
      platformFeeCents: 0,
      netCents: 0,
    })
  })
})

describe("dashboard mock catalogs", () => {
  it("exposes Egyptian auditions and casting applications", () => {
    assert.ok(mockAuditions.length >= 2)
    assert.ok(mockAuditions.every((audition) => audition.title.length > 0 && audition.venue.length > 0))
    assert.ok(mockApplications.length >= 2)
    assert.ok(mockApplications.every((application) => application.actorName.length > 0))
  })

  it("exposes an actor portfolio with gallery and application states", () => {
    assert.ok(mockActorProfile.name.length > 0)
    assert.ok(mockActorProfile.skills.length > 0)
    assert.ok(mockActorProfile.gallery.length > 0)
    assert.ok(mockActorApplications.some((application) => application.status === "pending"))
    assert.ok(mockActorApplications.some((application) => application.status === "accepted"))
    assert.ok(mockActorApplications.some((application) => application.status === "rejected"))
  })

  it("exposes a venue schedule and off-peak deals", () => {
    assert.ok(mockVenueSchedule.length > 0)
    assert.ok(mockVenueSchedule.every((show) => show.date.length > 0))
    assert.ok(mockOffPeakDeals.some((deal) => deal.active))
    assert.ok(mockOffPeakDeals.some((deal) => !deal.active))
  })

  it("labels application states in Arabic", () => {
    assert.equal(applicationStatusLabel.pending, "قيد المراجعة")
    assert.equal(applicationStatusLabel.accepted, "مقبول")
    assert.equal(applicationStatusLabel.rejected, "غير مقبول")
  })
})