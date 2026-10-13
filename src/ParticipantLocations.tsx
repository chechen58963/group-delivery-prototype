import { lazy, Suspense, useState } from "react"
import type { MapPin } from "./LocationMap"
import { leaderId, meetingCandidates, postLeaderPoint, straightDistance, type Transaction } from "./workflow"

const LocationMap = lazy(() => import("./LocationMap"))

export default function ParticipantLocations({ tx }: { tx: Transaction }) {
  const [selectedId, setSelectedId] = useState("me")
  if (tx.application !== "accepted" || tx.cancelled) return null
  const leader = postLeaderPoint(tx.post)
  const mine = tx.people.find(person => person.id === "me")!
  const selected = tx.people.find(person => person.id === selectedId)
  const toWorld = (point: { x: number; y: number }) => ({ x: leader.x + point.x, y: leader.y + point.y })
  const pins: MapPin[] = tx.people.map(person => ({
    id: person.id,
    point: toWorld(person.location),
    label: `${person.name}${person.id === leaderId(tx) ? " · 리더" : ""} 시연 위치`,
    symbol: person.id === "me" ? "나" : person.id === leaderId(tx) ? "리더" : person.avatar,
    kind: person.id === "me" ? "me" : "person",
  }))
  const recipient = tx.nearbyDelivery?.agreed
    ? tx.people.find(person => person.id === tx.nearbyDelivery!.requesterId)
    : undefined
  const meeting = recipient
    ? { name: tx.nearbyDelivery!.address, point: recipient.location }
    : meetingCandidates.find(candidate => candidate.name === tx.meeting.trim())
  if (meeting) pins.push({ id: "meeting", point: toWorld(meeting.point), label: `${meeting.name} · 수령 장소 (시연)`, symbol: "📍", kind: "meeting" })
  return (
    <section className="space-y-3" aria-label="참여자 위치 안내">
      <div className="flex justify-between items-center gap-2">
        <h3 className="font-bold text-sm">참여자 위치</h3>
        <span className="text-[10px] text-gray-500">수락된 멤버 {tx.people.length}명</span>
      </div>
      <p className="text-[11px] text-gray-500">역삼역 주변 시연 위치예요. 실제 GPS 위치가 아니에요.</p>
      <div className="flex h-[300px] min-h-0">
        <Suspense fallback={<div className="map-loading flex-1 rounded-2xl flex items-center justify-center text-sm">지도 불러오는 중…</div>}>
          <LocationMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} title="공동배달 참여자 위치 지도" />
        </Suspense>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="지도에서 참여자 선택">
        {tx.people.map(person => <button key={person.id} aria-pressed={selectedId === person.id} onClick={() => setSelectedId(person.id)} className={`map-person-button shrink-0 px-3 py-2 rounded-xl text-xs ${selectedId === person.id ? "map-person-selected" : ""}`}>
          {person.id === "me" ? "🔵 나" : `${person.avatar} ${person.name}`}{person.id === leaderId(tx) ? " · 리더" : ""}
        </button>)}
        {meeting && <button aria-pressed={selectedId === "meeting"} onClick={() => setSelectedId("meeting")} className={`map-person-button shrink-0 px-3 py-2 rounded-xl text-xs ${selectedId === "meeting" ? "map-person-selected" : ""}`}>📍 수령 장소</button>}
      </div>
      <div className="chat-tool rounded-xl px-3 py-2.5 text-xs" aria-live="polite">
        {selected ? <><b>{selected.id === "me" ? "내 시연 위치" : selected.name}</b><span className="text-gray-500 ml-2">{selected.id === "me" ? "파란색으로 표시돼요" : `나와 ${straightDistance(mine.location, selected.location)}m · 직선거리`}</span></>
          : meeting ? <><b>수령 장소</b><p className="mt-1">{meeting.name} · 내 위치에서 {straightDistance(mine.location, meeting.point)}m (시연)</p></> : "지도에서 참여자를 선택해 주세요."}
      </div>
      {tx.meeting && !meeting && <p className="text-[11px] text-gray-500">직접 입력한 장소 ‘{tx.meeting}’는 좌표가 없어 지도에 표시되지 않아요.</p>}
    </section>
  )
}
