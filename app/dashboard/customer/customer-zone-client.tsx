"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { CalendarDays, MapPin, MessageSquare, Send, Settings, Sparkles, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatPrice } from "@/lib/format"
import { CustomerStrip } from "@/app/dashboard/customer/customer-strip"
import { CustomerTicketStats, MyTickets } from "@/app/dashboard/customer/my-tickets"
import { CustomerReviews } from "@/app/dashboard/customer/customer-reviews"
import { CustomerAccountSettings } from "@/app/dashboard/customer/account-settings"
import { TELEGRAM_BOT_URL } from "@/lib/roles"
import type { EventWithRelations } from "@/lib/queries"

export type CustomerZoneClientProps = {
  upcomingEvents: EventWithRelations[]
}

type SubTab = "tickets" | "reviews" | "settings" | "shows"

export function CustomerZoneClient({ upcomingEvents }: CustomerZoneClientProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("tickets")

  const tabs = [
    { id: "tickets" as const, label: "تذاكري وحجوزاتي", icon: Ticket },
    { id: "reviews" as const, label: "تعليقاتي وتقييماتي", icon: MessageSquare },
    { id: "settings" as const, label: "إعدادات الحساب والأمان", icon: Settings },
    { id: "shows" as const, label: "استكشاف العروض", icon: Sparkles },
  ]

  return (
    <div className="space-y-8">
      {/* ترويسة الحساب */}
      <CustomerStrip />

      {/* شريط التبويبات الرئيسي لمنطقة العميل */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* محتوى التبويب المختار */}
      <div className="transition-all duration-200">
        {activeTab === "tickets" && (
          <div className="space-y-8">
            <section>
              <h3 className="mb-4 font-serif text-lg font-bold">ملخص الحساب</h3>
              <CustomerTicketStats />
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
              <MyTickets hideHeading />
            </section>
          </div>
        )}

        {activeTab === "reviews" && (
          <section className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
            <div className="mb-5 border-b border-border/40 pb-4">
              <h3 className="font-serif text-lg font-bold">تعليقاتي وتقييماتي الموثقة</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                كل الآراء والانطباعات التي تركتها على العروض المسرحية التي قمت بحضورها فعلياً.
              </p>
            </div>
            <CustomerReviews />
          </section>
        )}

        {activeTab === "settings" && (
          <section className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
            <div className="mb-5 border-b border-border/40 pb-4">
              <h3 className="font-serif text-lg font-bold">إعدادات الحساب وكلمة المرور</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                تعديل الاسم الشخصي لحسابك أو تغيير كلمة المرور لتسجيل الدخول بأمان.
              </p>
            </div>
            <CustomerAccountSettings />
          </section>
        )}

        {activeTab === "shows" && (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">عروض قادمة على كواليس</h3>
                <Link href="/shows" className="text-xs text-primary hover:underline">
                  عرض كل العروض
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {upcomingEvents.map((event) => (
                  <article
                    key={event.id}
                    className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
                      <Image
                        src={event.heroUrl ?? event.posterUrl ?? "/placeholder.svg"}
                        alt={`مشهد من عرض ${event.title}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-4">
                      <h4 className="font-serif text-base font-bold text-foreground group-hover:text-primary">
                        {event.title}
                      </h4>
                      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary/80" />
                        {formatDate(event.startsAt)}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary/80" />
                        {event.venue.name}، {event.venue.city}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                        <span className="text-xs text-muted-foreground">
                          تبدأ من{" "}
                          <strong className="font-serif text-sm font-bold text-foreground">
                            {formatPrice(Math.min(...event.priceTiers.map((tier) => tier.priceCents)))}
                          </strong>
                        </span>
                        <Link
                          href={`/shows/${event.slug}`}
                          className="inline-flex rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          احجز مقعدك
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#229ED9]/10 text-[#229ED9]">
                  <Send className="h-5 w-5" />
                </div>
                <h4 className="mt-3 font-serif text-base font-bold">تذكرتك على تليجرام</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  اربط حسابك ببوت كواليس لتستلم التذاكر الرقمية وبطاقات الدخول وتتابع مواعيد الحفلات من محادثة واحدة.
                </p>
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                  فتح بوت كواليس
                </a>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
