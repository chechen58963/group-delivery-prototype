import { useEffect, useRef, useState } from "react"
import * as L from "leaflet"
import { type Point } from "./workflow"
import { CAMPUS_CENTER } from "./campus"

export type MapPin = {
  id: string
  point: Point
  label: string
  symbol: string
  kind: "post" | "me" | "person" | "meeting"
}

// Only simulated positions are converted; typed addresses are never geocoded.
const DEMO_CENTER = CAMPUS_CENTER
const toLatLng = (point: Point): L.LatLngTuple => [
  DEMO_CENTER.lat + point.y / 111320,
  DEMO_CENTER.lng + point.x / (111320 * Math.cos(DEMO_CENTER.lat * Math.PI / 180)),
]

export default function LocationMap({
  pins, selectedId, onSelect, radius, title,
}: {
  pins: MapPin[]
  selectedId?: string
  onSelect: (id: string) => void
  radius?: number
  title: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const pinsRef = useRef(pins)
  const selectRef = useRef(onSelect)
  const previousSelection = useRef<string | undefined>(undefined)
  const fitRef = useRef<() => void>(() => {})
  const tileRef = useRef<L.TileLayer | null>(null)
  const [tileError, setTileError] = useState(false)
  const [version, setVersion] = useState(0)
  pinsRef.current = pins
  selectRef.current = onSelect

  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, {
      center: toLatLng({ x: 0, y: 0 }), zoom: 16,
      minZoom: 13, maxZoom: 19, zoomControl: false,
      scrollWheelZoom: false, zoomSnap: 0.25,
    })
    mapRef.current = map
    const tile = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map)
    tileRef.current = tile
    tile.on("tileerror", () => setTileError(true))
    tile.on("tileload", () => setTileError(false))
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map)
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(container.current)
    setVersion(value => value + 1)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      tileRef.current = null
      markers.current.clear()
    }
  }, [])

  // Retain panning/zoom when selecting a pin; refresh only when positions change.
  const geometry = JSON.stringify(pins)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = L.layerGroup().addTo(map)
    markers.current.clear()
    if (radius) L.circle(toLatLng({ x: 0, y: 0 }), {
      radius, color: "#dc7942", weight: 1.5, dashArray: "6 6", fillOpacity: 0.045,
      interactive: false,
    }).addTo(layer)
    for (const pin of pinsRef.current) {
      const content = document.createElement("span")
      content.className = "map-pin-content"
      content.textContent = pin.symbol
      content.dataset.symbol = pin.symbol
      const marker = L.marker(toLatLng(pin.point), {
        icon: L.divIcon({
          html: content, className: `map-pin map-pin-${pin.kind}`,
          iconSize: [36, 40], iconAnchor: [18, 40],
        }),
        title: pin.label, alt: pin.label, keyboard: true,
        zIndexOffset: pin.kind === "me" ? 100 : 0,
      }).addTo(layer)
      marker.getElement()?.setAttribute("aria-label", pin.label)
      marker.on("click", () => selectRef.current(pin.id))
      markers.current.set(pin.id, marker)
    }
    const fit = () => {
      const coordinates = pinsRef.current.map(pin => toLatLng(pin.point))
      if (radius) {
        coordinates.push(toLatLng({ x: -radius, y: -radius }), toLatLng({ x: radius, y: radius }))
      }
      if (coordinates.length) map.fitBounds(L.latLngBounds(coordinates), { padding: [45, 45], maxZoom: 17, animate: false })
    }
    fitRef.current = fit
    fit()
    return () => { map.removeLayer(layer); markers.current.clear() }
  }, [geometry, radius, version])

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement()?.classList.toggle("map-pin-selected", id === selectedId)
      marker.getElement()?.setAttribute("aria-pressed", String(id === selectedId))
      marker.setZIndexOffset(id === selectedId ? 1000 : id === "me" ? 100 : 0)
    }
    const marker = selectedId ? markers.current.get(selectedId) : undefined
    if (marker && previousSelection.current !== selectedId) {
      mapRef.current?.panInside(marker.getLatLng(), { padding: [55, 55], animate: false })
    }
    previousSelection.current = selectedId
  }, [selectedId, geometry, version])

  return (
    <div className="location-map relative isolate flex-1 min-h-[260px] overflow-hidden rounded-2xl border border-gray-100">
      <div ref={container} role="region" aria-label={title} className="absolute inset-0" />
      <div className="absolute top-3 right-3 z-[500] flex flex-col gap-1">
        <button aria-label="지도 확대" onClick={() => mapRef.current?.zoomIn()} className="map-control w-10 h-10 rounded-xl text-xl">＋</button>
        <button aria-label="지도 축소" onClick={() => mapRef.current?.zoomOut()} className="map-control w-10 h-10 rounded-xl text-xl">−</button>
        <button onClick={() => fitRef.current()} className="map-control rounded-xl px-2 py-2 text-[10px]">전체 위치</button>
      </div>
      {tileError && <div role="status" className="map-load-error absolute top-3 left-3 right-16 z-[500] rounded-xl p-3 text-xs">
        지도 배경을 불러오지 못했어요. 표시된 위치와 아래 목록은 계속 사용할 수 있어요.
        <button onClick={() => { setTileError(false); tileRef.current?.redraw() }} className="block mt-2 font-bold underline">다시 불러오기</button>
      </div>}
    </div>
  )
}
