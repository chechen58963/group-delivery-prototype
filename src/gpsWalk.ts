import { WALK_ORDER_MAX_METERS } from './walkRewards'

export type WalkFix = { lat: number; lng: number; accuracy: number; time: number }
export type WalkTrack = { meters: number; anchor: WalkFix | null; fixes: number }
export const emptyWalkTrack = (): WalkTrack => ({ meters: 0, anchor: null, fixes: 0 })
export function fixDistance(a: WalkFix, b: WalkFix) {
  const rad = (n: number) => n * Math.PI / 180
  const v = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, v))))
}
// Ignore noisy fixes, stationary jitter, fast travel and gaps in foreground recording.
export function appendWalkFix(track: WalkTrack, fix: WalkFix, now = Date.now()): WalkTrack {
  if (![fix.lat,fix.lng,fix.accuracy,fix.time].every(Number.isFinite) || Math.abs(fix.lat)>90 || Math.abs(fix.lng)>180 || fix.accuracy<=0 || fix.accuracy>35 || now-fix.time>15000 || fix.time>now+2000) return track
  const previous = track.anchor
  if (!previous) return { ...track, anchor: fix, fixes: track.fixes+1 }
  const seconds = (fix.time-previous.time)/1000
  if (seconds<=0) return track
  if (seconds>30) return { ...track, anchor: fix, fixes: track.fixes+1 }
  const distance = fixDistance(previous, fix)
  if (distance/seconds>3) return { ...track, anchor: fix, fixes: track.fixes+1 }
  if (distance<Math.max(8,(previous.accuracy+fix.accuracy)/2)) return track
  return { meters: Math.min(WALK_ORDER_MAX_METERS, track.meters+distance), anchor: fix, fixes: track.fixes+1 }
}
