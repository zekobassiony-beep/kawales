"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, Clapperboard, Drama, LayoutDashboard, LogIn, LogOut, Theater, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LOGIN_PATH, ROLE_LABELS, dashboardPathForUser, signOut, useSession } from "@/lib/session"

/** البيانات التي يجهّزها الـ Server Component (`site-header.tsx`) للقائمة الجانبية. */
export type SiteHeaderNavData = {
  categories: string[]
  troupes: { name: string; city: string | null; showsCount: number }[]
  venues: { name: string; city: string; showsCount: number }[]
}

type DrawerSectionKey = "shows" | "troupes" | "venues"

/** صياغة عدد العروض بالعربية بنفس أسلوب `lib/format.ts`. */
function showsLabel(count: number): string {
  if (count === 0) return "لا عروض"
  if (count === 1) return "عرض واحد"
  if (count === 2) return "عرضان"
  if (count <= 10) return `${count} عروض`
  return `${count} عرضًا`
}

/** قسم أكورديون داخل القائمة الجانبية (فتح/إغلاق انسيابي). */
function DrawerSection({
  id,
  icon,
  label,
  hint,
  open,
  onToggle,
  children,
}: {
  id: string
  icon: React.ReactNode
  label: string
  hint?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
      >
        <span className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {label}
        </span>
        <span className="flex items-center gap-2">
          {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <div
        id={`${id}-panel`}
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <ul className="space-y-1 px-2 pb-3">{children}</ul>
        </div>
      </div>
    </div>
  )
}

/** رابط داخل القائمة الجانبية — يُغلق القائمة فور النقر. */
function DrawerLink({
  href,
  label,
  hint,
  onClick,
}: {
  href: string
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {hint && <span className="shrink-0 text-[11px] text-muted-foreground/80">{hint}</span>}
      </Link>
    </li>
  )
}

/** صورة الحساب: الصورة إن توفّرت وإلا الحرفان الأولان من الاسم. */
function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-secondary text-xs font-semibold text-secondary-foreground">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- صورة حساب خارجية بسيطة بلا تحسين مطلوب
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials || "ك"
      )}
    </span>
  )
}

/** الهيدر + القائمة الجانبية (تُصيَّر خارج `<header>` لأن backdrop-blur يكسر تمركز fixed). */
export function SiteHeaderClient({ nav }: { nav: SiteHeaderNavData }) {
  const [open, setOpen] = useState(false)
  const [openSection, setOpenSection] = useState<DrawerSectionKey | null>(null)
  const user = useSession()
  const router = useRouter()
  const drawerId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const dashboardHref = dashboardPathForUser(user)

  /** إغلاق القائمة مع إعادة التركيز إلى الزر الذي فتحها. */
  const closeDrawer = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const toggleSection = (key: DrawerSectionKey) =>
    setOpenSection((current) => (current === key ? null : key))

  const handleSignOut = () => {
    signOut()
    setOpen(false)
    router.refresh()
  }

  // Escape يغلق القائمة + منع تمرير الصفحة خلفها أثناء الفتح.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* الجهة اليمنى: الشعار ثم زر الثلاث شرط */}
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Drama className="h-5 w-5" />
              </span>
              <span className="font-serif text-xl font-semibold tracking-tight">كواليس</span>
            </Link>

            <button
              ref={triggerRef}
              type="button"
              onClick={() => (open ? closeDrawer() : setOpen(true))}
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={open}
              aria-controls={drawerId}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex h-4 w-5 flex-col items-center justify-center gap-1">
                <span
                  className={cn(
                    "h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out",
                    open && "translate-y-[6px] rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ease-out",
                    open && "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out",
                    open && "-translate-y-[6px] -rotate-45",
                  )}
                />
              </span>
            </button>
          </div>

          {/* روابط سطح المكتب — القائمة الجانبية متاحة على كل المقاسات */}
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/shows" className="transition-colors hover:text-foreground">
              العروض
            </Link>
            <Link href="/#troupes" className="transition-colors hover:text-foreground">
              الفرق
            </Link>
            <Link href="/#how-it-works" className="transition-colors hover:text-foreground">
              كيف يعمل
            </Link>
          </nav>

          {/* الجهة اليسرى: الدخول أو الحساب + الخروج */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  href={dashboardHref}
                  title="لوحة التحكم"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">لوحة التحكم</span>
                </Link>
                <Link
                  href={dashboardHref}
                  title="اللوحة الشخصية"
                  className="flex items-center gap-2 rounded-full p-0.5 transition-opacity hover:opacity-90"
                >
                  <UserAvatar name={user.name} avatarUrl={user.profile.avatarUrl || null} />
                  <span className="hidden text-right text-sm leading-tight sm:block">
                    <span className="block font-medium">{user.name}</span>
                    <span className="block text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">تسجيل الخروج</span>
                </button>
              </>
            ) : (
              <Link
                href={LOGIN_PATH}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* القائمة الجانبية (Drawer): تخرج من اليمين بعرض 340–360px */}
      <div
        id={drawerId}
        className={cn(
          "fixed inset-0 z-[60] transition-all duration-300",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={closeDrawer}
          className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="التنقل في كواليس"
          tabIndex={-1}
          style={{ transform: open ? "translate3d(0,0,0)" : "translate3d(100%,0,0)" }}
          className="absolute inset-y-0 right-0 flex w-[340px] max-w-[85vw] flex-col overflow-y-auto border-l border-border/60 bg-card shadow-2xl shadow-black/50 outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[360px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3.5">
            <Link href="/" onClick={closeDrawer} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Drama className="h-5 w-5" />
              </span>
              <span className="font-serif text-lg font-semibold tracking-tight">كواليس</span>
            </Link>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="إغلاق القائمة"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav aria-label="أقسام الموقع" className="flex-1 space-y-2 px-4 py-5">
            <DrawerSection
              id="drawer-shows"
              icon={<Clapperboard className="h-4 w-4" />}
              label="العروض"
              hint={nav.categories.length > 0 ? `${nav.categories.length} فئة` : undefined}
              open={openSection === "shows"}
              onToggle={() => toggleSection("shows")}
            >
              {nav.categories.map((category) => (
                <DrawerLink
                  key={category}
                  href={`/shows?category=${encodeURIComponent(category)}`}
                  label={category}
                  onClick={closeDrawer}
                />
              ))}
              {nav.categories.length === 0 && (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">لا توجد فئات متاحة حاليًا.</li>
              )}
            </DrawerSection>

            <DrawerSection
              id="drawer-troupes"
              icon={<Users className="h-4 w-4" />}
              label="الفرق"
              hint={nav.troupes.length > 0 ? "الأعلى ترتيبًا" : undefined}
              open={openSection === "troupes"}
              onToggle={() => toggleSection("troupes")}
            >
              {nav.troupes.map((troupe) => (
                <DrawerLink
                  key={troupe.name}
                  href={`/shows?q=${encodeURIComponent(troupe.name)}`}
                  label={troupe.name}
                  hint={troupe.city ? `${troupe.city} · ${showsLabel(troupe.showsCount)}` : showsLabel(troupe.showsCount)}
                  onClick={closeDrawer}
                />
              ))}
              {nav.troupes.length === 0 && (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">لا توجد فرق مسجّلة بعد.</li>
              )}
            </DrawerSection>

            <DrawerSection
              id="drawer-venues"
              icon={<Theater className="h-4 w-4" />}
              label="المسارح"
              hint={nav.venues.length > 0 ? "الأعلى ترتيبًا" : undefined}
              open={openSection === "venues"}
              onToggle={() => toggleSection("venues")}
            >
              {nav.venues.map((venue) => (
                <DrawerLink
                  key={venue.name}
                  href={`/shows?q=${encodeURIComponent(venue.name)}`}
                  label={venue.name}
                  hint={`${venue.city} · ${showsLabel(venue.showsCount)}`}
                  onClick={closeDrawer}
                />
              ))}
              {nav.venues.length === 0 && (
                <li className="px-2.5 py-2 text-sm text-muted-foreground">لا توجد مسارح مسجّلة بعد.</li>
              )}
            </DrawerSection>

            <Link
              href={dashboardHref}
              onClick={closeDrawer}
              className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                اللوحة الشخصية
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {user ? ROLE_LABELS[user.role] : "سجّل الدخول أولًا"}
              </span>
            </Link>
          </nav>

          <div className="flex items-center gap-5 border-t border-border/60 px-4 py-4 text-sm text-muted-foreground">
            <Link href="/" onClick={closeDrawer} className="transition-colors hover:text-foreground">
              الرئيسية
            </Link>
            <Link href="/#how-it-works" onClick={closeDrawer} className="transition-colors hover:text-foreground">
              كيف يعمل
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
