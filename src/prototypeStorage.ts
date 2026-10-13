import type { Post, Transaction } from "./workflow"
import type { Review, UserReport } from "./FlowContext"

const KEY = "group-delivery-campus-v1"
export type PrototypeSnapshot = {
  posts: Post[]; selectedId: number; tx: Transaction | null; completed: Transaction[];
  reviews: Record<number, Record<string, Review>>; myLocation: string; clockOffset: number;
  suspensionUntil: number; couponUsed: boolean; reports: UserReport[];
}
type StorageLike = Pick<Storage, "getItem" | "setItem">
const validPost = (p: Post) => p && Number.isFinite(p.id) && typeof p.restaurant === "string" && typeof p.category === "string" && Number.isFinite(p.distance) && typeof p.deadline === "string"
const validTx = (t: Transaction) => t && validPost(t.post) && Array.isArray(t.people) && t.people.some(p => p.id === "me") && t.people.every(p => Array.isArray(p.items) && p.quantities && p.location) && Array.isArray(t.messages) && t.lateReports && t.decisions
export function loadSnapshot(storage?: StorageLike): PrototypeSnapshot | null {
  try {
    const data = JSON.parse((storage ?? window.localStorage).getItem(KEY) ?? "null")
    if (!data || !Array.isArray(data.posts) || !data.posts.length || !data.posts.every(validPost) || (data.tx !== null && !validTx(data.tx)) || !Array.isArray(data.completed) || !data.completed.every(validTx) || !data.reviews || !Array.isArray(data.reports) || typeof data.myLocation !== "string" || !Number.isFinite(data.clockOffset) || !Number.isFinite(data.suspensionUntil) || !Number.isFinite(data.selectedId) || typeof data.couponUsed !== "boolean") return null
    return data
  } catch { return null }
}
export function saveSnapshot(data: PrototypeSnapshot, storage?: StorageLike): boolean {
  try { (storage ?? window.localStorage).setItem(KEY, JSON.stringify(data)); return true }
  catch { return false }
}
