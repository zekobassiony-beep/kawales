"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Loader2, QrCode as QrCodeIcon, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { SectionTitle, StatusBadge } from "@/app/dashboard/ui"
import { QrCode } from "@/components/qr-code"
import { SocialShareButton } from "@/components/social-share-button"
import { TicketModal } from "@/components/ticket-modal"
import { useSession } from "@/lib/session"
import { useServerTickets } from "@/components/use-server-tickets"
import {
  TICKET_STATUS_LABELS,
  formatCheckInTime,
  getTicketsForUser,
  paymentMethodLabel,
  splitTickets,
  startTicketStatusPolling,
  useTickets,
  type Ticket as LocalTicket,
} from "@/lib/tickets"

/**
 * قسم «تذاكري وحجوزاتي» في لوحة العميل:
 * يدمج التذاكر حيًا من Supabase (مصدر الحقيقة) مع المخزن المحلي كطبقة فورية،
 * والضغط على أي تذكرة يعرض الـ QR Code والتفاصيل الكاملة بمرونة تفاعلية.
 */
export function MyTickets() {
  const session = useSession()
  const tickets = useTickets()
  const viewerEmail = session?.email ?? ""
  const { tickets: serverTickets } = useServerTickets(viewerEmail)
  const mine = useMemo(() => {
    const local = getTicketsForUser(viewerEmail)
    if (serverTickets.length === 0) return local
    // سجل الخادم أولًا (مصدر الحقيقة) ثم المحلي غير المكرر.
    const merged = new Map<string, LocalTicket>()
    for (const ticket of serverTickets) merged.set(ticket.id, ticket as LocalTicket)
    for (const ticket of local) if (!merged.has(ticket.id)) merged.set(ticket.id, ticket)
    return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [tickets, viewerEmail, serverTickets])
  const { upcoming, past } = useMemo(() => splitTickets(mine), [mine])
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming")
  const [openId, setOpenId] = useState<string | null>(null)
  const pendingCount = mine.filter((ticket) => ticket.status === "pending").length

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
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-300" />
          {pendingCount} تذكرة بانتظار مراجعة إيصال التحويل من الإدارة — ستتحول إلى «مقبولة» فور اعتماد الإدارة.
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

/** كروت أرقام العميل المحسوبة من جدول التذاكر (Supabase) مع المخزن المحلي. */
export function CustomerTicketStats() {
  const session = useSession()
  const tickets = useTickets()
  const viewerEmail = session?.email ?? ""
  const { tickets: serverTickets } = useServerTickets(viewerEmail)
  const mine = useMemo(() => {
    const local = getTicketsForUser(viewerEmail)
    if (serverTickets.length === 0) return local
    const merged = new Map<string, LocalTicket>()
    for (const ticket of serverTickets) merged.set(ticket.id, ticket as LocalTicket)
    for (const ticket of local) if (!merged.has(ticket.id)) merged.set(ticket.id, ticket)
    return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [tickets, viewerEmail, serverTickets])
  const { upcoming } = useMemo(() => splitTickets(mine), [mine])
  const approved = mine.filter((ticket) => ticket.status === "approved" || ticket.status === "checked_in").length
  const pending = mine.filter((ticket) => ticket.status === "pending").length
  const last = mine[0]

  const cards = [
    { label: "تذاكر مقبولة", value: String(approved), hint: "رمز QR جاهز للبوابة" },
    { label: "بانتظار مراجعة الإيصال", value: String(pending), hint: "تراجعها الإدارة عبر التليجرام" },
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
        <StatusBadge tone={ticket.status === "pending" ? "amber" : ticket.status === "rejected" ? "red" : "green"}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </StatusBadge>
      </button>
      {open && <TicketDetails ticket={ticket} />}
    </div>
  )
}

function TicketDetails({ ticket }: { ticket: LocalTicket }) {
  const admitted = ticket.status === "approved" || ticket.status === "checked_in"
  const pending = ticket.status === "pending"
  const rejected = ticket.status === "rejected"
  const [qrOpen, setQrOpen] = useState(false)
  return (
    <div className="space-y-3 border-t border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ul className="min-w-0 space-y-1 text-xs text-muted-foreground">
          <li><span className="font-medium text-foreground">الكود:</span> <span className="font-mono" dir="ltr">{ticket.id}</span></li>
          <li><span className="font-medium text-foreground">المقاعد:</span> {ticket.seats.join("، ")}</li>
          <li><span className="font-medium text-foreground">الفئة:</span> {ticket.tierName}</li>
          <li><span className="font-medium text-foreground">الإجمالي:</span> {formatPrice(ticket.totalCents)}</li>
          <li><span className="font-medium text-foreground">الدفع:</span> {paymentMethodLabel(ticket.paymentMethod)}</li>
          {ticket.senderPhone && (
            <li><span className="font-medium text-foreground">رقم المحوّل:</span> <span dir="ltr">{ticket.senderPhone}</span></li>
          )}
          {ticket.verifiedAt && (
            <li className="text-emerald-300">
              تم القبول: {new Date(ticket.verifiedAt).toLocaleString("ar-EG")}
            </li>
          )}
          {ticket.checkedInAt && (
            <li className="text-emerald-300">
              تم حضورك عند البوابة في {formatCheckInTime(ticket.checkedInAt)} — يمكنك الآن تقييم العرض 🎭
            </li>
          )}
        </ul>
        <div className="flex flex-col items-center gap-1">
          {admitted ? (
            <>
              <QrCode
                payload={ticket.qrCode}
                size={104}
                onClick={() => setQrOpen(true)}
                title="اضغط لعرض الرمز بحجم كامل"
              />
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] text-primary transition-colors hover:underline"
              >
                <QrCodeIcon className="h-3 w-3" />
                عرض / تنزيل الرمز
              </button>
            </>
          ) : (
            <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground">
              <Clock className="h-4 w-4" />
              رمز QR
              <span>يُفتح بعد قبول الإدارة</span>
            </div>
          )}
        </div>
      </div>

      {ticket.receiptImage && (
        <div className="rounded-lg border border-border/60 bg-background/40 p-2">
          <p className="mb-1 text-[10px] text-muted-foreground">إيصال التحويل المرفق:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.receiptImage} alt="إيصال التحويل" className="max-h-40 rounded-md border border-border/60 object-contain" />
        </div>
      )}

      {pending && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-100">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-300" />
          جاري مراجعة إيصال التحويل من قبل الإدارة ⏳ — سيُفعَّل رمز QR فور القبول.
        </p>
      )}

      {rejected && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] text-destructive-foreground">
          تم رفض هذا الحجز ❌ — تواصل مع الدعم لمراجعة إيصال التحويل.
        </p>
      )}

      {admitted && (
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

      <TicketModal ticket={qrOpen ? ticket : null} onClose={() => setQrOpen(false)} />
    </div>
  )
}

