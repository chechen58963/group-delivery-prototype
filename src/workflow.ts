export const RECRUITMENT_RADIUS = 700
export type Post = {
  id: number
  restaurant: string
  category: string
  emoji: string
  currentMembers: number
  maxMembers: number
  minOrderAmount: number
  currentAmount: number
  distance: number
  deadline: string
  leaderRating: number
  leaderTrades: number
  leaderName: string
  status: string
  gradFrom: string
  gradTo: string
  description: string
  imageId: string
  deliveryTime?: string
  closesAt?: number
}
export type MenuItem = {
  id: number
  name: string
  price: number
  category: string
}
export type Point = { x: number; y: number }
// Stable demo coordinates in metres: east is +x, north is +y.
// Recruitment distances and participant maps use the same leader position.
export function postLeaderPoint(post: Pick<Post, "id" | "distance">): Point {
  const angle = ((post.id % 360) * 137.508) * Math.PI / 180
  return { x: Math.cos(angle) * post.distance, y: Math.sin(angle) * post.distance }
}
export const demoLocations = [
  { name: "리더 주변", point: { x: 0, y: 0 } },
  { name: "역삼역 서쪽", point: { x: -120, y: 35 } },
  { name: "역삼역 동쪽", point: { x: 130, y: 25 } },
  { name: "테헤란로 남쪽", point: { x: 20, y: -145 } },
  { name: "역삼역 북쪽", point: { x: -15, y: 150 } },
] as const
export const meetingCandidates = [
  { id: "station", name: "역삼역 2번 출구 앞", point: { x: -35, y: 45 } },
  { id: "store", name: "역삼역 앞 편의점", point: { x: 45, y: 35 } },
  { id: "lobby", name: "리더 주변 건물 1층 로비", point: { x: 5, y: -30 } },
  { id: "square", name: "테헤란로 작은 광장", point: { x: 75, y: -70 } },
] as const
export const straightDistance = (a: Point, b: Point) =>
  Math.round(Math.hypot(a.x - b.x, a.y - b.y))
export type Person = {
  id: string
  name: string
  avatar: string
  items: MenuItem[]
  quantities: Record<number, number>
  menuConfirmed: boolean
  location: Point
  transferClaimed: boolean
  paid: boolean
  received: boolean
}
export type Message = {
  id: number
  sender: string
  content: string
  isMe: boolean
  isSystem?: boolean
  time: string
}
export type Transaction = {
  post: Post
  role: "participant" | "leader"
  application: "pending" | "accepted" | "rejected"
  people: Person[]
  decisions: Record<number, "accepted" | "rejected">
  closed: boolean
  menusFinal: boolean
  ordered: boolean
  arrived: boolean
  arrivedAt: number | null
  lateReports: Record<string, number>
  cancelled: boolean
  messages: Message[]
  refund: number
  refundCompleted: boolean
  leaderReady: boolean
  couponDiscount: number
  meeting: string
  meetingTime: string
  nearbyDelivery: { requesterId: string; address: string; agreed: boolean; wasClosed: boolean } | null
}
export type NotificationTarget = "detail" | "applicants" | "chat" | "payment" | "receipt" | "complete"
export type FlowEvent = { text: string; target: NotificationTarget }
export function flowEvents(previous: Transaction | null, next: Transaction): FlowEvent[] {
  if (!previous || previous.post.id !== next.post.id)
    return [{ text: next.role === "leader" ? "새 참여 신청이 도착했어요. 신청자를 확인해 주세요." : "참여 신청을 보냈어요. 리더의 승인을 기다려 주세요.", target: next.role === "leader" ? "applicants" : "detail" }]
  const events: FlowEvent[] = []
  const add = (text: string, target: NotificationTarget) => events.push({ text, target })
  if (previous.application !== next.application)
    add(next.application === "accepted" ? "참여 신청이 수락됐어요. 공동 채팅방에 참여하세요." : "참여 신청이 거절됐어요. 다른 모집글을 확인해 주세요.", next.application === "accepted" ? "chat" : "detail")
  for (const person of next.people) {
    const before = previous.people.find(p => p.id === person.id)
    if (!before && next.role === "leader") add(`${person.name}님이 공동배달에 참여했어요.`, "chat")
    if (before && !before.transferClaimed && person.transferClaimed && next.role === "leader") add(`${person.name}님이 송금 완료를 알렸어요. 입금을 확인해 주세요.`, "payment")
    if (before && !before.paid && person.paid && person.id === "me") add("리더가 내 입금을 확인했어요.", "payment")
  }
  const previousIds = new Set(previous.messages.map(m => m.id))
  for (const message of next.messages)
    if (!previousIds.has(message.id) && !message.isMe && !message.isSystem)
      add(`${message.sender}: ${message.content}`, "chat")
  if (!previous.closed && next.closed && next.application === "accepted") add("모집이 마감됐어요. 메뉴를 확정해 주세요.", "chat")
  if (!previous.menusFinal && next.menusFinal) add("주문 내용이 확정됐어요. 송금 금액을 확인해 주세요.", "payment")
  if (!previous.nearbyDelivery && next.nearbyDelivery && next.nearbyDelivery.requesterId !== "me") add("내 근처 수령 제안이 도착했어요. 이동 거리와 배달비를 확인해 주세요.", "chat")
  if (previous.nearbyDelivery && !previous.nearbyDelivery.agreed && next.nearbyDelivery?.agreed) add("내 근처 수령 방식에 합의했어요. 요청자가 배달비 전액을 부담해요.", "chat")
  if (!previous.ordered && next.ordered) add("배달 주문이 완료됐어요.", "chat")
  if (!previous.arrived && next.arrived) add("음식이 도착했어요. 만남 장소에서 수령해 주세요.", "receipt")
  if (!previous.cancelled && next.cancelled) add("공동배달 참여가 취소됐어요.", "payment")
  if (!allReceived(previous) && allReceived(next)) add("모두 수령했어요. 거래가 완료됐어요.", "complete")
  return events
}
export const LATE_GRACE_MS = 10 * 60 * 1000
export const LATE_SUSPENSION_MS = 3 * 24 * 60 * 60 * 1000
export const isSuspended = (now: number, until: number) => now < until
export const leaderId = (tx: Transaction) =>
  tx.role === "leader" ? "me" : "leader"
export function recommendMeetings(tx: Transaction) {
  if (tx.application !== "accepted" || tx.people.length < 2) return []
  const leader = tx.people.find((p) => p.id === leaderId(tx))!
  return meetingCandidates
    .map((candidate) => {
      const distances = tx.people.map((person) => ({
        id: person.id,
        name: person.name,
        distance: straightDistance(person.location, candidate.point),
      }))
      const farthest = Math.max(...distances.map((item) => item.distance))
      const average = Math.round(
        distances.reduce((sum, item) => sum + item.distance, 0) / distances.length,
      )
      const leaderDistance = straightDistance(leader.location, candidate.point)
      return { ...candidate, distances, farthest, average, leaderDistance,
        score: farthest * 2 + average + leaderDistance }
    })
    .filter((candidate) => candidate.farthest <= 300)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
}
export const money = (value: number) => `${value.toLocaleString("ko-KR")}원`
export const foodTotal = (p: Person) =>
  p.items.reduce(
    (sum, item) => sum + item.price * (p.quantities[item.id] ?? 0),
    0,
  )
export const deliveryFee = 3000
// Allocate every won exactly once, even when the fee doesn't divide evenly.
export function feeShare(tx: Transaction, id: string) {
  if (tx.nearbyDelivery?.agreed) return tx.nearbyDelivery.requesterId === id ? deliveryFee : 0
  const count = tx.people.length
  const index = tx.people.findIndex((p) => p.id === id)
  return index < 0 || !count
    ? 0
    : Math.floor(deliveryFee / count) + (index < deliveryFee % count ? 1 : 0)
}
export const due = (tx: Transaction, id: string) =>
  foodTotal(tx.people.find((p) => p.id === id)!) + feeShare(tx, id) -
  (id === "me" ? tx.couponDiscount : 0)
export const totalFood = (tx: Transaction) =>
  tx.people.reduce((sum, p) => sum + foodTotal(p), 0)
export const allPaid = (tx: Transaction) =>
  tx.leaderReady &&
  tx.people.length > 1 &&
  tx.people.filter((p) => p.id !== leaderId(tx)).every((p) => p.paid)
export const allReceived = (tx: Transaction) =>
  tx.ordered && tx.arrived && tx.people.every((p) => p.received)
export const isActive = (tx: Transaction | null) =>
  !!tx && !tx.cancelled && tx.application !== "rejected" && !allReceived(tx)
export const recruitmentClosed = (tx: Transaction, now: number) =>
  tx.closed ||
  tx.people.length >= tx.post.maxMembers ||
  (!!tx.post.closesAt && now >= tx.post.closesAt)
export function stepOf(tx: Transaction) {
  if (tx.arrived) return 6
  if (tx.ordered) return 5
  if (tx.menusFinal && allPaid(tx)) return 4
  if (tx.menusFinal) return 3
  if (tx.closed) return 2
  return 1
}
export function statusOf(tx: Transaction) {
  if (tx.cancelled) return "거래 취소"
  if (tx.application === "rejected") return "신청 거절"
  if (tx.application === "pending") return "승인 대기"
  if (allReceived(tx)) return "거래 완료"
  if (!tx.closed && !tx.menusFinal && !tx.ordered) return "모집 중"
  return [
    "모집 완료",
    "메뉴 결정 중",
    "리더 입금 확인 중",
    "주문 준비 완료",
    "배달 중",
    "수령 확인",
  ][stepOf(tx) - 1]
}
export function person(
  id: string,
  name: string,
  items: MenuItem[],
  amount = 0,
): Person {
  const choices =
    amount > 0
      ? [
          { id: 0, name: "선택한 메뉴", price: amount, category: "주문" },
          ...items,
        ]
      : items
  return {
    id,
    name,
    avatar: id === "me" ? "🧑" : "👨",
    items: choices,
    quantities: amount ? { 0: 1 } : {},
    menuConfirmed: amount > 0,
    location:
      id === "leader" || (id === "me" && name.includes("리더"))
        ? { x: 0, y: 0 }
        : id === "me"
          ? { x: -120, y: 35 }
          : id.endsWith("1")
            ? { x: 130, y: 25 }
            : { x: 20, y: -145 },
    transferClaimed: false,
    paid: false,
    received: false,
  }
}
export function makeTransaction(
  post: Post,
  items: MenuItem[],
  role: Transaction["role"],
): Transaction {
  const people =
    role === "leader"
      ? [person("me", "나 (리더)", items, post.currentAmount)]
      : Array.from({ length: post.currentMembers }, (_, i) =>
          person(
            i === 0 ? "leader" : `member-${i}`,
            i === 0 ? post.leaderName : "기존 참여자",
            items,
            Math.floor(post.currentAmount / post.currentMembers) +
              (i === 0 ? post.currentAmount % post.currentMembers : 0),
          ),
        )
  return {
    post,
    role,
    application: role === "leader" ? "accepted" : "pending",
    people,
    decisions: {},
    closed: false,
    menusFinal: false,
    ordered: false,
    arrived: false,
    arrivedAt: null,
    lateReports: {},
    cancelled: false,
    messages: [],
    refund: 0,
    refundCompleted: true,
    leaderReady: false,
    couponDiscount: 0,
    meeting: "",
    meetingTime: "",
    nearbyDelivery: null,
  }
}
export type Action = {
  type: "approve"
  accepted: boolean
  items: MenuItem[]
  now: number
} | {
  type: "decide"
  id: number
  name: string
  accepted: boolean
  items: MenuItem[]
  now: number
  requestedMenu?: string
} | { type: "close" } | { type: "quantity" ; id: number ; delta: number } | {
  type: "menu-confirm"
} | { type: "other-menu" ; id: string } | { type: "finalize" } | {
  type: "claim-transfer" | "confirm-transfer" | "set-location"
  id: string
  point?: Point
} | {
  type: "leader-ready" | "refund-complete"
} | { type: "apply-coupon" | "order" } | { type: "arrive" ; now: number } | {
  type: "mark-late"
  id: string
  now: number
} | { type: "receive" ; id: string } | {
  type: "cancel"
} | { type: "message" ; message: Message } | { type: "meeting" ; value: string } | { type: "meeting-time" ; value: string } | { type: "nearby-propose" ; requesterId: string ; address: string } | { type: "nearby-agree" ; id: string } | { type: "nearby-reset" }
export function transition(tx: Transaction, action: Action): Transaction {
  if (action.type === "refund-complete")
    return tx.cancelled && tx.refund > 0
      ? { ...tx, refundCompleted: true }
      : tx
  if (tx.cancelled || tx.application === "rejected" || allReceived(tx))
    return tx
  const updatePerson = (id: string, fn: (p: Person) => Person) => ({
    ...tx,
    people: tx.people.map((p) => (p.id === id ? fn(p) : p)),
  })
  switch (action.type) {
    case "approve": {
      if (tx.application !== "pending") return tx
      if (!action.accepted) return { ...tx, application: "rejected" }
      if (recruitmentClosed(tx, action.now)) return tx
      const me = person("me", "나", action.items)
      const leaderPoint = postLeaderPoint(tx.post)
      me.location = { x: -leaderPoint.x, y: -leaderPoint.y }
      const people = [...tx.people, me]
      return {
        ...tx,
        application: "accepted",
        people,
        closed: people.length >= tx.post.maxMembers,
      }
    }
    case "decide": {
      if (
        tx.role !== "leader" ||
        tx.decisions[action.id] ||
        recruitmentClosed(tx, action.now)
      )
        return tx
      const decisions = {
        ...tx.decisions,
        [action.id]: action.accepted
          ? "accepted" as const
          : "rejected" as const,
      }
      const member = person(`applicant-${action.id}`, action.name, action.items)
      const requested =
        action.items.find((item) => item.name === action.requestedMenu) ??
        action.items[0]
      if (action.requestedMenu !== "미정") {
        member.quantities = { [requested.id]: 1 }
        member.menuConfirmed = true
      }
      const people = action.accepted ? [...tx.people, member] : tx.people
      return {
        ...tx,
        decisions,
        people,
        closed: people.length >= tx.post.maxMembers,
      }
    }
    case "close":
      return tx.application === "pending"
        ? { ...tx, closed: true, application: "rejected" }
        : { ...tx, closed: true }
    case "quantity": {
      if (tx.application !== "accepted" || tx.menusFinal) return tx
      return updatePerson("me", (p) => ({
        ...p,
        menuConfirmed: false,
        quantities: {
          ...p.quantities,
          [action.id]: Math.max(
            0,
            (p.quantities[action.id] ?? 0) + action.delta,
          ),
        },
      }))
    }
    case "menu-confirm":
      return updatePerson("me", (p) =>
        foodTotal(p) > 0 ? { ...p, menuConfirmed: true } : p,
      )
    case "other-menu":
      return !tx.menusFinal && action.id !== "me"
        ? updatePerson(action.id, (p) => ({
            ...p,
            quantities: { [p.items.find((item) => item.id !== 0)!.id]: 1 },
            menuConfirmed: true,
          }))
        : tx
    case "finalize":
      return tx.closed &&
        tx.people.every((p) => p.menuConfirmed && foodTotal(p) > 0) &&
        totalFood(tx) >= tx.post.minOrderAmount
        ? { ...tx, menusFinal: true }
        : tx
    case "set-location":
      return tx.application === "accepted" && action.point &&
        tx.people.some((p) => p.id === action.id)
        ? updatePerson(action.id, (p) => ({ ...p, location: action.point! }))
        : tx
    case "claim-transfer":
      return tx.menusFinal && !tx.ordered && action.id !== leaderId(tx)
        ? updatePerson(action.id, (p) => ({ ...p, transferClaimed: true }))
        : tx
    case "confirm-transfer":
      return tx.menusFinal && !tx.ordered && action.id !== leaderId(tx) &&
        tx.people.some((p) => p.id === action.id && p.transferClaimed)
        ? updatePerson(action.id, (p) => ({ ...p, paid: true }))
        : tx
    case "leader-ready":
      return tx.menusFinal && !tx.ordered
        ? { ...tx, leaderReady: true }
        : tx
    case "apply-coupon":
      return tx.menusFinal && !tx.ordered && tx.couponDiscount === 0 && feeShare(tx, "me") > 0 &&
        !tx.people.some((p) => p.transferClaimed)
        ? { ...tx, couponDiscount: Math.min(1000, feeShare(tx, "me")) }
        : tx
    case "order":
      return tx.menusFinal && allPaid(tx) ? { ...tx, ordered: true } : tx
    case "arrive":
      return tx.ordered && !tx.arrived
        ? { ...tx, arrived: true, arrivedAt: action.now }
        : tx
    case "mark-late":
      return tx.arrived && tx.arrivedAt !== null &&
        action.now >= tx.arrivedAt + LATE_GRACE_MS &&
        action.id !== leaderId(tx) &&
        tx.people.some((p) => p.id === action.id && !p.received) &&
        !tx.lateReports[action.id]
        ? { ...tx, lateReports: { ...tx.lateReports, [action.id]: action.now } }
        : tx
    case "receive":
      return tx.arrived
        ? updatePerson(action.id, (p) => ({ ...p, received: true }))
        : tx
    case "cancel": {
      if (tx.ordered) return tx
      const refunded =
        tx.role === "leader"
          ? tx.people
              .filter((p) => p.id !== leaderId(tx) && p.transferClaimed)
              .reduce((sum, p) => sum + due(tx, p.id), 0)
          : tx.people.find((p) => p.id === "me")?.transferClaimed
            ? due(tx, "me")
            : 0
      return {
        ...tx,
        cancelled: true,
        refund: refunded,
        refundCompleted: refunded === 0,
      }
    }
    case "message":
      return { ...tx, messages: [...tx.messages, action.message] }
    case "meeting":
      return tx.nearbyDelivery?.agreed ? tx : { ...tx, meeting: action.value }
    case "meeting-time":
      return { ...tx, meetingTime: action.value }
    case "nearby-propose":
      return tx.application === "accepted" && tx.people.length === 2 && !tx.menusFinal &&
        !tx.nearbyDelivery && tx.people.some(p => p.id === action.requesterId) && action.address.trim()
        ? { ...tx, nearbyDelivery: { requesterId: action.requesterId, address: action.address.trim(), agreed: false, wasClosed: tx.closed } }
        : tx
    case "nearby-agree":
      return tx.nearbyDelivery && !tx.nearbyDelivery.agreed && !tx.menusFinal &&
        action.id !== tx.nearbyDelivery.requesterId && tx.people.some(p => p.id === action.id)
        ? { ...tx, nearbyDelivery: { ...tx.nearbyDelivery, agreed: true }, meeting: tx.nearbyDelivery.address, closed: true }
        : tx
    case "nearby-reset":
      return tx.nearbyDelivery && !tx.menusFinal
        ? { ...tx, nearbyDelivery: null, closed: tx.nearbyDelivery.wasClosed, meeting: tx.nearbyDelivery.agreed ? "" : tx.meeting }
        : tx
  }
}
