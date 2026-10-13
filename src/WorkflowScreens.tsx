import { useEffect, useRef, useState, type ReactNode } from "react"

import { useFlow } from "./FlowContext"

import {
  allPaid,
  allReceived,
  due,
  demoLocations,
  feeShare,
  foodTotal,
  leaderId,
  LATE_GRACE_MS,
  money,
  recommendMeetings,
  recruitmentClosed,
  statusOf,
  totalFood,
  type Transaction,
} from "./workflow"

export type Screen = "main" | "category" | "list" | "detail" | "create" | "applicants" | "applicantProfile" | "chat" | "menu" | "payment" | "delivery" | "receipt" | "complete" | "rating" | "profile"

type Navigation = { pop: () => void ; push: (screen: Screen) => void }

export function Button({
  children,
  onClick,
  disabled = false,
  secondary = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  secondary?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full min-h-12 px-3 py-3 rounded-2xl text-sm font-bold transition active:scale-[.99] disabled:opacity-40 disabled:cursor-not-allowed ${
        secondary
          ? "border border-gray-200 bg-white text-gray-600"
          : "bg-brand text-white shadow-sm"
      }`}
    >
      {children}
    </button>
  )
}

function Top({ title, pop }: { title: string ; pop: () => void }) {
  return (
    <header className="flex-shrink-0 h-14 px-4 flex items-center bg-white border-b border-gray-100">
      <button
        aria-label="뒤로"
        onClick={pop}
        className="w-10 h-10 -ml-2 text-xl"
      >
        ‹
      </button>
      <h1 className="font-semibold flex-1 text-center mr-8">{title}</h1>
    </header>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value: ReactNode
  strong?: boolean
}) {
  return (
    <div
      className={`flex justify-between gap-3 text-sm ${
        strong
          ? "font-bold text-brand border-t border-gray-100 pt-3"
          : "text-gray-600"
      }`}
    >
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

export function Demo({ children }: { children: ReactNode }) {
  return (
    <details className="rounded-xl border border-dashed border-orange-200 bg-orange-50/50 p-3 text-xs">
      <summary className="cursor-pointer text-gray-500">
        프로토타입 시연 · 다른 사용자의 행동
      </summary>
      <div className="pt-3 space-y-2">{children}</div>
    </details>
  )
}

export function FlowBar() {
  const { tx } = useFlow()

  if (!tx || tx.cancelled || tx.application === "rejected") return null

  const labels = ["신청", "모집", "메뉴", "송금", "배달", "수령"]

  const index =
    tx.application === "pending"
      ? 0
      : !tx.closed
        ? 1
        : !tx.menusFinal
          ? 2
          : !tx.ordered
            ? 3
            : !tx.arrived
              ? 4
              : 5

  return (
    <div className="flex-shrink-0 bg-brand-50 px-4 py-2.5 border-b border-orange-100">
      <div className="flex justify-between mb-2 text-xs">
        <span className="font-bold text-brand">{statusOf(tx)}</span>
        <span className="text-gray-500">
          {tx.role === "leader" ? "리더" : "참여자"} · {tx.people.length}명
        </span>
      </div>
      <ol className="flex gap-1">
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={i === index ? "step" : undefined}
            className="flex-1 text-center"
          >
            <div
              className={`h-1 rounded-full mb-1 ${
                i <= index ? "bg-brand" : "bg-orange-100"
              }`}
            />
            <span
              className={`text-[10px] ${
                i === index ? "text-brand font-bold" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Empty({
  push,
  title = "진행 중인 공동배달이 없어요",
}: {
  push: Navigation["push"]
  title?: string
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white">
      <span className="text-5xl mb-4">🍽️</span>
      <h2 className="font-bold text-lg mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">
        근처 모집글을 찾아 동참하거나
        <br />
        리더가 되어 직접 모집해 보세요.
      </p>
      <Button onClick={() => push("main")}>근처 모집글 찾기</Button>
    </div>
  )
}

export function CancelControl({ push }: { push: Navigation["push"] }) {
  const { tx, dispatch, setNotice } = useFlow()
  const [open, setOpen] = useState(false)

  if (!tx || tx.cancelled || allReceived(tx)) return null

  if (tx.ordered)
    return (
      <p className="text-xs text-center text-gray-400">
        주문이 완료되어 참여를 취소할 수 없어요.
      </p>
    )

  const claimed = tx.people.find((p) => p.id === "me")?.transferClaimed
  const refundDue = tx.role === "leader"
    ? tx.people.some((p) => p.id !== leaderId(tx) && p.transferClaimed)
    : claimed

  return (
    <div className="text-center">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-gray-500 underline underline-offset-4 py-2"
        >
          {tx.role === "leader"
            ? "공동배달 취소"
            : tx.application === "pending"
              ? "신청 취소"
              : "참여 취소"}
        </button>
      ) : (
        <Card>
          <p className="text-sm text-gray-700">
            {tx.role === "leader"
              ? "공동배달을 취소할까요? 송금한 참가자에게 리더가 환불해야 합니다."
              : claimed
                ? `참여를 취소하면 리더에게 ${money(due(tx, "me"))} 환불을 요청해야 합니다.`
                : "참여를 취소하고 다른 모집글을 찾아볼까요?"}
          </p>
          <div className="flex gap-2">
            <Button secondary onClick={() => setOpen(false)}>
              계속 참여
            </Button>
            <Button
              onClick={() => {
                dispatch({ type: "cancel" })
                setNotice(
                  refundDue
                    ? "거래가 취소됐어요. 환불 상태를 확인해 주세요."
                    : "신청이 취소됐어요. 다른 모집글에 신청할 수 있어요.",
                )
                push(refundDue ? "payment" : "main")
              }}
            >
              취소하기
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export function DetailActions({ push }: { push: Navigation["push"] }) {
  const flow = useFlow()
  const { tx, selectedPost, active, dispatch, menu, now } = flow

  const mine =
    tx?.post.id === selectedPost.id &&
    !tx.cancelled &&
    tx.application !== "rejected"

  if (mine && tx.application === "pending")
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-brand-50 p-3 text-sm text-center">
          <b>신청 완료 · 리더 승인 대기</b>
          <p className="text-xs text-gray-500 mt-1">
            승인 결과는 이곳에서 확인할 수 있어요.
          </p>
        </div>
        <Demo>
          <Button
            onClick={() => {
              dispatch({ type: "approve", accepted: true, items: menu, now })
              flow.setNotice(
                "리더가 신청을 수락했어요. 공동 채팅방에서 다음 단계를 진행하세요.",
              )
              push("chat")
            }}
          >
            리더가 수락하기
          </Button>
          <Button
            secondary
            onClick={() => {
              dispatch({ type: "approve", accepted: false, items: menu, now })
              flow.setNotice(
                "신청이 거절됐어요. 다른 모집글에 신청할 수 있어요.",
              )
              push("list")
            }}
          >
            리더가 거절하기
          </Button>
        </Demo>
        <CancelControl push={push} />
      </div>
    )

  if (mine && tx.application === "accepted")
    return (
      <div className="space-y-2">
        <Button
          onClick={() =>
            push(
              allReceived(tx)
                ? "complete"
                : tx.role === "leader" && !tx.closed
                  ? "applicants"
                  : "chat",
            )
          }
        >
          {allReceived(tx)
            ? "거래 완료 보기"
            : tx.role === "leader" && !tx.closed
              ? "신청자 관리하기"
              : "공동 채팅방으로"}
        </Button>
        <CancelControl push={push} />
      </div>
    )

  const closed = selectedPost.status !== "recruiting"

  return (
    <div className="space-y-2">
      <Button
        disabled={closed || active}
        onClick={() => {
          if (flow.apply(selectedPost))
            flow.setNotice("동참 신청을 보냈어요. 리더의 승인을 기다려 주세요.")
        }}
      >
        {closed
          ? "모집이 마감되었어요"
          : active
            ? "다른 공동배달에 신청 / 참여 중"
            : "동참 신청하기"}
      </Button>
      {active && (
        <Button
          secondary
          onClick={() => {
            flow.selectPost(tx!.post.id)
            push(tx!.application === "pending" ? "detail" : "chat")
          }}
        >
          내 진행 중인 공동배달 보기
        </Button>
      )}
    </div>
  )
}

export type Applicant = {
  id: number
  name: string
  rating: number
  trades: number
  reviews: number
  avatar: string
  lastActive: string
  requestedMenu: string
  reviewSnippets: string[]
}

export function Applicants({
  pop,
  push,
  applicants,
}: Navigation & { applicants: Applicant[] }) {
  const {
    tx,
    dispatch,
    menu,
    now,
    setSelectedApplicant,
    setNotice,
    reputation,
  } = useFlow()

  if (!tx || tx.role !== "leader" || tx.cancelled)
    return <Empty push={push} title="내가 만든 모집글이 없어요" />

  const closed = recruitmentClosed(tx, now)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Top title="신청자 관리" pop={pop} />
      <div className="p-4 space-y-3">
        <Card>
          <b>
            {tx.post.emoji} {tx.post.restaurant}
          </b>
          <Row
            label="현재 모집 인원"
            value={`${tx.people.length} / ${tx.post.maxMembers}명`}
          />
          <p className="text-xs text-gray-500">
            {closed
              ? "모집이 마감되었어요. 수락한 멤버와 다음 단계를 진행하세요."
              : "프로필과 평판을 확인하고 함께할 멤버를 선택하세요."}
          </p>
        </Card>
        {applicants.map((base) => {
          const a = {
            ...base,
            ...reputation(base.name, base.rating, base.trades, base.reviews),
          }
          return (
            <Card key={a.id}>
              <button
                className="w-full flex items-center gap-3 text-left"
                onClick={() => {
                  setSelectedApplicant(a.id)
                  push("applicantProfile")
                }}
              >
                <span className="text-3xl">{a.avatar}</span>
                <span>
                  <b className="text-sm">{a.name}</b>
                  <span className="block text-xs text-gray-500 mt-1">
                    ⭐ {a.rating} · 거래 {a.trades}회 · 후기 {a.reviews}개
                  </span>
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {a.lastActive} ›
                </span>
              </button>
              <p className="text-xs text-gray-500">
                신청 메뉴:{" "}
                {a.requestedMenu === "미정"
                  ? "미정"
                  : (menu.find((item) => item.name === a.requestedMenu)?.name ??
                    menu[0].name)}
              </p>
              <div className="flex flex-wrap gap-1">
                {a.reviewSnippets.map((t) => (
                  <span
                    key={t}
                    className="bg-gray-50 text-gray-500 rounded-full px-2 py-1 text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {tx.decisions[a.id] ? (
                <p
                  className={`text-center text-sm font-bold ${
                    tx.decisions[a.id] === "accepted"
                      ? "text-success"
                      : "text-gray-400"
                  }`}
                >
                  {tx.decisions[a.id] === "accepted" ? "✓ 수락됨" : "거절됨"}
                </p>
              ) : (
                <div className="flex gap-2">
                  <Button
                    disabled={closed}
                    secondary
                    onClick={() =>
                      dispatch({
                        type: "decide",
                        id: a.id,
                        name: a.name,
                        accepted: false,
                        items: menu,
                        now,
                      })
                    }
                  >
                    거절
                  </Button>
                  <Button
                    disabled={closed}
                    onClick={() => {
                      dispatch({
                        type: "decide",
                        id: a.id,
                        name: a.name,
                        accepted: true,
                        items: menu,
                        now,
                        requestedMenu: a.requestedMenu,
                      })
                      setNotice(
                        "멤버를 수락했어요. 모집 인원이 차면 자동으로 마감돼요.",
                      )
                    }}
                  >
                    수락
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
        <Button
          onClick={() => {
            dispatch({ type: "close" })
            push("chat")
          }}
        >
          {closed
            ? "공동 채팅방으로"
            : `현재 ${tx.people.length}명으로 모집 마감하고 채팅방으로`}
        </Button>
        <CancelControl push={push} />
      </div>
    </div>
  )
}

function OrderSummary({ tx }: { tx: Transaction }) {
  return (
    <Card>
      <h2 className="text-sm font-bold">현재 주문 내역</h2>
      {tx.people.map((p) => (
        <div key={p.id} className="border-b border-gray-50 pb-2">
          <Row label={p.name} value={money(foodTotal(p))} />
          <p className="text-xs text-gray-400 mt-1">
            {p.items
              .filter((item) => (p.quantities[item.id] ?? 0) > 0)
              .map((item) => `${item.name} × ${p.quantities[item.id]}`)
              .join(", ") || "메뉴 선택 전"}
          </p>
        </div>
      ))}
      <Row label="음식값 합계" value={money(totalFood(tx))} strong />
      <p className="text-xs text-gray-500">
        최소주문금액 {money(tx.post.minOrderAmount)} ·{" "}
        {totalFood(tx) >= tx.post.minOrderAmount
          ? "달성했어요 ✓"
          : `${money(tx.post.minOrderAmount - totalFood(tx))} 더 필요해요`}
      </p>
    </Card>
  )
}

function MeetingRecommendations({
  tx,
  setPlace,
  setText,
}: {
  tx: Transaction
  setPlace: (value: string) => void
  setText: (value: string) => void
}) {
  const { dispatch } = useFlow()
  const suggestions = recommendMeetings(tx)
  const locationIndex = (id: string) => {
    const point = tx.people.find((p) => p.id === id)!.location
    return Math.max(0, demoLocations.findIndex((location) =>
      location.point.x === point.x && location.point.y === point.y))
  }
  const selector = (id: string, name: string) => (
    <label key={id} className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-600">{name}</span>
      <select
        aria-label={`${name} 시연용 위치`}
        className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2 text-xs"
        value={locationIndex(id)}
        onChange={(event) => dispatch({
          type: "set-location",
          id,
          point: demoLocations[Number(event.target.value)].point,
        })}
      >
        {demoLocations.map((location, index) => (
          <option key={location.name} value={index}>{location.name}</option>
        ))}
      </select>
    </label>
  )
  return (
    <Card>
      <h2 className="text-sm font-bold">📍 만남 장소 추천</h2>
      <p className="text-xs text-gray-500">
        수락된 멤버의 시연용 위치를 바탕으로 모두의 거리와 리더의 이동 거리를 비교해요.
      </p>
      {selector("me", "내 위치")}
      <Demo>
        {tx.people.filter((p) => p.id !== "me").map((p) => selector(p.id, p.name))}
      </Demo>
      {suggestions.length ? suggestions.map((suggestion, index) => (
        <div key={suggestion.id} className="rounded-xl border border-orange-100 bg-orange-50/40 p-3 space-y-2">
          <div className="flex justify-between text-sm font-semibold">
            <span>{index === 0 ? "추천 1순위 · " : ""}{suggestion.name}</span>
            <span className="text-brand">최대 {suggestion.farthest}m</span>
          </div>
          <p className="text-xs text-gray-600">
            {suggestion.distances.map((item) => `${item.name} ${item.distance}m`).join(" · ")}
          </p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg bg-white border border-orange-200 px-2 py-2 text-xs text-brand"
              onClick={() => setText(`${suggestion.name}에서 만나는 건 어떨까요?`)}
            >
              채팅에 제안하기
            </button>
            <button
              className="flex-1 rounded-lg bg-white border border-orange-200 px-2 py-2 text-xs text-brand"
              onClick={() => setPlace(suggestion.name)}
            >
              장소 메모에 넣기
            </button>
          </div>
        </div>
      )) : <p className="text-xs text-gray-500">모두에게 가까운 후보가 없어요. 채팅에서 직접 장소를 정해 주세요.</p>}
      <p className="text-[11px] text-gray-400">
        거리는 실제 도보 경로가 아닌 시연용 직선거리예요. 위치를 바꿔도 저장한 만남 장소는 유지됩니다.
      </p>
    </Card>
  )
}

export function Chat({ pop, push }: Navigation) {
  const { tx, dispatch, setNotice, myLocation, setSelectedApplicant } = useFlow()
  const [text, setText] = useState("")
  const [place, setPlace] = useState(tx?.meeting ?? "")
  const [meetingTimeDraft, setMeetingTimeDraft] = useState(tx?.meetingTime ?? "")
  const [nearbyAddress, setNearbyAddress] = useState(myLocation)
  const [newMessages, setNewMessages] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const followBottom = useRef(true)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tx?.messages.length) return
    if (followBottom.current) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    else setNewMessages(true)
  }, [tx?.messages.length])

  if (!tx || tx.cancelled || tx.application !== "accepted")
    return (
      <Empty
        push={push}
        title={
          tx?.application === "pending"
            ? "리더 승인을 기다리고 있어요"
            : undefined
        }
      />
    )

  const mine = tx.people.find((p) => p.id === "me")!

  const ready =
    tx.closed &&
    tx.people.every((p) => p.menuConfirmed && foodTotal(p) > 0) &&
    totalFood(tx) >= tx.post.minOrderAmount

  const send = () => {
    if (!text.trim()) return
    followBottom.current = true
    setNewMessages(false)
    dispatch({
      type: "message",
      message: {
        id: Date.now(),
        sender: "나",
        content: text.trim(),
        time: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        isMe: true,
      },
    })
    setText("")
  }

  const next = allReceived(tx)
    ? "complete"
    : tx.arrived
      ? "receipt"
      : tx.ordered
        ? "delivery"
        : tx.menusFinal
          ? "payment"
          : "menu"

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
      <Top title={tx.post.restaurant} pop={pop} />
      <div className="flex gap-2 bg-white px-3 py-2 border-b border-gray-100">
        {[
          { label: "메뉴 내역", screen: "menu" as Screen, enabled: true },
          {
            label: "송금 현황",
            screen: "payment" as Screen,
            enabled: tx.menusFinal,
          },
          {
            label: "배달 현황",
            screen: "delivery" as Screen,
            enabled: tx.ordered,
          },
        ].map((item) => (
          <button
            key={item.label}
            disabled={!item.enabled}
            onClick={() => push(item.screen)}
            className="flex-1 text-xs font-semibold text-brand bg-brand-50 rounded-xl py-2 disabled:text-gray-300 disabled:bg-gray-50"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex-shrink-0 bg-white px-4 py-2 border-b border-gray-100 text-xs text-gray-600">
        <div className="flex justify-between gap-2"><span>{statusOf(tx)} · {tx.people.length}명</span><span>내 예상 부담 {money(due(tx, "me"))}</span></div>
        <p className="mt-1 truncate">수령 {tx.nearbyDelivery?.agreed ? tx.nearbyDelivery.address : tx.meeting || "장소 조율 중"} · {tx.meetingTime || "시간 조율 중"}</p>
      </div>
      <div ref={listRef} onScroll={(event) => {
        const element = event.currentTarget
        followBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
        if (followBottom.current) setNewMessages(false)
      }} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
        <details className="rounded-lg bg-white border border-gray-100 p-3">
          <summary className="cursor-pointer font-semibold text-sm">주문·장소 설정 열기</summary>
          <div className="pt-3 space-y-3">
        <Card>
          <p className="text-sm font-bold">
            {!tx.closed
              ? "함께할 멤버를 모집하고 있어요"
              : tx.menusFinal
                ? "주문 내용이 확정됐어요"
                : "각자 메뉴를 고르고 리더가 주문을 확정해요"}
          </p>
          <p className="text-xs text-gray-500">
            {!tx.closed
              ? `${tx.people.length}/${tx.post.maxMembers}명 · 모집 중에도 메뉴를 선택할 수 있어요.`
              : "주문 전까지 취소할 수 있고, 주문 후에는 수령을 진행해요."}
          </p>
          <Button onClick={() => push(next)}>
            {allReceived(tx)
              ? "거래 완료 보기"
              : tx.arrived
                ? "음식 수령 확인하기"
                : tx.ordered
                  ? "배달 현황 확인하기"
                  : tx.menusFinal
                    ? "내 송금 금액 확인하기"
                    : mine.menuConfirmed
                      ? "내 메뉴 확인 / 수정"
                      : "내 메뉴 선택하기"}
          </Button>
          {ready &&
            !tx.menusFinal &&
            (tx.role === "leader" ? (
              <Button
                onClick={() => {
                  dispatch({ type: "finalize" })
                  push("payment")
                }}
              >
                최종 주문 확정하고 입금 안내
              </Button>
            ) : (
              <Demo>
                <Button
                  onClick={() => {
                    dispatch({ type: "finalize" })
                    setNotice("리더가 최종 주문을 확정했어요.")
                    push("payment")
                  }}
                >
                  리더가 최종 주문 확정하기
                </Button>
              </Demo>
            ))}
          {!tx.closed &&
            (tx.role === "leader" ? (
              <Button
                secondary
                onClick={() => {
                  dispatch({ type: "close" })
                  setNotice("모집을 마감했어요. 메뉴를 확정해 주세요.")
                }}
              >
                현재 멤버로 모집 마감
              </Button>
            ) : (
              <Demo>
                <Button
                  secondary
                  onClick={() => {
                    dispatch({ type: "close" })
                    setNotice("리더가 모집을 마감했어요.")
                  }}
                >
                  리더가 현재 멤버로 모집 마감
                </Button>
              </Demo>
            ))}
        </Card>
        <OrderSummary tx={tx} />
        <div className="bg-white border border-gray-100 rounded-lg p-3 text-xs space-y-2">
          <p className="font-semibold">수령 방식과 배달비</p>
          <p>함께 만나요: 배달비 {money(feeShare(tx, "me"))} · 내 근처에서 받기: 요청자가 배달비 3,000원 전액 부담</p>
          {tx.people.length === 2 && !tx.menusFinal && !tx.nearbyDelivery && (
            <div className="space-y-2">
              <label className="block">내 근처 수령 장소 (상세 집 주소 대신 건물 앞 권장)
                <input aria-label="내 근처 배달 주소" value={nearbyAddress} onChange={event => setNearbyAddress(event.target.value)} className="w-full mt-1 border border-gray-200 p-2 rounded-lg" />
              </label>
              <Button secondary disabled={!nearbyAddress.trim()} onClick={() => dispatch({ type: "nearby-propose", requesterId: "me", address: nearbyAddress })}>내 근처에서 받기 제안</Button>
              <Demo><Button secondary onClick={() => dispatch({ type: "nearby-propose", requesterId: tx.people.find(p => p.id !== "me")!.id, address: "상대방 근처 건물 앞 (시연)" })}>상대가 자기 근처 수령 제안</Button></Demo>
            </div>
          )}
          {tx.nearbyDelivery && <div className="space-y-2">
            <p>{tx.nearbyDelivery.agreed ? "합의 완료" : "상대 동의 대기"} · 배달 주소: {tx.nearbyDelivery.address}</p>
            <p>요청자 배달비 3,000원 · 이동하는 사람 배달비 0원 · 이동 약 {tx.post.distance}m (시연 거리)</p>
            {!tx.nearbyDelivery.agreed && tx.nearbyDelivery.requesterId !== "me" && <Button secondary onClick={() => dispatch({ type: "nearby-agree", id: "me" })}>이동 조건에 동의하기</Button>}
            {!tx.nearbyDelivery.agreed && tx.nearbyDelivery.requesterId === "me" && <Demo><Button secondary onClick={() => dispatch({ type: "nearby-agree", id: tx.people.find(p => p.id !== "me")!.id })}>상대가 이동 조건에 동의하기</Button></Demo>}
            {!tx.menusFinal && <Button secondary onClick={() => dispatch({ type: "nearby-reset" })}>일반 수령으로 되돌리기</Button>}
          </div>}
          {tx.people.length !== 2 && <p className="text-gray-500">내 근처에서 받기는 2인 공동배달에서 사용할 수 있어요.</p>}
        </div>
        <Demo>
          <Button secondary onClick={() => {
            const sender = tx.people.find(person => person.id !== "me")!
            dispatch({ type: "message", message: {
              id: Date.now(), sender: sender.name, content: "추천 장소에서 만나요. 도착하면 알려 주세요!", isMe: false,
              time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
            } })
          }}>다른 참여자의 채팅 받기</Button>
        </Demo>
        {!tx.menusFinal &&
          tx.people.some((p) => p.id !== "me" && !p.menuConfirmed) && (
            <Demo>
              {tx.people
                .filter((p) => p.id !== "me" && !p.menuConfirmed)
                .map((p) => (
                  <Button
                    key={p.id}
                    secondary
                    onClick={() => dispatch({ type: "other-menu", id: p.id })}
                  >
                    {p.name} 메뉴 선택 완료
                  </Button>
                ))}
            </Demo>
          )}
          </div>
        </details>
        {tx.people.length > 1 && <button onClick={() => {
          const other = tx.people.find(person => person.id !== "me")!
          setSelectedApplicant(tx.role === "leader" ? Number(other.id.split("-")[1]) || 1 : 0)
          push("applicantProfile")
        }} className="text-xs text-brand underline">{tx.role === "leader" ? "참여자" : "리더"} 평점·거래 이력 보기</button>}
        {tx.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.isMe ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                m.isMe
                  ? "bg-brand text-white rounded-br-sm"
                  : "bg-white border border-gray-100 rounded-bl-sm"
              }`}
            >
              <p className="text-[10px] opacity-70 mb-1">
                {m.sender} · {m.time}
              </p>
              {m.content}
            </div>
          </div>
        ))}
        <details className="rounded-lg bg-white border border-gray-100 p-3"><summary className="cursor-pointer text-sm font-semibold">위치 추천·수령 장소 조율</summary><div className="pt-3 space-y-3">
        <MeetingRecommendations tx={tx} setPlace={setPlace} setText={setText} />
        <Card>
          <h2 className="text-xs font-bold text-gray-500">
            채팅에서 정한 만남 장소 메모 (선택)
          </h2>
          <div className="flex gap-2">
            <input
              aria-label="만남 장소 메모"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="대화로 합의한 장소를 적어주세요"
              className="min-w-0 flex-1 rounded-xl bg-gray-50 border border-gray-200 px-3 text-xs"
            />
            <button
              onClick={() => {
                dispatch({ type: "meeting", value: place.trim() })
                setNotice("만남 장소 메모를 저장했어요.")
              }}
              className="rounded-xl bg-brand-50 text-brand px-3 py-3 text-xs"
            >
              저장
            </button>
          </div>
          <p className="text-xs text-gray-400">
            추천을 참고해 채팅으로 합의하거나 직접 장소를 적어도 돼요.
          </p>
        </Card>
        <label className="block text-xs text-gray-600">수령 약속 시간
          <input aria-label="수령 약속 시간" type="time" value={meetingTimeDraft} onChange={event => setMeetingTimeDraft(event.target.value)} className="block w-full mt-1 border border-gray-200 rounded-lg p-2" />
        </label>
        <Button secondary disabled={!meetingTimeDraft} onClick={() => dispatch({ type: "meeting-time", value: meetingTimeDraft })}>수령 시간 저장</Button>
        </div></details>
        <CancelControl push={push} />
        <div ref={bottom} />
      </div>
      {newMessages && <button onClick={() => { followBottom.current = true; setNewMessages(false); bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }) }} className="flex-shrink-0 bg-brand text-white text-xs py-2">새 메시지 보기 ↓</button>}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 p-3 flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          aria-label="채팅 메시지"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) send()
          }}
          placeholder="메시지를 입력하세요"
          className="min-w-0 flex-1 h-11 rounded-xl bg-gray-100 px-3 text-sm"
        />
        <button
          disabled={!text.trim()}
          onClick={send}
          className="bg-brand text-white px-4 rounded-xl text-sm disabled:opacity-40"
        >
          전송
        </button>
      </div>
    </div>
  )
}

export function Menu({ pop, push }: Navigation) {
  const { tx, dispatch, setNotice } = useFlow()

  if (!tx || tx.cancelled || tx.application !== "accepted")
    return <Empty push={push} />

  const mine = tx.people.find((p) => p.id === "me")!

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <Top title="메뉴 선택 및 주문 내역" pop={pop} />
      <div className="p-4 space-y-4">
        <OrderSummary tx={tx} />
        <h2 className="font-bold text-sm">
          내 메뉴{" "}
          {tx.menusFinal && (
            <span className="text-xs text-gray-400">
              · 최종 확정되어 수정할 수 없어요
            </span>
          )}
        </h2>
        {mine.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border-b border-gray-50 py-3"
          >
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-gray-500 mt-1">{money(item.price)}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                aria-label={`${item.name} 줄이기`}
                disabled={tx.menusFinal || !mine.quantities[item.id]}
                onClick={() =>
                  dispatch({ type: "quantity", id: item.id, delta: -1 })
                }
                className="w-9 h-9 border border-gray-200 rounded-xl disabled:opacity-30"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-bold">
                {mine.quantities[item.id] ?? 0}
              </span>
              <button
                aria-label={`${item.name} 추가`}
                disabled={tx.menusFinal}
                onClick={() =>
                  dispatch({ type: "quantity", id: item.id, delta: 1 })
                }
                className="w-9 h-9 bg-brand text-white rounded-xl disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        ))}
        <Row label="내 음식값" value={money(foodTotal(mine))} />
        <Row
          label={tx.nearbyDelivery?.agreed ? "내 배달비 (내 근처 수령)" : `배달비 (${tx.people.length}명 분담)`}
          value={money(feeShare(tx, "me"))}
        />
        <Row label="내 예상 송금 금액" value={money(due(tx, "me"))} strong />
        <p className="text-xs text-gray-400">
          {tx.nearbyDelivery?.agreed ? "수령 장소 요청자가 배달비 전액을 내요." : "배달비 총 3,000원을 참여 인원에 따라 나눠요."} 최종 주문 확정 전까지
          금액이 달라질 수 있어요.
        </p>
        <Button
          disabled={foodTotal(mine) <= 0}
          onClick={() => {
            if (!tx.menusFinal) {
              dispatch({ type: "menu-confirm" })
              setNotice(
                "내 메뉴를 저장했어요. 채팅방에서 리더의 최종 확정을 확인하세요.",
              )
            }
            push(tx.menusFinal ? "payment" : "chat")
          }}
        >
          {tx.menusFinal ? "송금 현황으로" : "내 메뉴 저장하고 채팅방으로"}
        </Button>
      </div>
    </div>
  )
}

export function Payment({ pop, push }: Navigation) {
  const { tx, dispatch, canUseCoupon } = useFlow()

  if (!tx)
    return <Empty push={push} title="아직 최종 주문이 확정되지 않았어요" />

  if (tx.cancelled)
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <Top title="취소 및 환불 현황" pop={pop} />
        <div className="p-4 space-y-4">
          <Card>
            <h2 className="font-bold">공동배달이 취소됐어요</h2>
            <Row label="환불 확인이 필요한 금액" value={money(tx.refund)} strong />
            <p className="text-xs text-gray-500">
              {tx.role === "leader"
                ? "송금했다고 표시한 참가자별 금액을 확인하고 환불해 주세요."
                : "리더가 환불한 뒤 완료 상태를 확인해 주세요."}
            </p>
            <p className="text-sm font-semibold text-brand">
              {tx.refundCompleted ? "환불 완료 (시연)" : "리더 환불 대기"}
            </p>
          </Card>
          {!tx.refundCompleted && (tx.role === "leader" ? (
            <Button onClick={() => dispatch({ type: "refund-complete" })}>
              참가자 환불 완료 처리 (시연)
            </Button>
          ) : (
            <Demo>
              <Button onClick={() => dispatch({ type: "refund-complete" })}>
                리더가 환불 완료 처리 (시연)
              </Button>
            </Demo>
          ))}
          <Button secondary onClick={() => push("main")}>모집글로 돌아가기</Button>
        </div>
      </div>
    )

  if (!tx.menusFinal)
    return <Empty push={push} title="아직 최종 주문이 확정되지 않았어요" />

  const mine = tx.people.find((p) => p.id === "me")!
  const leader = tx.people.find((p) => p.id === leaderId(tx))!
  const participants = tx.people.filter((p) => p.id !== leader.id)
  const paidCount = participants.filter((p) => p.paid).length
  const confirmButtons = participants.filter((p) => p.transferClaimed && !p.paid).map((p) => (
    <Button key={p.id} secondary onClick={() => dispatch({ type: "confirm-transfer", id: p.id })}>
      {p.name} 입금 확인 (시연)
    </Button>
  ))

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Top title="리더에게 송금" pop={pop} />
      <div className="p-4 space-y-4">
        <Card>
          <p className="text-xs text-gray-400">리더 계좌 · 시연용 정보</p>
          <p className="text-sm text-gray-500">예금주 {leader.name}</p>
          <p className="text-xl font-black tracking-wide">시연은행 000-0000-0000</p>
          <p className="text-xs text-gray-400">
            실제 계좌가 아니며 송금이나 결제는 일어나지 않아요.
          </p>
        </Card>
        <div className="bg-brand text-white rounded-2xl p-4">
          <p className="text-sm opacity-80">총 결제 예정 금액</p>
          <p className="text-3xl font-black mt-1">
            {money(totalFood(tx) + 3000)}
          </p>
          <p className="text-xs opacity-80 mt-2">
            음식값 {money(totalFood(tx))} + 배달비 3,000원
          </p>
        </div>
        <Card>
          <Row label="내 음식값" value={money(foodTotal(mine))} />
          <Row label="내 배달비" value={money(feeShare(tx, "me"))} />
          {tx.nearbyDelivery?.agreed && <p className="text-xs text-gray-500">배달 주소: {tx.nearbyDelivery.address} · 요청자가 배달비 전액 부담</p>}
          {tx.couponDiscount > 0 && (
            <Row label="우수 참여자 쿠폰" value={`−${money(tx.couponDiscount)}`} />
          )}
          <Row
            label={tx.role === "leader" ? "내 주문 결제 부담액" : "리더에게 보낼 금액"}
            value={money(due(tx, "me"))}
            strong
          />
        </Card>
        {canUseCoupon && feeShare(tx, "me") > 0 && tx.couponDiscount === 0 &&
          !tx.people.some((p) => p.transferClaimed) && (
            <Button secondary onClick={() => dispatch({ type: "apply-coupon" })}>
              배달비 1,000원 할인 쿠폰 사용 (시연)
            </Button>
          )}
        {tx.couponDiscount > 0 && (
          <p className="text-xs text-gray-500 text-center">
            시연용 혜택입니다. 할인액은 플랫폼 지원으로 가정하며 실제 결제는 진행하지 않아요.
          </p>
        )}
        <Card>
          <h2 className="text-sm font-bold">
            리더 입금 확인 {paidCount} / {participants.length}
          </h2>
          {tx.people.map((p) => (
            <div
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              key={p.id}
            >
              <div>
                <p className="text-sm font-semibold">
                  {p.avatar} {p.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {money(due(tx, p.id))}
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  p.paid || (p.id === leader.id && tx.leaderReady)
                    ? "text-success bg-green-50"
                    : "text-amber-600 bg-amber-50"
                }`}
              >
                {p.id === leader.id
                  ? tx.leaderReady ? "주문 결제 준비 완료" : "주문 결제 준비 전"
                  : p.paid ? "리더 확인 완료" : p.transferClaimed ? "리더 확인 대기" : "송금 전"}
              </span>
            </div>
          ))}
        </Card>
        {tx.role === "leader"
          ? !tx.leaderReady && (
              <Button onClick={() => dispatch({ type: "leader-ready" })}>
                내 주문 결제 준비 완료 (시연)
              </Button>
            )
          : !mine.transferClaimed
            ? <Button onClick={() => dispatch({ type: "claim-transfer", id: "me" })}>
                {money(due(tx, "me"))} 송금했어요 (시연)
              </Button>
            : <p className="text-center text-sm font-bold text-success">
                {mine.paid ? "✓ 리더가 내 입금을 확인했어요." : "송금 표시 완료 · 리더 확인을 기다려요."}
              </p>}
        {tx.role === "leader" && confirmButtons}
        {!allPaid(tx) && (
          <>
            <p className="text-sm text-gray-500 text-center">
              참가자의 송금과 리더의 입금 확인을 기다리고 있어요.
            </p>
            <Demo>
              {participants
                .filter((p) => p.id !== "me" && !p.transferClaimed)
                .map((p) => (
                  <Button
                    key={p.id}
                    secondary
                    onClick={() => dispatch({ type: "claim-transfer", id: p.id })}
                  >
                    {p.name} 송금했다고 표시
                  </Button>
                ))}
              {tx.role === "participant" && (
                <>
                  {confirmButtons}
                  {!tx.leaderReady && <Button secondary onClick={() => dispatch({ type: "leader-ready" })}>
                    리더가 주문 결제 준비 완료
                  </Button>}
                </>
              )}
            </Demo>
          </>
        )}
        {allPaid(tx) && !tx.ordered && (
          <Card>
            <p className="text-sm font-bold text-success">
              모든 참가자의 입금을 리더가 확인했습니다.
            </p>
            <p className="text-xs text-gray-500">
              리더가 배달앱에서 주문과 결제를 진행할 수 있어요. 주문 후에는 취소할 수 없어요.
            </p>
            {tx.role === "leader" ? (
              <Button
                onClick={() => {
                  dispatch({ type: "order" })
                  push("delivery")
                }}
              >
                리더가 배달 주문 진행 (시연)
              </Button>
            ) : (
              <Demo>
                <Button
                  onClick={() => {
                    dispatch({ type: "order" })
                    push("delivery")
                  }}
                >
                  리더가 배달 주문 진행
                </Button>
              </Demo>
            )}
          </Card>
        )}
        {tx.ordered && (
          <Button onClick={() => push("delivery")}>배달 현황 보기</Button>
        )}
        <CancelControl push={push} />
      </div>
    </div>
  )
}

export function Delivery({ pop, push }: Navigation) {
  const { tx, dispatch, now } = useFlow()

  if (!tx || tx.cancelled || !tx.ordered)
    return <Empty push={push} title="아직 배달 주문 전이에요" />

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Top title="주문 및 배달 현황" pop={pop} />
      <div className="p-4 space-y-4">
        <Card>
          <p className="text-xs text-center text-gray-400">
            {tx.post.restaurant}
          </p>
          <p className="text-4xl text-brand font-black text-center py-3">
            {tx.arrived ? "배달 도착" : "배달 중"}
          </p>
          <p className="text-sm text-center text-gray-500">
            {tx.arrived
              ? tx.nearbyDelivery?.agreed ? "합의한 요청자 근처 주소에서 각자 음식을 받아 주세요." : "채팅에서 정한 장소에서 음식을 전달받아 주세요."
              : `배달 예정 ${tx.post.deliveryTime || "18:35"} · 시연 정보`}
          </p>
        </Card>
        <Card>
          {["주문 접수", "결제 완료", "배달 출발", "배달 도착"].map(
            (label, i) => (
              <div
                key={label}
                className={`flex gap-3 py-2 text-sm ${
                  i < 3 || tx.arrived ? "text-gray-800" : "text-gray-400"
                }`}
              >
                <span className={i < 3 || tx.arrived ? "text-brand" : ""}>
                  {i < 3 || tx.arrived ? "✓" : "○"}
                </span>
                {label}
              </div>
            ),
          )}
        </Card>
        <Card>
          <h2 className="text-xs text-brand font-bold">
            {tx.nearbyDelivery?.agreed ? "배달 주소와 수령 안내" : "채팅에서 정한 만남 장소"}
          </h2>
          <p className="text-sm">
            {tx.nearbyDelivery?.agreed ? tx.nearbyDelivery.address : tx.meeting ||
              "아직 메모된 장소가 없어요. 채팅방에서 자유롭게 정해 주세요."}
          </p>
          <p className="text-xs text-gray-500">{tx.meetingTime ? `${tx.meetingTime} 수령 약속` : "수령 시간 조율 중"} · 채팅에서 닉네임과 메뉴를 확인하고 각자 수령 완료를 눌러 주세요.</p>
          <div className="border-t border-gray-100 pt-2 space-y-1">
            {tx.people.map(person => <p key={person.id} className="text-xs text-gray-600">{person.name}: {person.items.filter(item => (person.quantities[item.id] ?? 0) > 0).map(item => `${item.name} ${person.quantities[item.id]}개`).join(", ") || "메뉴 확인 중"}</p>)}
          </div>
          <Button secondary onClick={() => push("chat")}>
            채팅방에서 장소 / 시간 이야기하기
          </Button>
        </Card>
        {!tx.arrived ? (
          <Demo>
            <Button
              onClick={() => {
                dispatch({ type: "arrive", now })
                push("receipt")
              }}
            >
              배달 도착으로 진행
            </Button>
          </Demo>
        ) : (
          <Button onClick={() => push("receipt")}>내 음식 수령 확인하기</Button>
        )}
        <CancelControl push={push} />
      </div>
    </div>
  )
}

export function Receipt({ pop, push }: Navigation) {
  const { tx, dispatch, now } = useFlow()

  if (!tx || !tx.arrived)
    return <Empty push={push} title="음식이 도착한 뒤 수령을 확인해요" />

  const mine = tx.people.find((p) => p.id === "me")!
  const count = tx.people.filter((p) => p.received).length
  const lateWindowPassed = tx.arrivedAt !== null &&
    now >= tx.arrivedAt + LATE_GRACE_MS
  const awaitingParticipants = tx.people.filter((p) =>
    p.id !== leaderId(tx) && !p.received && !tx.lateReports[p.id])

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Top title="수령 확인" pop={pop} />
      <div className="p-4 space-y-4">
        <div className="bg-white border border-gray-100 rounded-lg p-3 text-sm">
          <p className="font-semibold">수령 안내</p>
          <p>{tx.nearbyDelivery?.agreed ? tx.nearbyDelivery.address : tx.meeting || "채팅에서 합의한 장소 확인"} · {tx.meetingTime || "시간은 채팅에서 조율"}</p>
          <p className="text-xs text-gray-500 mt-1">서로의 닉네임과 메뉴를 확인한 뒤 각자 수령 완료를 눌러 주세요.</p>
        </div>
        <Card>
          <p className="text-5xl text-center">🛍️</p>
          <h2 className="font-bold text-center">수령 확인 현황</h2>
          <p className="text-4xl font-black text-brand text-center">
            {count} / {tx.people.length}
          </p>
          <p className="text-xs text-gray-500 text-center">
            {allReceived(tx)
              ? "모든 참여자가 음식 수령을 확인했습니다."
              : `리더를 포함해 ${tx.people.length - count}명의 수령 확인을 기다려요.`}
          </p>
          {tx.people.map((p) => (
            <Row
              key={p.id}
              label={p.name}
              value={
                <span className={p.received ? "text-success" : tx.lateReports[p.id] ? "text-amber-600" : "text-gray-400"}>
                  {p.received ? "✓ 수령 확인" : tx.lateReports[p.id] ? "지각 확인됨" : "확인 대기"}
                </span>
              }
            />
          ))}
        </Card>
        {!allReceived(tx) && awaitingParticipants.length > 0 &&
          (tx.role === "leader" || awaitingParticipants.some((p) => p.id === "me")) && (
          <Card>
            <h2 className="text-sm font-bold">수령 지각 확인</h2>
            <p className="text-xs text-gray-500">
              배달 도착 10분 후에도 수령하지 않은 참가자는 리더가 지각을 확인할 수 있어요.
              확인된 참가자는 새 모집·참여가 3일간 제한됩니다.
            </p>
            {!lateWindowPassed ? (
              <p className="text-xs text-amber-600">시연 시간을 30분 진행하면 지각 확인을 체험할 수 있어요.</p>
            ) : tx.role === "leader" ? (
              awaitingParticipants.map((p) => (
                <Button key={p.id} secondary onClick={() => dispatch({ type: "mark-late", id: p.id, now })}>
                  {p.name} 수령 지각 확인 (시연)
                </Button>
              ))
            ) : awaitingParticipants.some((p) => p.id === "me") ? (
              <Demo>
                <Button secondary onClick={() => dispatch({ type: "mark-late", id: "me", now })}>
                  리더가 내 수령 지각 확인 (시연)
                </Button>
              </Demo>
            ) : null}
          </Card>
        )}
        {tx.lateReports.me && (
          <p className="text-xs text-center text-amber-600">
            내 수령 지각이 확인됐어요. 새 공동배달 참여·모집이 3일간 제한됩니다.
          </p>
        )}
        <Card>
          <h2 className="text-sm font-bold">내 주문 내역</h2>
          {mine.items
            .filter((i) => mine.quantities[i.id] > 0)
            .map((i) => (
              <Row
                key={i.id}
                label={`${i.name} × ${mine.quantities[i.id]}`}
                value={money(i.price * mine.quantities[i.id])}
              />
            ))}
          <Row
            label="내 결제 금액 (배달비 포함)"
            value={money(due(tx, "me"))}
            strong
          />
        </Card>
        {!mine.received && (
          <Button onClick={() => dispatch({ type: "receive", id: "me" })}>
            내 음식 수령 완료 확인
          </Button>
        )}
        {mine.received && !allReceived(tx) && (
          <p className="text-center text-sm text-success">
            내 수령을 확인했어요. 다른 멤버를 기다려 주세요.
          </p>
        )}
        {!allReceived(tx) && (
          <Demo>
            {tx.people
              .filter((p) => p.id !== "me" && !p.received)
              .map((p) => (
                <Button
                  key={p.id}
                  secondary
                  onClick={() => dispatch({ type: "receive", id: p.id })}
                >
                  {p.name} 수령 완료
                </Button>
              ))}
          </Demo>
        )}
        {allReceived(tx) && (
          <Button onClick={() => push("complete")}>
            거래 완료 · 멤버 평가로
          </Button>
        )}
        <Button secondary onClick={() => push("chat")}>
          공동 채팅방으로
        </Button>
      </div>
    </div>
  )
}

export function Complete({ push }: { push: Navigation["push"] }) {
  const { tx } = useFlow()

  if (!tx || !allReceived(tx))
    return <Empty push={push} title="전원의 수령 확인 후 거래가 완료돼요" />

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="text-center px-4 pt-8 pb-6">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-black">공동배달 완료!</h1>
        <p className="text-sm text-gray-500 mt-3">
          리더와 모든 멤버가 수령을 확인했어요.
          <br />
          함께한 멤버에게 후기를 남겨 주세요.
        </p>
      </div>
      <div className="p-4 space-y-4">
        <Card>
          <Row label="음식점" value={tx.post.restaurant} />
          <Row label="참여 인원" value={`${tx.people.length}명`} />
          <Row label="총 결제 금액" value={money(totalFood(tx) + 3000)} />
          <Row label="내 결제 금액" value={money(due(tx, "me"))} strong />
        </Card>
        <Button onClick={() => push("rating")}>함께한 멤버 평가하기</Button>
        <Button secondary onClick={() => push("main")}>
          새로운 공동배달 찾아보기
        </Button>
      </div>
    </div>
  )
}

export function Rating({ pop, push }: Navigation) {
  const { tx, reviews, setReviews, setNotice, reviewDrafts, setReviewDrafts } =
    useFlow()

  const draft = tx ? (reviewDrafts[tx.post.id] ?? {}) : {}

  const setDraft = (update: (previous: typeof draft) => typeof draft) => {
    if (tx)
      setReviewDrafts((previous) => ({
        ...previous,
        [tx.post.id]: update(previous[tx.post.id] ?? {}),
      }))
  }

  if (!tx || !allReceived(tx))
    return <Empty push={push} title="거래 완료 후 평가할 수 있어요" />

  const members = tx.people.filter((p) => p.id !== "me")
  const submitted = reviews[tx.post.id]

  if (submitted)
    return (
      <div className="flex-1 flex flex-col justify-center p-6 text-center bg-white">
        <span className="text-5xl mb-4">⭐</span>
        <h1 className="text-xl font-bold mb-2">평가를 남겼어요!</h1>
        <p className="text-sm text-gray-500 mb-6">
          작성한 후기는 내 정보에서 다시 확인할 수 있어요.
        </p>
        <Button onClick={() => push("profile")}>내 활동 확인하기</Button>
      </div>
    )

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Top title="멤버 평가" pop={pop} />
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-500">
          함께한 멤버를 평가해 주세요. 음식점과 배달기사 평가는 제공하지 않아요.
        </p>
        {members.map((p) => {
          const value = draft[p.id] ?? { stars: 0, comment: "", tags: [] }
          const change = (patch: Partial<typeof value>) =>
            setDraft((prev) => ({ ...prev, [p.id]: { ...value, ...patch } }))
          return (
            <Card key={p.id}>
              <b>
                {p.avatar} {p.name}
              </b>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    aria-label={`${p.name} ${s}점`}
                    key={s}
                    onClick={() => change({ stars: s })}
                    className={`text-3xl ${
                      value.stars >= s ? "text-amber-400" : "text-gray-200"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "시간 잘 지켜요",
                  "친절해요",
                  "소통 잘 돼요",
                  "믿음직스러워요",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      change({
                        tags: value.tags.includes(tag)
                          ? value.tags.filter((t) => t !== tag)
                          : [...value.tags, tag],
                      })
                    }
                    className={`text-xs rounded-full border px-3 py-2 ${
                      value.tags.includes(tag)
                        ? "bg-brand-50 border-brand text-brand"
                        : "border-gray-200 text-gray-500"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                aria-label={`${p.name} 후기`}
                value={value.comment}
                onChange={(e) => change({ comment: e.target.value })}
                placeholder="간단한 후기 (선택)"
                rows={2}
                className="w-full rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm resize-none"
              />
            </Card>
          )
        })}
        <Button
          disabled={!members.length || members.some((p) => !draft[p.id]?.stars)}
          onClick={() => {
            setReviews((previous) => ({ ...previous, [tx.post.id]: draft }))
            setNotice("평가가 저장됐어요.")
          }}
        >
          평가 제출하기
        </Button>
        {members.some((p) => !draft[p.id]?.stars) && (
          <p className="text-xs text-center text-gray-400">
            각 멤버의 별점을 선택해 주세요.
          </p>
        )}
        {!members.length && (
          <Button secondary onClick={() => push("main")}>
            평가할 멤버 없이 홈으로
          </Button>
        )}
      </div>
    </div>
  )
}
