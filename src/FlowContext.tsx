import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  allReceived,
  isSuspended,
  isActive,
  LATE_SUSPENSION_MS,
  makeTransaction,
  recruitmentClosed,
  transition,
  flowEvents,
  RECRUITMENT_RADIUS,
  type FlowEvent,
  type Action,
  type MenuItem,
  type Post,
  type Transaction,
} from "./workflow"

const START = new Date(2026, 8, 30, 17, 30).getTime()

const asDeadline = (time: string, now: number) => {
  const [hours, minutes] = time.split(":").map(Number)

  const date = new Date(now)
  date.setHours(hours, minutes, 0, 0)

  return date.getTime()
}

export const MENU_BY_CATEGORY: Record<string, MenuItem[]> = {
  치킨: [
    { id: 1, name: "황금올리브치킨", price: 22000, category: "치킨" },
    { id: 2, name: "소이갈릭치킨", price: 22000, category: "치킨" },
    { id: 3, name: "치즈볼 (6개)", price: 4000, category: "사이드" },
    { id: 4, name: "코울슬로", price: 2000, category: "사이드" },
    { id: 5, name: "콜라 1.25L", price: 3000, category: "음료" },
  ],

  피자: [
    { id: 1, name: "페퍼로니 피자", price: 24000, category: "피자" },
    { id: 2, name: "치즈 피자", price: 22000, category: "피자" },
    { id: 3, name: "치즈 스틱", price: 5000, category: "사이드" },
    { id: 5, name: "콜라", price: 2000, category: "음료" },
  ],

  패스트푸드: [
    { id: 1, name: "버거 세트", price: 10500, category: "버거" },
    { id: 2, name: "치킨버거 세트", price: 9500, category: "버거" },
    { id: 3, name: "감자튀김", price: 3500, category: "사이드" },
    { id: 5, name: "콜라", price: 2000, category: "음료" },
  ],

  중식: [
    { id: 1, name: "짜장면", price: 8000, category: "식사" },
    { id: 2, name: "짬뽕", price: 10000, category: "식사" },
    { id: 3, name: "탕수육", price: 18000, category: "사이드" },
  ],
}

export type Review = { stars: number ; comment: string ; tags: string[] }

function useFlowState(initialPosts: Post[]) {
  const [posts, setPosts] = useState<Post[]>(() =>
    initialPosts.map((p) => ({
      ...p,
      closesAt: asDeadline(p.deadline, START),
    })),
  )

  const [selectedId, setSelectedId] = useState(initialPosts[0].id)

  const [category, setCategory] = useState("all")

  const [query, setQuery] = useState("")

  const [tx, setTx] = useState<Transaction | null>(null)

  const [completed, setCompleted] = useState<Transaction[]>([])

  const [reviews, setReviews] =
    useState<Record<number, Record<string, Review>>>({})
  const [reviewDrafts, setReviewDrafts] =
    useState<Record<number, Record<string, Review>>>({})
  const [selectedApplicant, setSelectedApplicant] = useState(1)

  const [notice, setNotice] = useState("")
  const [notifications, setNotifications] = useState<(FlowEvent & { id: number; postId: number; restaurant: string; read: boolean; time: number })[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const previousTx = useRef<Transaction | null>(null)
  const notificationSequence = useRef(0)

  const [clockOffset, setClockOffset] = useState(0)
  const [suspensionUntil, setSuspensionUntil] = useState(0)
  const [couponUsed, setCouponUsed] = useState(false)

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Date.now() - started), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(""), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const now = START + elapsed + clockOffset
  useEffect(() => {
    if (tx) {
      const events = flowEvents(previousTx.current, tx)
      if (events.length) {
        const incoming = events.map(event => ({ ...event, id: ++notificationSequence.current, postId: tx.post.id, restaurant: tx.post.restaurant, read: false, time: now }))
        setNotifications(list => [...incoming.reverse(), ...list].slice(0, 100))
        setNotice(events[events.length - 1].text)
      }
    }
    previousTx.current = tx
  }, [tx])
  const suspended = isSuspended(now, suspensionUntil)
  const myRating = 4.8
  const myTrades = 23 + completed.length
  const couponEligible = myRating >= 4.8 && myTrades >= 5
  const canUseCoupon = couponEligible && !couponUsed && !suspended

  useEffect(() => {
    const reportedAt = tx?.lateReports.me
    if (reportedAt)
      setSuspensionUntil((until) => Math.max(until, reportedAt + LATE_SUSPENSION_MS))
    if (tx?.ordered && tx.couponDiscount > 0) setCouponUsed(true)
  }, [tx])

  useEffect(() => {
    setTx((current) =>
      current &&
      !current.cancelled &&
      !current.closed &&
      recruitmentClosed(current, now)
        ? transition(current, { type: "close" })
        : current,
    )
  }, [now])

  const selectedPost = posts.find((p) => p.id === selectedId) ?? posts[0]

  const active = isActive(tx)

  const menu = MENU_BY_CATEGORY[(tx?.post ?? selectedPost).category] ?? [
    { id: 1, name: "대표 메뉴", price: 10000, category: "메뉴" },
    { id: 2, name: "사이드 메뉴", price: 3000, category: "사이드" },
  ]

  const dispatch = (action: Action) =>
    setTx((current) => {
      if (!current) return current
      if (action.type === "apply-coupon" && !canUseCoupon) return current

      const next = transition(current, action)

      return next
    })

  useEffect(() => {
    if (tx && (allReceived(tx) || (tx.cancelled && tx.role === "leader"))) {
      setPosts(list => list.map(post => post.id === tx.post.id ? { ...post, status: "complete" } : post))
    }
    if (tx && allReceived(tx))
      setCompleted((list) =>
        list.some((t) => t.post.id === tx.post.id) ? list : [...list, tx],
      )
  }, [tx])

  const apply = (post: Post) => {
    if (post.distance > RECRUITMENT_RADIUS) {
      setNotice("700m 이내의 모집글에만 신청할 수 있어요.")
      return false
    }
    if (suspended) {
      setNotice("수령 지각으로 새 공동배달 참여가 일시 제한됐어요. 내 정보에서 기간을 확인해 주세요.")
      return false
    }
    if (active) {
      setNotice("이미 신청했거나 참여 중인 공동배달이 있어요.")
      return false
    }

    if ((post.closesAt ?? Infinity) <= now || post.status !== "recruiting") {
      setNotice("모집이 마감되었어요. 다른 모집글을 확인해 주세요.")
      return false
    }

    setTx(
      makeTransaction(
        post,
        MENU_BY_CATEGORY[post.category] ?? menu,
        "participant",
      ),
    )
    return true
  }

  const create = (input: {
    restaurant: string
    category: string
    maxMembers: string
    deadline: string
    minAmount: string
    currentAmount: string
    deliveryTime: string
    note: string
  }) => {
    if (suspended) {
      setNotice("수령 지각으로 새 모집이 일시 제한됐어요. 내 정보에서 기간을 확인해 주세요.")
      return false
    }
    if (active) {
      setNotice("진행 중인 공동배달을 먼저 마쳐 주세요.")
      return false
    }

    const amount = (s: string) => Number(s.replace(/,/g, "").trim())

    const maxMembers = Number(input.maxMembers)
    const min = amount(input.minAmount)
    const current = amount(input.currentAmount)

    const closesAt = asDeadline(input.deadline, now)

    if (
      !input.restaurant.trim() ||
      !input.category ||
      !input.deadline ||
      !Number.isFinite(closesAt) ||
      !Number.isInteger(maxMembers) ||
      maxMembers < 2 ||
      maxMembers > 10 ||
      !Number.isFinite(min) ||
      min <= 0 ||
      !Number.isFinite(current) ||
      current < 0 ||
      !input.currentAmount.trim() ||
      closesAt <= now ||
      !input.deliveryTime.trim()
    ) {
      setNotice(
        "음식점·카테고리·예정 시간을 입력하고, 인원(2~10명)·양수 금액·시연 시간 이후의 마감을 확인해 주세요.",
      )
      return false
    }

    const template =
      posts.find((p) => p.category === input.category) ?? posts[0]

    const post: Post = {
      ...template,
      id: Date.now(),
      restaurant: input.restaurant.trim(),
      category: input.category,
      maxMembers,
      currentMembers: 1,
      minOrderAmount: min,
      currentAmount: current,
      deadline: input.deadline,
      closesAt,
      deliveryTime: input.deliveryTime,
      description: input.note,
      leaderName: "나",
      leaderRating: 4.8,
      leaderTrades: 23,
      distance: 0,
      status: "recruiting",
    }

    setPosts((list) => [post, ...list])
    setSelectedId(post.id)
    setTx(
      makeTransaction(post, MENU_BY_CATEGORY[post.category] ?? menu, "leader"),
    )
    return true
  }

  const viewPosts = posts.map((p) => {
    if (tx?.post.id === p.id && !tx.cancelled && tx.application !== "rejected")
      return {
        ...p,
        currentMembers: tx.people.length,
        currentAmount: tx.people.reduce(
          (sum, person) =>
            sum +
            person.items.reduce(
              (n, item) => n + item.price * (person.quantities[item.id] ?? 0),
              0,
            ),
          0,
        ),
        status: allReceived(tx)
          ? "complete"
          : tx.ordered
            ? "delivering"
            : tx.menusFinal
              ? "ordering"
              : recruitmentClosed(tx, now)
                ? "full"
                : "recruiting",
      }

    return {
      ...p,
      status:
        tx?.post.id === p.id && tx.cancelled && tx.role === "leader"
          ? "complete"
          : (p.closesAt ?? Infinity) <= now
            ? "full"
            : p.status,
    }
  })

  const reputation = (
    name: string,
    rating: number,
    trades: number,
    reviewCount: number,
  ) => {
    const entries = completed.flatMap((t) =>
      t.people
        .filter((p) => p.name === name && reviews[t.post.id]?.[p.id])
        .map((p) => reviews[t.post.id][p.id]),
    )
    const count = entries.length
    return {
      rating: count
        ? Math.round(
            ((rating * reviewCount +
              entries.reduce((sum, r) => sum + r.stars, 0)) /
              (reviewCount + count)) *
              10,
          ) / 10
        : rating,
      trades:
        trades +
        completed.filter((t) => t.people.some((p) => p.name === name)).length,
      reviews: reviewCount + count,
      entries,
    }
  }
  return {
    posts: viewPosts,
    selectedPost: viewPosts.find((p) => p.id === selectedId) ?? selectedPost,
    selectedId,
    selectPost: setSelectedId,
    category,
    setCategory,
    query,
    setQuery,
    tx,
    active,
    menu,
    dispatch,
    apply,
    create,
    selectedApplicant,
    setSelectedApplicant,
    notice,
    setNotice,
    notifications,
    notificationsOpen,
    setNotificationsOpen,
    unreadCount: notifications.filter(item => !item.read).length,
    readNotification: (id: number) => setNotifications(list => list.map(item => item.id === id ? { ...item, read: true } : item)),
    readAllNotifications: () => setNotifications(list => list.map(item => ({ ...item, read: true }))),
    now,
    advanceClock: () => setClockOffset((offset) => offset + 30 * 60 * 1000),
    advancePenaltyClock: () => setClockOffset((offset) => offset + LATE_SUSPENSION_MS),
    suspensionUntil,
    suspended,
    myRating,
    myTrades,
    couponEligible,
    canUseCoupon,
    couponUsed,
    completed,
    reviews,
    setReviews,
    reviewDrafts,
    setReviewDrafts,
    reputation,
  }
}

type Flow = ReturnType<typeof useFlowState>

const Context = createContext<Flow | null>(null)

export function FlowProvider({
  initialPosts,
  children,
}: {
  initialPosts: Post[]
  children: ReactNode
}) {
  return (
    <Context.Provider value={useFlowState(initialPosts)}>
      {children}
    </Context.Provider>
  )
}

export function useFlow() {
  const flow = useContext(Context)
  if (!flow) throw new Error("FlowProvider is required")
  return flow
}
