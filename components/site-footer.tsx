import Link from "next/link"
import { Drama } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Drama className="h-4 w-4" />
              </span>
              <span className="font-serif text-lg font-semibold">كواليس</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              المسرح خلف الكواليس. اكتشف الفرق المسرحية المصرية واحجز مقعدك قبل
              أن يُرَفَع الستار.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              title="تصفّح"
              links={[
                { label: "كل العروض", href: "/shows" },
                { label: "الفرق", href: "/#troupes" },
                { label: "كيف يعمل", href: "/#how-it-works" },
              ]}
            />
            <FooterCol
              title="الدعم"
              links={[
                { label: "مركز المساعدة", href: "/shows" },
                { label: "سياسة الاسترجاع", href: "/shows" },
                { label: "تواصل معنا", href: "/shows" },
              ]}
            />
            <FooterCol
              title="المنصة"
              links={[
                { label: "من نحن", href: "/#how-it-works" },
                { label: "الوظائف", href: "/shows" },
                { label: "الصحافة", href: "/shows" },
              ]}
            />
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} كواليس — جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
