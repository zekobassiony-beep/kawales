"use client"

import { useSyncExternalStore } from "react"

/**
 * قناة إشعارات خفيفة (Toasts) لكل اللوحات.
 *
 * كان كل زر في مساحة العمل يعمل بصمت: ينجح أو يفشل بلا أي رسالة، فيظن المستخدم
 * أن الزر «لا يعمل». هذه القناة تُظهر نتيجة كل عملية (حفظ في الداتا، خطأ، …).
 */

export type ToastTone = "success" | "error" | "info"
export type Toast = { id: number; text: string; tone: ToastTone }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

export const TOAST_EVENT = "kawalees:toast"

function emit(): void {
  for (const listener of listeners) listener()
}

/** يضيف إشعارًا يختفي تلقائيًا بعد مدة. */
export function notify(text: string, tone: ToastTone = "info", timeoutMs = 4500): void {
  if (typeof window === "undefined" || !text) return
  const toast: Toast = { id: nextId++, text, tone }
  toasts = [...toasts, toast]
  emit()
  window.setTimeout(() => dismissToast(toast.id), timeoutMs)
}

export function dismissToast(id: number): void {
  const next = toasts.filter((toast) => toast.id !== id)
  if (next.length === toasts.length) return
  toasts = next
  emit()
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

const getSnapshot = (): Toast[] => toasts
const getServerSnapshot = (): Toast[] => toasts

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
