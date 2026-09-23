import { checkAdminAccess, listAdminEmails } from "@/lib/auth"
import { AdminConsole } from "@/app/dashboard/admin/admin-console"
import { NoAccessPanel } from "@/app/dashboard/admin/no-access"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة السوبر أدمن — كواليس",
  description: "إدارة المسؤولين، الحجوزات، وصلاحيات الدخول إلى لوحة التحكم العليا.",
  robots: { index: false, follow: false },
}

/**
 * لوحة السوبر أدمن (`/dashboard/admin`):
 *  - الوسيط `middleware.ts` يحمي المسار قبل الوصول (جلسة + كون البريد أدمن).
 *  - هذه الصفحة تُجري تحققًا ثانيًا على السيرفر بمفتاح الخدمة (طبقة حماية إضافية)
 *    وتُظهر شاشة 403 عند عدم الصلاحية.
 */
export default async function AdminDashboardPage() {
  const access = await checkAdminAccess()

  if (!access.allowed) {
    return <NoAccessPanel email={access.email} />
  }

  const list = await listAdminEmails()

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <AdminConsole
        emails={list.emails}
        tableReady={list.tableReady}
        adminEmail={access.email}
        isMaster={access.master}
      />
    </div>
  )
}
