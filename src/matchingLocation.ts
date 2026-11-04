export type MatchLocation = { lat: number; lng: number }
const KEY = 'baef-match-origin-v1'
export function validMatchLocation(value: unknown): value is MatchLocation {
  const p=value as MatchLocation|null
  return !!p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180
}
export function savedMatchLocation(): MatchLocation|null {
  try { const p:unknown=JSON.parse(localStorage.getItem(KEY)??'null');return validMatchLocation(p)?p:null } catch { return null }
}
export function storeMatchLocation(p:MatchLocation|null) {
  try { if(p)localStorage.setItem(KEY,JSON.stringify(p));else localStorage.removeItem(KEY) } catch { /* Keep the choice in memory. */ }
}
