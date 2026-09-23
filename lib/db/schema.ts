import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core"

export const troupes = pgTable("troupes", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  imageUrl: text("image_url"),
  foundedYear: integer("founded_year"),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull().default(""),
  imageUrl: text("image_url"),
  /** رابط اللوكيشن المباشر من Google Maps (اختياري). */
  googleMapsUrl: text("google_maps_url"),
  rows: integer("rows").notNull().default(8),
  seatsPerRow: integer("seats_per_row").notNull().default(12),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type PriceTier = {
  id: string
  name: string
  priceCents: number
  color: string
  rows: number[]
}

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Drama"),
  language: text("language").notNull().default("Arabic"),
  durationMinutes: integer("duration_minutes").notNull().default(90),
  posterUrl: text("poster_url"),
  heroUrl: text("hero_url"),
  troupeId: integer("troupe_id").notNull(),
  venueId: integer("venue_id").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  priceTiers: jsonb("price_tiers").$type<PriceTier[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  status: text("status").notNull().default("on_sale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type BookedSeat = {
  seatId: string
  tierId: string
  priceCents: number
}

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  eventId: integer("event_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull().default(""),
  seats: jsonb("seats").$type<BookedSeat[]>().notNull().default([]),
  totalCents: integer("total_cents").notNull().default(0),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const bookedSeats = pgTable(
  "booked_seats",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    seatId: text("seat_id").notNull(),
    bookingId: integer("booking_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventSeatUnique: unique().on(t.eventId, t.seatId),
  }),
)

export type Troupe = typeof troupes.$inferSelect
export type Venue = typeof venues.$inferSelect
export type Event = typeof events.$inferSelect
export type Booking = typeof bookings.$inferSelect
