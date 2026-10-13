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
  latePenalty,
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
import { CAMPUS_LOCATION, CAMPUS_STORES, CATEGORY_PHOTOS } from "./campus"
import { loadSnapshot, saveSnapshot } from "./prototypeStorage"

const START = new Date(2026, 9, 13, 17, 30).getTime()

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
  한식: [
    { id: 1, name: "김치찌개", price: 9000, category: "식사" },
    { id: 2, name: "제육덮밥", price: 10000, category: "식사" },
    { id: 3, name: "계란말이", price: 5000, category: "사이드" },
  ],
  일식: [
    { id: 1, name: "모둠초밥", price: 14000, category: "식사" },
    { id: 2, name: "우동", price: 8000, category: "식사" },
    { id: 3, name: "새우튀김", price: 6000, category: "사이드" },
  ],
  카페: [
    { id: 1, name: "아메리카노", price: 4500, category: "음료" },
    { id: 2, name: "카페라테", price: 5500, category: "음료" },
    { id: 3, name: "조각 케이크", price: 6500, category: "디저트" },
  ],
  분식: [
    { id: 1, name: "떡볶이", price: 9000, category: "식사" },
    { id: 2, name: "김밥", price: 4500, category: "식사" },
    { id: 3, name: "모둠튀김", price: 5000, category: "사이드" },
  ],
}

export type Review = { stars: number ; comment: string ; tags: string[] }
export type ThemePreference = "light" | "dark" | "system"
export type UserReport = { id: number; postId: number; person: string; reason: string; detail: string; status: "검토 대기"; createdAt: number }

function useFlowState(initialPosts: Post[]) {
  const [saved] = useState(() => loadSnapshot())
  const [posts, setPosts] = useState<Post[]>(() =>
    saved?.posts.map(p => {
      const seed = initialPosts.find(seed => seed.id === p.id && seed.restaurant === p.restaurant)
      return seed ? { ...p, imageId: seed.imageId, leaderRating: seed.leaderRating } : p
    }) ?? initialPosts.map((p) => ({
      ...p,
      closesAt: asDeadline(p.deadline, START),
    })),
  )

  const [selectedId, setSelectedId] = useState(saved?.selectedId ?? initialPosts[0].id)

  const [category, setCategory] = useState("all")

  const [query, setQuery] = useState("")
  const [browseView, setBrowseView] = useState<"list" | "map">("list")
  const [myLocation, setMyLocation] = useState(saved?.myLocation ?? CAMPUS_LOCATION)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      const stored = window.localStorage.getItem("group-delivery-theme")
      return stored === "light" || stored === "dark" ? stored : "system"
    } catch { return "system" }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches)
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => setSystemDark(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  useEffect(() => { try { window.localStorage.setItem("group-delivery-theme", themePreference) } catch { /* Continue without saving the theme. */ } }, [themePreference])

  const [tx, setTx] = useState<Transaction | null>(saved?.tx ?? null)

  const [completed, setCompleted] = useState<Transaction[]>(saved?.completed ?? [])

  const [reviews, setReviews] =
    useState<Record<number, Record<string, Review>>>(saved?.reviews ?? {})
  const [reviewDrafts, setReviewDrafts] =
    useState<Record<number, Record<string, Review>>>({})
  const [selectedApplicant, setSelectedApplicant] = useState(1)

  const [notice, setNotice] = useState("")
  const [notifications, setNotifications] = useState<(FlowEvent & { id: number; postId: number; restaurant: string; read: boolean; time: number })[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const previousTx = useRef<Transaction | null>(saved?.tx ?? null)
  const notificationSequence = useRef(0)

  const [clockOffset, setClockOffset] = useState(saved?.clockOffset ?? 0)
  const [suspensionUntil, setSuspensionUntil] = useState(saved?.suspensionUntil ?? 0)
  const [couponUsed, setCouponUsed] = useState(saved?.couponUsed ?? false)
  const [reports, setReports] = useState<UserReport[]>(saved?.reports ?? [])

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
  const storageFailed = useRef(false)
  useEffect(() => {
    if (!saveSnapshot({ posts, selectedId, tx, completed, reviews, myLocation, clockOffset: clockOffset + elapsed, suspensionUntil, couponUsed, reports }) && !storageFailed.current) {
      storageFailed.current = true
      setNotice("이 브라우저에서는 저장이 제한돼요. 새로고침하면 진행 상태가 초기화될 수 있어요.")
    }
  }, [posts, selectedId, tx, completed, reviews, myLocation, clockOffset, suspensionUntil, couponUsed, reports, Math.floor(elapsed / 10000)])
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
  const penalty = latePenalty([...completed, ...(tx ? [tx] : [])])
  const lateIncidentCount = penalty.count

  useEffect(() => {
    if (penalty.until)
      setSuspensionUntil((until) => Math.max(until, penalty.until))
    if (tx?.ordered && tx.couponDiscount > 0) setCouponUsed(true)
  }, [tx, penalty.until])

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

  const menu = (tx?.post ?? selectedPost).menus ?? MENU_BY_CATEGORY[(tx?.post ?? selectedPost).category] ?? [
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
        post.menus ?? MENU_BY_CATEGORY[post.category] ?? menu,
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

    const store = CAMPUS_STORES.find(s => s.name === input.restaurant.trim() && s.category === input.category)
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
      menus: store?.menus ?? MENU_BY_CATEGORY[input.category],
      storeSource: store?.source,
      imageId: store?.imageId ?? CATEGORY_PHOTOS[input.category] ?? template.imageId,
      emoji: store?.emoji ?? ({ 치킨: "🍗", 피자: "🍕", 한식: "🍱", 중식: "🥡", 패스트푸드: "🍔", 일식: "🍣", 카페: "☕", 분식: "🍢" }[input.category] ?? "🍽️"),
    }

    setPosts((list) => [post, ...list])
    setSelectedId(post.id)
    setTx(
      makeTransaction(post, post.menus ?? MENU_BY_CATEGORY[post.category] ?? menu, "leader"),
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
    browseView,
    setBrowseView,
    myLocation,
    setMyLocation,
    themePreference,
    setThemePreference,
    isDark: themePreference === "dark" || (themePreference === "system" && systemDark),
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
    lateIncidentCount,
    reports,
    submitReport: (postId: number, person: string, reason: string, detail: string) => {
      if (!reason || !person || person === "나") return false
      if (reports.some(r => r.postId === postId && r.person === person)) {
        setNotice("이 거래의 해당 사용자 신고는 이미 접수됐어요.")
        return false
      }
      setReports(list => [{ id: Date.now(), postId, person, reason, detail: detail.trim(), status: "검토 대기", createdAt: now }, ...list])
      setNotice("신고를 저장했어요. 시연용 검토 대기 상태이며 자동으로 이용을 제한하지 않아요.")
      return true
    },
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
