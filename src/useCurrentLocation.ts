import { useCallback, useEffect, useRef, useState } from 'react'

export type CurrentCoordinates = { lat: number; lng: number; accuracy: number; updatedAt: number }
type LocationChoice = { label: string; source: 'default' | 'manual' | 'gps'; coordinates: CurrentCoordinates | null }
const KEY = 'group-delivery-current-location-v1'
function restore(fallback: string): LocationChoice {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as LocationChoice | null
    if (saved?.source === 'manual' && typeof saved.label === 'string' && saved.label.trim())
      return { label: saved.label, source: 'manual', coordinates: null }
    const c = saved?.coordinates
    if (saved?.source === 'gps' && c && Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180 && Number.isFinite(c.accuracy) && c.accuracy >= 0 && Number.isFinite(c.updatedAt))
      return { label: '현재 위치', source: 'gps', coordinates: c }
  } catch { /* Location remains usable without browser storage. */ }
  return { label: fallback === '현재 위치' ? '충남대학교 정문 주변' : fallback, source: 'default', coordinates: null }
}

export function useCurrentLocation(fallback: string) {
  const [choice, setChoice] = useState(() => restore(fallback))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const pending = useRef(false)
  const alive = useRef(true)
  const save = useCallback((next: LocationChoice) => {
    setChoice(next)
    try { sessionStorage.setItem(KEY, JSON.stringify(next)) } catch { /* Keep the current session in memory. */ }
  }, [])
  const request = useCallback(() => {
    if (pending.current) return
    if (!window.isSecureContext) { setError('위치 확인에는 HTTPS 접속이 필요해요. 배포 사이트 또는 이 PC의 localhost 주소를 이용해 주세요.'); return }
    if (!navigator.geolocation) { setError('이 브라우저에서는 현재 위치를 가져올 수 없어요. 위치를 직접 입력해 주세요.'); return }
    pending.current = true
    const current = ++sequence.current
    setLoading(true); setError('')
    const success = (position: GeolocationPosition) => {
      if (!alive.current || sequence.current !== current) return
      pending.current = false; setLoading(false)
      const { latitude: lat, longitude: lng, accuracy } = position.coords
      if (!Number.isFinite(lat) || Math.abs(lat)>90 || !Number.isFinite(lng) || Math.abs(lng)>180 || !Number.isFinite(accuracy) || accuracy<0) {
        setError('정상적인 위치를 받지 못했어요. 다시 시도해 주세요.'); return
      }
      save({ label: '현재 위치', source: 'gps', coordinates: { lat, lng, accuracy, updatedAt: Date.now() } })
    }
    const failure = (reason: GeolocationPositionError) => {
      if (!alive.current || sequence.current !== current) return
      pending.current = false; setLoading(false)
      setError(reason.code === 1
        ? '위치 권한이 꺼져 있어요. 주소창의 사이트 권한에서 위치를 허용한 뒤 다시 시도하거나, 직접 입력해 주세요.'
        : reason.code === 3
          ? '위치를 확인하는 데 시간이 오래 걸려요. 기기 위치 설정을 확인하고 다시 시도해 주세요.'
          : '현재 위치를 확인할 수 없어요. 기기의 위치 기능을 켜거나 직접 입력해 주세요.')
    }
    // Desktop devices may not provide a high-accuracy fix; retry using the browser's coarse location.
    navigator.geolocation.getCurrentPosition(success, reason => {
      if (!alive.current || sequence.current !== current) return
      if (reason.code === 2 || reason.code === 3)
        navigator.geolocation.getCurrentPosition(success, failure, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
      else failure(reason)
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }, [save])
  useEffect(() => {
    alive.current = true
    // Defer one tick so StrictMode's setup/cleanup does not open two permission requests.
    const timer = setTimeout(() => { if (choice.source !== 'manual') request() }, 0)
    return () => { clearTimeout(timer); alive.current = false; sequence.current++; pending.current = false }
  }, [request])
  const manual = useCallback((label: string) => {
    if (!label.trim()) return
    sequence.current++; pending.current = false; setLoading(false); setError('')
    save({ label: label.trim(), source: 'manual', coordinates: null })
  }, [save])
  return { label: choice.label, coordinates: choice.coordinates, source: choice.source, loading, error, request, manual }
}
