"use client"

import { useSyncExternalStore } from "react"

/**
 * أصوات «مفيد» على تقييمات الجمهور — مخزن محلي صغير (نفس نمط مخازن المنصة).
 */
const KEY = "kawalees:review-helpful"
const EVENT = "kawalees:review-helpful-change"

export type HelpfulState = Record<string, number>

let cachedRaw: string | null | undefined
let cachedState: HelpfulState = {}

function readHelpful(): HelpfulState {
  if (typeof window === "undefined") return cachedState
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      const parsed = raw ? JSON.parse(raw) : {}
      cachedState = parsed && typeof parsed === "object" ? (parsed as HelpfulState) : {}
    } catch {
      cachedState = {}
    }
  }
  return cachedState
}

/** يزيد عدد أصوات «مفيد» لتقييم معيّن. */
export function markHelpful(reviewId: string): void {
  const next = { ...readHelpful(), [reviewId]: (readHelpful()[reviewId] ?? 0) + 1 }
  cachedState = next
  cachedRaw = JSON.stringify(next)
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, cachedRaw)
  } catch {
    // تخزين معطّل — نكمل بالذاكرة.
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

/** حالة أصوات «مفيد» الحيّة لكل التقييمات. */
export function useHelpfulReviews(): HelpfulState {
  return useSyncExternalStore(subscribe, readHelpful, () => cachedState)
}
