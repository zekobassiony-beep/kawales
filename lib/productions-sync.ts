"use client"

import { useSyncExternalStore } from "react"
import { notify } from "@/lib/toast"
import {
  WORKSPACE_CHANGE_EVENT,
  WORKSPACE_STORAGE_KEY,
  readWorkspace,
  type Production,
  type Workspace,
} from "@/lib/productions"
import {
  addAchievementAction,
  applyToAuditionAction,
  createAuditionAction,
  createProductionAction,
  inviteCrewAction,
  loadWorkspaceAction,
  removeAchievementAction,
  setApplicationStatusAction,
  setAuditionStatusAction,
  setCrewStatusAction,
  respondToInviteAction,
  updateProductionAction,
} from "@/app/actions/productions"

/**
 * مزامنة «مساحة العمل» مع Supabase.
 *
 * الواجهة تكتب محليًا (فوري — بلا انتظار الشبكة)، وهذا المحرك يلتقط كل تغيير
 * ويرفعه للسيرفر، فيصبح:
 *  - العمل المسرحي محفوظًا مع فئاته ومسرحه (والمسرح الخارجي كتابةً).
 *  - دعوات الطاقم تصل للفنان على أي جهاز.
 *  - الأودشن يُغلق ويُفتح **لايف** ويراه كل الفنانيين.
 * وكل نتيجة تظهر كإشعار نجاح/خطأ بدل الصمت.
 */

const EMPTY: Workspace = { productions: [], auditions: [], applications: [], achievements: [] }
const DEBOUNCE_MS = 400

let server: Workspace = EMPTY
let started = false
let internalWrite = false
let pushing = false
let timer: number | null = null

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const json = (value: unknown): string => JSON.stringify(value ?? null)

/* ---------- حالة المزامنة (تُعرض في بانر داخل اللوحات) ---------- */

export type WorkspaceSyncStatus = {
  /** هل جداول Supabase متاحة؟ false ⇒ الحفظ محلي فقط حتى تشغيل ملف الـSQL. */
  tableReady: boolean
  /** آخر رسالة خطأ (فارغة = لا مشاكل). */
  lastError: string
  /** وقت آخر مزامنة ناجحة (ISO) أو null. */
  lastSyncAt: string | null
}

let status: WorkspaceSyncStatus = { tableReady: true, lastError: "", lastSyncAt: null }
const statusListeners = new Set<() => void>()

function setStatus(patch: Partial<WorkspaceSyncStatus>): void {
  status = { ...status, ...patch }
  for (const listener of statusListeners) listener()
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

const getStatusSnapshot = (): WorkspaceSyncStatus => status

/** حالة الحفظ الدائم — تُستخدم في بانر التنبيه داخل اللوحات. */
export function useWorkspaceSyncStatus(): WorkspaceSyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusSnapshot)
}

/** هل هذا معرّف صادر من قاعدة البيانات (UUID) أم معرّف محلي مؤقت؟ */
export function isServerProductionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)
}

/**
 * ينتظر أن تُسند قاعدة البيانات معرّفًا حقيقيًا للعمل المنشور (بعد الإنشاء التلقائي).
 * يلزم قبل النشر العام: قاعدة العروض تحتاج مُعرّف الصفّ الحقيقي، لا المعرّف المحلي.
 */
export async function waitForPublishedId(title: string, timeoutMs = 4500): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = readWorkspace().productions.find(
      (production) => production.title === title && isServerProductionId(production.id),
    )
    if (found) return found.id
    await new Promise((resolve) => window.setTimeout(resolve, 250))
  }
  return null
}

/** يكتب لقطة محلية ويُبلغ الواجهة (بلا إعادة إرسالها للسيرفر). */
function writeLocal(workspace: Workspace): void {
  try {
    internalWrite = true
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
    window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT))
  } catch {
    // التخزين المحلي قد يكون معطّلًا — نتجاهل بأمان.
  } finally {
    internalWrite = false
  }
}

/** يستبدل المعرّفات المحلية المؤقتة بمعرّفات قاعدة البيانات بعد الإنشاء. */
function applyIdMap(map: Map<string, string>): void {
  if (map.size === 0) return
  const local = readWorkspace()
  const swap = (value: string): string => map.get(value) ?? value
  const next: Workspace = {
    productions: local.productions.map((production) => ({
      ...production,
      id: swap(production.id),
      crew: production.crew.map((member) => ({ ...member, id: swap(member.id) })),
    })),
    auditions: local.auditions.map((audition) => ({
      ...audition,
      id: swap(audition.id),
      productionId: audition.productionId ? swap(audition.productionId) : null,
    })),
    applications: local.applications.map((application) => ({
      ...application,
      id: swap(application.id),
      auditionId: swap(application.auditionId),
    })),
    achievements: local.achievements.map((achievement) => ({ ...achievement, id: swap(achievement.id) })),
  }
  writeLocal(next)
}

/** الحقول التي نزامنها للعمل المسرحي (وتُقارن للتغيير). */
function productionPatch(local: Production, remote?: Production): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const differs = (key: keyof Production): boolean =>
    !remote || json(remote[key]) !== json(local[key]) || remote[key] !== local[key]
  const scalarKeys: (keyof Production)[] = [
    "title",
    "posterUrl",
    "status",
    "venue",
    "venueKind",
    "venueCity",
    "seatingMode",
    "rows",
    "seatsPerRow",
    "capacity",
    "startsAt",
  ]
  for (const key of scalarKeys) {
    if (remote && remote[key] === local[key]) continue
    patch[key as string] = local[key]
  }
  const collectionKeys: (keyof Production)[] = ["tiers", "gallery", "blockedSeats", "showtimes"]
  for (const key of collectionKeys) {
    if (remote && json(remote[key]) === json(local[key])) continue
    patch[key as string] = local[key]
  }
  if (differs("status") && local.status) patch.status = local.status
  return patch
}

/** يقرأ مساحة العمل من السيرفر ويجعلها المصدر الظاهر في الواجهة. */
export async function hydrateWorkspaceFromServer(): Promise<boolean> {
  const payload = await loadWorkspaceAction()
  if (!payload.ok) {
    setStatus({ tableReady: payload.tableReady, lastError: payload.error ?? "" })
    if (!payload.tableReady && payload.error) notify(payload.error, "error", 8000)
    return false
  }
  server = payload.workspace
  setStatus({ tableReady: true, lastError: "", lastSyncAt: new Date().toISOString() })
  writeLocal(clone(payload.workspace))
  return true
}

function schedulePush(): void {
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = null
    void pushChanges()
  }, DEBOUNCE_MS)
}

function onStoreChange(): void {
  if (internalWrite) return
  schedulePush()
}

/** يبدأ المزامنة (تُستدعى مرة واحدة بعد تأكيد وجود جلسة). */
export function startWorkspaceSync(): void {
  if (started || typeof window === "undefined") return
  started = true
  window.addEventListener(WORKSPACE_CHANGE_EVENT, onStoreChange)
  void hydrateWorkspaceFromServer()
}

/** يوقف المزامنة (عند تسجيل الخروج). */
export function stopWorkspaceSync(): void {
  if (!started) return
  started = false
  window.removeEventListener(WORKSPACE_CHANGE_EVENT, onStoreChange)
  server = EMPTY
}

/** يرفع كل الفروق المحلية إلى السيرفر (مُخنَّق ومتسلسل). */
async function pushChanges(): Promise<void> {
  if (pushing) {
    schedulePush()
    return
  }
  pushing = true
  try {
    const local = readWorkspace()
    const idMap = new Map<string, string>()

    // ---------- الأعمال المسرحية ----------
    for (const production of local.productions) {
      const remote = server.productions.find((row) => row.id === production.id)
      let worksOnId = production.id

      if (!remote) {
        // عمل جديد: نُدرجه ثم نضيف بقية تفاصيله (المسرح/الفئات/نمط الحجز/المعرض).
        const created = await createProductionAction({ title: production.title, posterUrl: production.posterUrl })
        if (!created.ok || !created.data) {
          notify(created.error ?? "تعذّر حفظ العمل المسرحي.", "error")
          continue
        }
        const real = created.data
        idMap.set(production.id, real.id)
        worksOnId = real.id
        server.productions.push({ ...real, crew: [] })

        const patch = productionPatch({ ...production, id: real.id })
        delete patch.title
        delete patch.posterUrl
        if (Object.keys(patch).length > 0) {
          const updated = await updateProductionAction(real.id, patch)
          if (!updated.ok) notify(updated.error ?? "تعذّر حفظ تفاصيل العمل.", "error")
        }
        notify(`تم حفظ العمل «${production.title}» في حسابك ✓`, "success")
      } else {
        const patch = productionPatch(production, remote)
        if (Object.keys(patch).length > 0) {
          const updated = await updateProductionAction(production.id, patch)
          if (!updated.ok) {
            notify(updated.error ?? "تعذّر تحديث العمل المسرحي.", "error")
          } else {
            Object.assign(remote, patch)
          }
        }
      }

      // ---------- طاقم العمل ----------
      const remoteProduction = server.productions.find((row) => row.id === worksOnId)
      for (const member of production.crew) {
        const remoteMember = remoteProduction?.crew.find((row) => row.id === member.id)
        if (!remoteMember) {
          const invited = await inviteCrewAction({
            productionId: worksOnId,
            name: member.name,
            email: member.email,
            part: member.part,
          })
          if (!invited.ok || !invited.data) {
            notify(invited.error ?? "تعذّر إرسال الدعوة.", "error")
            continue
          }
          idMap.set(member.id, invited.data.id)
          remoteProduction?.crew.push(invited.data)
          notify(`أُرسلت دعوة «${member.name}» ✓`, "success")
        } else if (remoteMember.status !== member.status) {
          const updated = await setCrewStatusAction({
            productionId: worksOnId,
            memberId: member.id,
            status: member.status,
          })
          if (updated.ok) {
            remoteMember.status = member.status
          } else {
            // الفنان نفسه يقبل/يعتذر عن دعوته (لا يملك صلاحية تعديل العمل).
            const responded = await respondToInviteAction({
              memberId: member.id,
              decision: member.status === "accepted" ? "accepted" : "declined",
            })
            if (responded.ok) remoteMember.status = member.status
            else notify(responded.error ?? "تعذّر تحديث حالة العضوية.", "error")
          }
        }
      }
    }

    // ---------- الأودشنات ----------
    for (const audition of local.auditions) {
      const remote = server.auditions.find((row) => row.id === audition.id)
      if (!remote) {
        const created = await createAuditionAction({
          productionId:
            audition.productionId && idMap.has(audition.productionId)
              ? idMap.get(audition.productionId)
              : audition.productionId,
          title: audition.title,
          role: audition.role,
          requirements: audition.requirements,
          pay: audition.pay,
          venue: audition.venue,
          date: audition.date,
        })
        if (!created.ok || !created.data) {
          notify(created.error ?? "تعذّر نشر الأودشن.", "error")
          continue
        }
        idMap.set(audition.id, created.data.id)
        server.auditions.push(created.data)
        notify(`نُشر الأودشن «${audition.title}» — يراه الفنانون الآن ✓`, "success")
      } else if (remote.status !== audition.status) {
        const updated = await setAuditionStatusAction({ id: audition.id, status: audition.status })
        if (updated.ok) {
          remote.status = audition.status
          notify(audition.status === "open" ? "أُعيد فتح الأودشن ✓" : "أُغلق الأودشن ✓", "success")
        } else {
          notify(updated.error ?? "تعذّر تغيير حالة الأودشن.", "error")
        }
      }
    }

    // ---------- طلبات الأودشن ----------
    for (const application of local.applications) {
      const remote = server.applications.find((row) => row.id === application.id)
      if (!remote) {
        const applied = await applyToAuditionAction({
          auditionId: application.auditionId,
          profileUrl: application.profileUrl,
        })
        if (applied.ok) notify("أُرسل طلبك للأودشن ✓", "success")
        else notify(applied.error ?? "تعذّر إرسال الطلب.", "error")
      } else if (remote.status !== application.status) {
        const updated = await setApplicationStatusAction({
          applicationId: application.id,
          status: application.status,
        })
        if (updated.ok) remote.status = application.status
        else notify(updated.error ?? "تعذّر تحديث حالة الطلب.", "error")
      }
    }

    // ---------- إنجازات الفنان ----------
    for (const achievement of local.achievements) {
      if (server.achievements.some((row) => row.id === achievement.id)) continue
      const created = await addAchievementAction({
        kind: achievement.kind,
        title: achievement.title,
        organizer: achievement.organizer,
        year: achievement.year,
        link: achievement.link,
      })
      if (created.ok && created.data) {
        idMap.set(achievement.id, created.data.id)
        server.achievements.push(created.data)
      } else if (!created.ok) {
        notify(created.error ?? "تعذّر حفظ الإنجاز.", "error")
      }
    }
    for (const achievement of [...server.achievements]) {
      if (local.achievements.some((row) => row.id === achievement.id)) continue
      const removed = await removeAchievementAction({ id: achievement.id })
      if (removed.ok) server.achievements = server.achievements.filter((row) => row.id !== achievement.id)
    }

    // استبدال المعرّفات المؤقتة بمعرّفات قاعدة البيانات.
    applyIdMap(idMap)
    setStatus({ tableReady: true, lastError: "", lastSyncAt: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذّرت المزامنة مع السيرفر."
    setStatus({ lastError: message })
    notify(message, "error")
  } finally {
    pushing = false
  }
}

