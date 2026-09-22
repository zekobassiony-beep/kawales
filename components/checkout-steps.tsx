"use client"

import { useState } from "react"
import { Armchair, Check, Clock, Copy, Minus, Plus, Ticket as TicketIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, rowLabel, tierForRow } from "@/lib/format"
import { MAX_SEATS_PER_BOOKING, hexToRgba } from "@/lib/seats"
import type { EventWithRelations } from "@/lib/queries"
import { QrCode } from "@/components/qr-code"
import { SocialShareButton } from "@/components/social-share-button"
import { TicketUtilityButtons } from "@/components/ticket-utilities"
import { usePaymentMethods } from "@/lib/payment-methods"
import {
  TICKET_STATUS_LABELS,
  paymentMethodLabel,
  type PaymentMethod,
  type Ticket,
} from "@/lib/tickets"

/**
 * خطوات منظومة الحجز والدفع المباشر:
 * اختيار المقاعد/الفئات، الدفع المباشر (فودافون كاش/انستا باي)، وتأكيد التذكرة.
 */

const FIELD_CLASS = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/** يقرأ ملف صورة كـ data URL (Base64) لإرساله للإدارة. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"))
    reader.readAsDataURL(file)
  })
}

/* ---------- الخطوة 1: اختيار المقاعد (كراسي محددة) ---------- */

export function NumberedSeats({
  event,
  selected,
  onToggle,
}: {
  event: EventWithRelations
  selected: string[]
  onToggle: (seatId: string) => void
}) {
  const tiers = event.priceTiers
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Armchair className="h-4 w-4 text-primary" />
        خريطة المسرح — اختر كراسيّك بالضغط عليها
      </h3>

      {/* دليل الفئات والأسعار */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {tiers.map((tier) => (
          <span key={tier.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-[11px]">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: tier.color }} />
            <span className="font-medium">{tier.name}</span>
            <span className="text-muted-foreground">{formatPrice(tier.priceCents)}</span>
          </span>
        ))}
        {tiers.length === 0 && <span className="text-[11px] text-muted-foreground">لا فئات أسعار متاحة.</span>}
      </div>

      <div className="mx-auto mb-4 mt-4 max-w-md">
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <p className="mt-2 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">المسرح</p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-max space-y-1.5">
          {Array.from({ length: event.venue.rows }, (_, rowIndex) => {
            const tier = tierForRow(tiers, rowIndex)
            const color = tier?.color ?? "#c9a227"
            const tint = hexToRgba(color, 0.16)
            const border = hexToRgba(color, 0.5)
            return (
              <div key={rowIndex} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">{rowLabel(rowIndex)}</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: event.venue.seatsPerRow }, (_, seatIndex) => {
                    const seatId = `${rowLabel(rowIndex)}${seatIndex + 1}`
                    const isSelected = selected.includes(seatId)
                    return (
                      <button
                        key={seatId}
                        type="button"
                        title={`${seatId} · ${tier?.name ?? "—"} · ${tier ? formatPrice(tier.priceCents) : ""}`}
                        aria-pressed={isSelected}
                        aria-label={`المقعد ${seatId} — ${tier?.name ?? "—"}`}
                        onClick={() => onToggle(seatId)}
                        style={
                          isSelected
                            ? { backgroundColor: color, borderColor: color, color: "#0b1020" }
                            : { backgroundColor: tint, borderColor: border }
                        }
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[9px] font-semibold transition-all duration-150",
                          isSelected ? "scale-110 ring-2 ring-white/60" : "hover:scale-110 hover:brightness-125",
                        )}
                      >
                        {seatIndex + 1}
                      </button>
                    )
                  })}
                </div>
                <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">{rowLabel(rowIndex)}</span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">يمكنك اختيار حتى {MAX_SEATS_PER_BOOKING} مقاعد لكل حجز.</p>
    </div>
  )
}

/* ---------- الخطوة 1: اختيار الفئات (فئات مفتوحة) ---------- */

export function GeneralAdmissionTiers({
  event,
  quantities,
  onSet,
}: {
  event: EventWithRelations
  quantities: Record<string, number>
  onSet: (tierId: string, quantity: number) => void
}) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <TicketIcon className="h-4 w-4 text-primary" />
        اختر عدد التذاكر لكل فئة
      </h3>
      {event.priceTiers.map((tier, index) => {
        const remaining = Math.max(4, 40 - ((event.id * (index + 3) * 7) % 25))
        const quantity = quantities[tier.id] ?? 0
        const lessThanLimit = quantity >= Math.min(remaining, MAX_SEATS_PER_BOOKING)
        const onLess = () => onSet(tier.id, Math.max(0, quantity - 1))
        const onMore = () => onSet(tier.id, Math.min(remaining, MAX_SEATS_PER_BOOKING, quantity + 1))
        return (
          <div key={tier.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div>
              <p className="text-sm font-semibold">{tier.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatPrice(tier.priceCents)} للتذكرة · متبقٍ {remaining} تذكرة
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={tier.name}
                disabled={quantity === 0}
                onClick={onLess}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 transition-colors hover:bg-secondary disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center font-serif text-lg font-bold">{quantity}</span>
              <button
                type="button"
                aria-label={tier.name}
                disabled={lessThanLimit}
                onClick={onMore}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 transition-colors hover:bg-secondary disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- الخطوة 2: وسائل الدفع المباشرة ---------- */

export function PaymentStep({
  totalCents,
  method,
  onChange,
  paymentRef,
  onRefChange,
  senderPhone,
  onSenderPhoneChange,
  receiptImage,
  onReceiptChange,
}: {
  totalCents: number
  method: PaymentMethod
  onChange: (method: PaymentMethod) => void
  paymentRef: string
  onRefChange: (value: string) => void
  senderPhone: string
  onSenderPhoneChange: (value: string) => void
  receiptImage: string
  onReceiptChange: (value: string) => void
}) {
  const methods = usePaymentMethods().filter((item) => item.isActive)
  const selected = methods.find((item) => item.id === method) ?? methods[0] ?? null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">الخطوة 2 — اختر طريقة دفع مباشرة</h3>
      <p className="text-xs text-muted-foreground">
        المبلغ المطلوب:{" "}
        <span className="font-serif font-bold text-foreground">{formatPrice(totalCents)}</span>
      </p>

      {/* وسائل الدفع المفعّلة كأزرار Grid تفاعلية — تُنشأ تلقائيًا لأي وسيلة تُضاف من لوحة HQ. */}
      {methods.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((item) => (
            <PaymentMethodCard
              key={item.id}
              emoji={item.emoji}
              name={item.name}
              account={item.account}
              colorClass={item.colorClass}
              active={selected?.id === item.id}
              onSelect={() => onChange(item.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          لا توجد وسائل دفع مفعّلة حاليًا — تواصل مع فريق كواليس.
        </p>
      )}

      {selected && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn("block h-2.5 w-2.5 shrink-0 rounded-full", selected.colorClass)} />
              {selected.emoji} {selected.name}
            </p>
            <span className="text-[11px] text-muted-foreground">الوسيلة المختارة</span>
          </div>
          <p className="text-xs text-muted-foreground">{selected.instructions}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5">
            <span className="font-mono text-sm font-bold" dir="ltr">
              {selected.account}
            </span>
            <div className="flex gap-1.5">
              <CopyButton text={selected.account} />
              {selected.quickLinkUrl && (
                <a
                  href={selected.quickLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90",
                    selected.colorClass,
                  )}
                >
                  {selected.quickLinkLabel ?? "افتح التطبيق"}
                </a>
              )}
            </div>
          </div>
          <input
            type="text"
            value={paymentRef}
            onChange={(event) => onRefChange(event.target.value)}
            placeholder={selected.referenceLabel}
            className={FIELD_CLASS}
          />
          <input
            type="tel"
            value={senderPhone}
            onChange={(event) => onSenderPhoneChange(event.target.value)}
            placeholder="رقم الموبايل الذي تم التحويل منه"
            dir="ltr"
            className={FIELD_CLASS}
          />
          <div>
            <label className="block text-xs text-muted-foreground">إرفاق صورة إيصال التحويل / Screenshot</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const dataUrl = await readFileAsDataUrl(file)
                onReceiptChange(dataUrl)
              }}
              className="mt-1 w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none transition-colors file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground focus:border-primary"
            />
            {receiptImage ? (
              <p className="mt-1 text-[11px] text-emerald-300">تم إرفاق الإيصال ✓</p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">صورة واضحة للإيصال تسرّع مراجعة الإدارة.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** كارت/زر وسيلة دفع داخل الشبكة — يُبرز هويته اللونية عند اختياره فورًا. */
function PaymentMethodCard({
  emoji,
  name,
  account,
  colorClass,
  active,
  onSelect,
}: {
  emoji: string
  name: string
  account: string
  colorClass: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-xl border-2 p-4 text-right transition-all",
        active ? "border-primary bg-primary/10 shadow-lg" : "border-border/60 bg-card hover:border-primary/40 hover:bg-secondary/40",
      )}
    >
      <span className={cn("absolute inset-y-0 start-0 w-1.5", colorClass)} aria-hidden="true" />
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg", colorClass)}>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {name}
          {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
          {account}
        </span>
      </span>
    </button>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const labelText = text
  const doCopy = async () => {
    await navigator.clipboard.writeText(labelText).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  return (
    <button
      type="button"
      aria-label={labelText}
      title={labelText}
      onClick={doCopy}
      className="shrink-0 rounded border border-border/60 p-1 text-muted-foreground transition-colors hover:bg-secondary"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}



/* ---------- الخطوة 3: مراجعة إيصال التحويل من الإدارة ---------- */

export function TicketConfirmation({
  ticket,
  onSimulateApproval,
  onSimulateRejection,
}: {
  ticket: Ticket
  /** محاكاة قرار الإدارة — للعرض والاختبار فقط. */
  onSimulateApproval?: () => void
  onSimulateRejection?: () => void
}) {
  const admitted = ticket.status === "approved" || ticket.status === "checked_in"
  const pending = ticket.status === "pending"
  const rejected = ticket.status === "rejected"

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">الخطوة 3 — مراجعة إيصال التحويل</h3>

      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4 text-xs",
          admitted
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : rejected
              ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200",
        )}
      >
        {admitted ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
        ) : pending ? (
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <X className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <p>
          {admitted
            ? "تم قبول حجزك — رمز الـ QR فعّال الآن، احتفظ به للبوابة."
            : rejected
              ? "تم رفض الحجز ❌ — تواصل مع الدعم لمراجعة إيصال التحويل."
              : "تذكرتك محفوظة بحالة «قيد المراجعة». جاري مراجعة إيصال التحويل من قبل الإدارة ⏳ — سيُفعَّل رمز QR فور القبول."}
        </p>
      </div>

      <TicketCard ticket={ticket} />

      <TicketUtilityButtons ticket={ticket} />

      {admitted && (
        <SocialShareButton
          label="شارك حضورك 🎭"
          className="w-full"
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

      {pending && (onSimulateApproval || onSimulateRejection) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">محاكاة قرار الإدارة (للتجربة):</span>
          {onSimulateApproval && (
            <button
              type="button"
              onClick={onSimulateApproval}
              className="rounded-full border border-emerald-500/50 px-3 py-1 text-[11px] text-emerald-200 transition-colors hover:bg-emerald-500/10"
            >
              قبول ✅
            </button>
          )}
          {onSimulateRejection && (
            <button
              type="button"
              onClick={onSimulateRejection}
              className="rounded-full border border-destructive/50 px-3 py-1 text-[11px] text-destructive-foreground transition-colors hover:bg-destructive/10"
            >
              رفض ❌
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const admitted = ticket.status === "approved" || ticket.status === "checked_in"
  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-serif text-lg font-bold">{ticket.showTitle}</h4>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                admitted
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : ticket.status === "rejected"
                    ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-200",
              )}
            >
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticket.venue} · {ticket.startsAt}
          </p>
          <p className="mt-1 text-xs">
            <span className="font-medium">الكود:</span>{" "}
            <span className="font-mono text-primary" dir="ltr">
              {ticket.id}
            </span>
          </p>
          <p className="text-xs">
            <span className="font-medium">المقاعد:</span> {ticket.seats.join("، ")}
          </p>
          <p className="text-xs">
            <span className="font-medium">الفئة:</span> {ticket.tierName} ·{" "}
            <span className="font-medium">الإجمالي:</span> {formatPrice(ticket.totalCents)}
          </p>
          <p className="text-xs">
            <span className="font-medium">طريقة الدفع:</span> {paymentMethodLabel(ticket.paymentMethod)}
          </p>
          {ticket.verifiedAt && (
            <p className="mt-1 text-[11px] text-emerald-300">
              تم القبول: {new Date(ticket.verifiedAt).toLocaleString("ar-EG")}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {admitted ? (
            <>
              <QrCode payload={ticket.qrCode} size={96} />
              <span className="text-[10px] text-muted-foreground">امسح عند البوابة</span>
            </>
          ) : (
            <div className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground">
              <Clock className="h-4 w-4" />
              رمز QR
              <span>يُفتح بعد قبول الإدارة</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

