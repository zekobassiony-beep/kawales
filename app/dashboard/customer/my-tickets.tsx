"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Loader2, QrCode as QrCodeIcon, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { SectionTitle, StatusBadge } from "@/app/dashboard/ui"
import { QrCode } from "@/components/qr-code"
import { SocialShareButton } from "@/components/social-share-button"
import { useSession } from "@/lib/session"
import {
  TICKET_STATUS_LABELS,
  formatCheckInTime,
  getTicketsForUser,
  paymentMethodLabel,
  splitTickets,
  startTicketStatusPolling,
  telegramTicketLink,
  useTickets,
  type Ticket as LocalTicket,
} from "@/lib/tickets"

/**
 * قسم «تذاكري وحجوزاتي» في لوحة العميل:
 * يعرض التذاكر القادمة والسابقة من مخزن `lib/tickets`، والضغط على أي
 * تذكرة يعرض الـ QR Code والتفاصيل الكاملة بمرونة تفاعلية.
 */
export function MyTickets() {
  const session = useSession()
  const tickets = useTickets()
  const viewerEmail = session?.email ?? ""
  const mine = useMemo(() => getTicketsForUser(viewerEmail), [tickets, viewerEmail])
  const { upcoming, past } = useMemo(() => splitTickets(mine), [mine])
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming")
  const [openId, setOpenId] = useState<string | null>(null)
  const pendingCount = mine.filter((ticket) => ticket.status === "pending_telegram").length

  /* تحديث تلقائي لحالة التذاكر لحظة اعتماد الأوتوميشن للتحويل. */
  useEffect(() => {
    if (pendingCount === 0) return
    return startTicketStatusPolling(4000)
  }, [pendingCount])

  const shown = tab === "upcoming" ? upcoming : past

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>تذاكري وحجوزاتي</SectionTitle>
        <div className="flex gap-2">
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")}>
            القادمة ({upcoming.length})
          </TabButton>
          <TabButton active={tab === "past"} onClick={() => setTab("past")}>
            السابقة ({past.length})
          </TabButton>
        </div>
      </div>

      {pendingCount > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-100">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" />
          {pendingCount} تذكرة بانتظار إثبات التحويل عبر بوت التليجرام — جاري التحقق الآلي، وستتحول إلى «مؤكدة» تلقائيًا مع
          رمز QR.
        </p>
      )}

      {viewerEmail.length === 0 && (
        <p className="rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          سجّل الدخول لربط تذاكرك بحسابك، أو ستجد تذاكر «الضيف» بعد أول عملية شراء من هذا المتصفح.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
          لا توجد تذاكر {tab === "upcoming" ? "قادمة" : "سابقة"} — تصفح العروض واحجز تذكرتك بالدفع المباشر.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((ticket) => (
            <TicketButton
              key={ticket.id}
              ticket={ticket}
              open={openId === ticket.id}
              onToggle={() => setOpenId((current) => (current === ticket.id ? null : ticket.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** كروت أرقام العميل المحسوبة من مخزن التذاكر الحقيقي (بدل الأرقام الثابتة). */
export function CustomerTicketStats() {
  const session = useSession()
  const tickets = useTickets()
  const mine = useMemo(() => getTicketsForUser(session?.email ?? ""), [tickets, session?.email])
  const { upcoming } = useMemo(() => splitTickets(mine), [mine])
  const verified = mine.filter((ticket) => ticket.status === "verified").length
  const pending = mine.filter((ticket) => ticket.status === "pending_telegram").length
  const last = mine[0]

  const cards = [
    { label: "تذاكر مؤكدة", value: String(verified), hint: "رمز QR جاهز للبوابة" },
    { label: "بانتظار إثبات التليجرام", value: String(pending), hint: "تحقق آلي بلا مراجعة يدوية" },
    { label: "عروض قادمة", value: String(upcoming.length), hint: "من تذاكرك المحفوظة" },
    { label: "آخر تذكرة", value: last?.id ?? "—", hint: last?.showTitle ?? "لا تذاكر بعد" },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-1 font-serif text-2xl font-bold" dir={card.label === "آخر تذكرة" ? "ltr" : undefined}>
            {card.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
        </div>
      ))}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary/60 bg-primary/10" : "border-border/60 text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  )
}

function TicketButton({ ticket, open, onToggle }: { ticket: LocalTicket; open: boolean; onToggle: () => void }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        open ? "border-primary/50" : "border-border/60 hover:border-primary/30",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-4 text-right">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Ticket className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{ticket.showTitle}</span>
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {ticket.venue} · {ticket.startsAt}
          </span>
          <span className="mt-1 block font-mono text-xs text-primary">{ticket.id}</span>
        </span>
        <StatusBadge tone={ticket.status === "pending_telegram" ? "amber" : "green"}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </StatusBadge>
      </button>
      {open && <TicketDetails ticket={ticket} />}
    </div>
  )
}

function TicketDetails({ ticket }: { ticket: LocalTicket }) {
  const admitted = ticket.status !== "pending_telegram"
  const verified = admitted
  const botLink = telegramTicketLink(ticket.id)
  return (
    <div className="space-y-3 border-t border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ul className="min-w-0 space-y-1 text-xs text-muted-foreground">
          <li><span className="font-medium text-foreground">الكود:</span> <span className="font-mono" dir="ltr">{ticket.id}</span></li>
          <li><span className="font-medium text-foreground">المقاعد:</span> {ticket.seats.join("، ")}</li>
          <li><span className="font-medium text-foreground">الفئة:</span> {ticket.tierName}</li>
          <li><span className="font-medium text-foreground">الإجمالي:</span> {formatPrice(ticket.totalCents)}</li>
          <li><span className="font-medium text-foreground">الدفع:</span> {paymentMethodLabel(ticket.paymentMethod)}</li>
          <li><span className="font-medium text-foreground">مرجع التحويل:</span> {ticket.paymentRef}</li>
          {ticket.verifiedAt && (
            <li className="text-emerald-300">
              اعتماد آلي عبر {ticket.verifiedVia === "sms" ? "SMS" : "التليجرام"}:{" "}
              {new Date(ticket.verifiedAt).toLocaleString("ar-EG")}
            </li>
          )}
          {ticket.checkedInAt && (
            <li className="text-emerald-300">
              تم حضورك عند البوابة في {formatCheckInTime(ticket.checkedInAt)} — يمكنك الآن تقييم العرض 🎭
            </li>
          )}
        </ul>
        <div className="flex flex-col items-center gap-1">
          {verified ? (
            <>
              <QrCode payload={ticket.qrCode} size={96} />
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <QrCodeIcon className="h-3 w-3" />
                اعرضه عند البوابة
              </span>
            </>
          ) : (
            <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground">
              <Clock className="h-4 w-4" />
              رمز QR
              <span>يُفتح بعد اعتماد البوت</span>
            </div>
          )}
        </div>
      </div>

      {!verified && (
        <div className="space-y-2">
          <a
            href={botLink}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white transition-opacity hover:opacity-90",
              ticket.paymentMethod === "vodafone_cash" ? "bg-red-600" : "bg-sky-500",
            )}
          >
            أكمل التحويل وإرسال الإثبات عبر التليجرام 📲
          </a>
          <p className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-2.5 text-[11px] text-sky-100">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" />
            جاري التحقق الآلي من التحويل عبر التليجرام… تُحدَّث الحالة هنا تلقائيًا فور الاعتماد.
          </p>
        </div>
      )}

      {verified && (
        <SocialShareButton
          label="شارك حضورك 🎭"
          data={{
            mode: "customer",
            showTitle: ticket.showTitle,
            posterUrl: ticket.posterUrl,
            customerName: ticket.customerName,
            seatLabel: ticket.seats.join("، "),
            dateLabel: ticket.startsAt,
            venueLabel: ticket.venue,
            footnote: `تذكرة ${ticket.id}`,
          }}
        />
      )}
    </div>
  )
}

