import { lazy, Suspense, useEffect, useRef, useState } from "react"
import type { MapPin } from "./LocationMap"
import { CAMPUS_POSTS, CAMPUS_STORES, WALKING_NOTE, MENU_CHECKED_ON } from "./campus"
import { ReportControl } from "./ReportControl"

import { FlowProvider, MENU_BY_CATEGORY, useFlow } from "./FlowContext"

import {
  allReceived,
  recruitmentClosed,
  statusOf,
  money,
  due,
  deliveryFee,
  feeShare,
  RECRUITMENT_RADIUS,
  postLeaderPoint,
} from "./workflow"

const LocationMap = lazy(() => import("./LocationMap"))

import {
  FlowBar,
  DetailActions,
  Applicants as ApplicantsScreen,
  Chat as ChatScreen,
  Menu as MenuScreen,
  Payment as PaymentScreen,
  Delivery as DeliveryScreen,
  Receipt as ReceiptScreen,
  Complete as CompleteScreen,
  Rating as RatingScreen,
} from "./WorkflowScreens"

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "main" | "category" | "list" | "detail" | "create" | "applicants" | "applicantProfile" | "chat" | "menu" | "payment" | "delivery" | "receipt" | "complete" | "rating" | "profile"

type Tab = "explore" | "new" | "chat" | "me"

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all", label: "전체", emoji: "🍽️" },

  { id: "chicken", label: "치킨", emoji: "🍗" },

  { id: "pizza", label: "피자", emoji: "🍕" },

  { id: "korean", label: "한식", emoji: "🍜" },

  { id: "chinese", label: "중식", emoji: "🥡" },

  { id: "fastfood", label: "패스트푸드", emoji: "🥪" },

  { id: "japanese", label: "일식", emoji: "🍱" },

  { id: "cafe", label: "카페", emoji: "☕" },

  { id: "snack", label: "분식", emoji: "🍢" },

  { id: "burger", label: "버거", emoji: "🍔" },
]
const CATEGORY_COLOR: Record<string, string> = {
  치킨: "category-chicken", 피자: "category-pizza", 한식: "category-korean",
  중식: "category-chinese", 패스트푸드: "category-fastfood", 일식: "category-japanese",
  카페: "category-cafe", 분식: "category-snack",
}
const categoryStyle = (category: string) => "category-chip " + (CATEGORY_COLOR[category === "버거" ? "패스트푸드" : category] ?? "")
let lastListScroll = 0

const DEMO_POSTS = CAMPUS_POSTS

const APPLICANTS = [
  {
    id: 1,

    name: "점심파이터",

    rating: 4.6,

    trades: 18,

    reviews: 14,

    avatar: "🧑",

    lastActive: "방금 전",

    requestedMenu: "뿌링클",

    reviewSnippets: [
      "약속 시간 칼같이 지켜요",
      "친절하고 매너 좋아요",
      "재거래 의사 있어요",
    ],
  },

  {
    id: 2,

    name: "주말배달러",

    rating: 4.3,

    trades: 9,

    reviews: 7,

    avatar: "👩",

    lastActive: "5분 전",

    requestedMenu: "미정",

    reviewSnippets: ["소통이 잘 되어요", "빠른 응답!"],
  },

  {
    id: 3,

    name: "치킨마니아",

    rating: 4.9,

    trades: 47,

    reviews: 38,

    avatar: "🧔",

    lastActive: "방금 전",

    requestedMenu: "황금올리브치킨",

    reviewSnippets: [
      "최고의 파티원",
      "거래 경험 풍부해요",
      "믿음직스러워요",
      "언제나 환영",
    ],
  },
]

// ─── Icons ────────────────────────────────────────────────────────────────────

const IcSearch = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    className="w-5 h-5"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const IcBack = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    className="w-5 h-5"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
)

const IcClose = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    className="w-5 h-5"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

const IcLocation = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
)

const IcPlus = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    className="w-5 h-5"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const IcMinus = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    className="w-5 h-5"
  >
    <path d="M5 12h14" />
  </svg>
)

const IcSend = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
)

const IcCheck = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    className="w-5 h-5"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const IcStar = ({ filled = true }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.5}
    className="w-4 h-4"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

const IcPeople = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)

const IcClock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    className="w-4 h-4"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const IcBell = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    className="w-5 h-5"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const IcMenu = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    className="w-5 h-5"
  >
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const IcWallet = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    className="w-5 h-5"
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </svg>
)

// ─── Shared Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string ; cls: string }> = {
    recruiting: { label: "모집 중", cls: "bg-orange-100 text-orange-600" },

    full: { label: "모집 완료", cls: "bg-blue-100 text-blue-600" },

    ordering: { label: "주문 중", cls: "bg-purple-100 text-purple-600" },

    delivering: { label: "배달 중", cls: "bg-green-100 text-green-600" },

    complete: { label: "거래 완료", cls: "bg-gray-100 text-gray-500" },
  }

  const s = map[status] ?? map.recruiting

  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}
      style={{ fontFamily: "Noto Sans KR" }}
    >
      {s.label}
    </span>
  )
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating)

  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= full ? "text-amber-400" : "text-gray-200"}
        >
          <IcStar filled={i <= full} />
        </span>
      ))}
      <span
        className="text-gray-600 text-xs ml-1"
        style={{ fontFamily: "Outfit" }}
      >
        {rating}
      </span>
    </span>
  )
}

function AmountBar({ current, min }: { current: number ; min: number }) {
  const pct = Math.min((current / min) * 100, 100)

  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(to right, #FF5500, #FF9500)",
        }}
      />
    </div>
  )
}

function Header({
  title,
  onBack,
  right,
  transparent = false,
}: {
  title?: string
  onBack?: () => void
  right?: React.ReactNode
  transparent?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between h-14 px-4 ${
        transparent ? "" : "bg-white border-b border-gray-100"
      }`}
    >
      <div className="w-10">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-700 rounded-xl active:bg-gray-100"
          >
            <IcBack />
          </button>
        )}
      </div>
      <span
        className="font-semibold text-gray-900"
        style={{ fontFamily: "Noto Sans KR" }}
      >
        {title}
      </span>
      <div className="w-10 flex justify-end">{right}</div>
    </div>
  )
}

// ─── POST CARD ─────────────────────────────────────────────────────────────────
function FoodPhoto({ post, height }: { post: (typeof CAMPUS_POSTS)[0]; height: number }) {
  const [failed, setFailed] = useState(false)
  const alt = `${post.category} 참고 사진 · 실제 매장 음식 사진 아님`
  return failed ? <div role="img" aria-label={alt} className="w-full h-full flex items-center justify-center text-6xl">{post.emoji}</div> : <img src={`https://images.unsplash.com/photo-${post.imageId}?w=500&h=${height}&fit=crop&auto=format`} alt={alt} onError={() => setFailed(true)} className="w-full h-full object-cover" />
}

function PostCard({
  post,
  onClick,
}: {
  post: (typeof CAMPUS_POSTS)[0]
  onClick: () => void
}) {
  const remaining = post.minOrderAmount - post.currentAmount

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 active:scale-[0.98] transition-all text-left"
    >
      {/* food image */}
      <div
        className="h-36 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${post.gradFrom}, ${post.gradTo})`,
        }}
      >
        <FoodPhoto key={post.imageId} post={post} height={200} />
        <div className="absolute inset-0 flex flex-col justify-between p-3 bg-gradient-to-t from-black/75 via-black/10 to-transparent">
          <div className="flex justify-between items-start">
            <StatusBadge status={post.status} />
            <span className="text-2xl">{post.emoji}</span>
          </div>
          <div>
            <div
              className="text-white font-bold text-base leading-tight"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              {post.restaurant}
            </div>
            <div
              className="text-white/80 text-xs mt-0.5"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              {post.category}
            </div>
          </div>
        </div>
      </div>

      {/* details */}
      <div className="p-3 space-y-2.5">
        <p className="text-[10px] text-gray-400">음식 종류 참고 사진</p>
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${categoryStyle(post.category)}`}>{post.emoji} {post.category}</span>
          <span className="text-xs font-semibold text-green-700">배달비 약 {money(deliveryFee - Math.ceil(deliveryFee / Math.min(post.currentMembers + 1, post.maxMembers)))} 절약</span>
        </div>
        <p className="text-xs text-gray-600">수령 이동 약 {post.distance}m · 도보 약 {Math.max(1, Math.ceil(post.distance / 75))}분 <span className="text-gray-400">(시연 추정)</span></p>
        {/* progress */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span
              className="text-xs text-gray-500"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              현재{" "}
              <span
                className="text-gray-900 font-semibold"
                style={{ fontFamily: "Outfit" }}
              >
                {post.currentAmount.toLocaleString()}
              </span>
              원 / 최소{" "}
              <span style={{ fontFamily: "Outfit" }}>
                {post.minOrderAmount.toLocaleString()}
              </span>
              원
            </span>
            {remaining > 0 ? (
              <span
                className="text-xs text-brand font-semibold"
                style={{ fontFamily: "Outfit" }}
              >
                {remaining.toLocaleString()}원 남음
              </span>
            ) : (
              <span
                className="text-xs text-success font-semibold"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                달성!
              </span>
            )}
          </div>
          <AmountBar current={post.currentAmount} min={post.minOrderAmount} />
        </div>

        {/* meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <IcPeople />{" "}
              <span style={{ fontFamily: "Noto Sans KR" }}>
                {post.currentMembers}/{post.maxMembers}명
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <IcClock />{" "}
              <span style={{ fontFamily: "Outfit" }}>{post.deadline}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <IcLocation />
            <span style={{ fontFamily: "Outfit" }}>{post.distance}m</span>
          </div>
        </div>

        {/* leader */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span
            className="text-xs text-gray-500"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            리더{" "}
            <span className="text-gray-700 font-medium">{post.leaderName}</span>
          </span>
          <div className="flex items-center gap-1 text-amber-400">
            <IcStar />
            <span
              className="text-xs text-gray-600"
              style={{ fontFamily: "Outfit" }}
            >
              {post.leaderRating} · {post.leaderTrades}회
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────

function BottomNav({ tab, onTab }: { tab: Tab ; onTab: (t: Tab) => void }) {
  const items: { id: Tab ; label: string ; icon: React.ReactNode }[] = [
    {
      id: "explore",
      label: "탐색",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    },

    {
      id: "new",
      label: "모집하기",
      icon: (
        <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center text-white">
          <IcPlus />
        </div>
      ),
    },

    {
      id: "chat",
      label: "채팅",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-5 h-5"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },

    {
      id: "me",
      label: "내 정보",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-5 h-5"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-100 flex safe-area-inset-bottom">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onTab(item.id)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-1"
        >
          <span className={item.id === tab ? "text-brand" : "text-gray-400"}>
            {item.icon}
          </span>
          <span
            className={`text-[10px] font-semibold ${
              item.id === tab ? "text-brand" : "text-gray-400"
            }`}
            style={{ fontFamily: "Noto Sans KR" }}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── SCREEN 1: MAIN ───────────────────────────────────────────────────────────

function MainScreen({ push }: { push: (s: Screen) => void }) {
  const { posts, tx, active, selectPost, setCategory, setQuery, myLocation, setMyLocation, setNotice, setBrowseView } = useFlow()
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState(myLocation)
  const showAllPosts = () => {
    lastListScroll = 0
    setCategory("all")
    setQuery("")
    push("list")
  }

  return (
    <div className="app-page flex-1 overflow-y-auto">
      {/* top bar */}
      {locationOpen && (
        <div className="absolute inset-0 z-40 bg-black/30 flex items-center justify-center p-5" onKeyDown={event => { if (event.key === "Escape") setLocationOpen(false) }}>
          <form role="dialog" aria-modal="true" aria-labelledby="location-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onSubmit={event => {
            event.preventDefault()
            const value = locationDraft.trim()
            if (!value) return
            setMyLocation(value)
            setLocationOpen(false)
            setNotice("내 위치를 저장했어요.")
          }}>
            <h2 id="location-title" className="font-bold text-lg">내 위치 입력</h2>
            <label htmlFor="my-location" className="block text-sm text-gray-600 mt-4 mb-2">주소 또는 동네 이름</label>
            <input id="my-location" autoFocus required maxLength={100} value={locationDraft} onChange={event => setLocationDraft(event.target.value)} placeholder="예: 대전 유성구 궁동" className="w-full min-w-0 rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-brand" />
            <p className="mt-2 text-xs text-gray-500">모집글 거리는 시연용이며 입력한 주소로 실제 거리를 계산하지 않아요.</p>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setLocationOpen(false)} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm">취소</button>
              <button type="submit" disabled={!locationDraft.trim()} className="flex-1 rounded-xl bg-brand text-white py-3 text-sm font-bold disabled:opacity-40">위치 저장</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white px-4 pt-2 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            aria-label="내 위치 입력"
            onClick={() => {
              setLocationDraft(myLocation)
              setLocationOpen(true)
            }}
            className="flex min-w-0 items-center gap-1 text-gray-800"
          >
            <IcLocation />
            <span
              className="font-semibold text-base truncate max-w-[230px]"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              {myLocation}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="w-4 h-4 text-gray-400"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className="flex gap-2">
            <span className="text-xs text-gray-400">주변 700m</span>
          </div>
        </div>
        {/* search */}
        <button
          onClick={showAllPosts}
          className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-4 h-11 text-gray-400 border border-gray-100"
        >
          <IcSearch />
          <span className="text-sm" style={{ fontFamily: "Noto Sans KR" }}>
            음식점, 음식 카테고리 검색
          </span>
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {!active && <section className="campus-value rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-brand">충남대에서 함께 주문해요</p>
          <h1 className="font-bold text-xl leading-snug">잠깐 걸어서 만나고,<br />배달비는 함께 나눠요.</h1>
          <p className="text-sm text-gray-600">배달비 3,000원을 3명이 나누면<br /><b className="text-green-700">한 사람당 2,000원 절약</b>할 수 있어요.</p>
          <p className="text-[11px] text-gray-500">수령 장소와 도보 시간을 확인하고 참여하세요. 금액·거리는 시연용 예상치예요.</p>
          <button onClick={showAllPosts} className="w-full rounded-xl bg-brand py-3 text-white text-sm font-bold">가까운 모집글 둘러보기</button>
        </section>}
        <button onClick={() => { setBrowseView("map"); showAllPosts() }} className="map-entry w-full rounded-2xl p-4 flex items-center justify-between text-left">
          <div><p className="font-bold text-sm">🗺️ 지도에서 모집글 찾기</p><p className="text-xs text-gray-500 mt-1">주변 700m · 음식 아이콘을 눌러 확인해요</p></div><span aria-hidden="true">›</span>
        </button>
        {/* categories */}
        <div>
          <button onClick={() => push("category")} className="font-bold text-gray-900 mb-3" style={{ fontFamily: "Noto Sans KR" }}>카테고리</button>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  lastListScroll = 0
                  setCategory(c.id)
                  setQuery("")
                  push("list")
                }}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all ${c.id === "all" ? "bg-white" : categoryStyle(c.label)}`}
              >
                <span className="text-xl">{c.emoji}</span>
                <span
                  className="text-[10px] text-gray-600 font-medium leading-tight"
                  style={{ fontFamily: "Noto Sans KR" }}
                >
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* active delivery banner */}
        {active && <button
          onClick={() => {
            if (active && tx) {
              selectPost(tx.post.id)
              push(
                tx.application === "pending"
                  ? "detail"
                  : tx.role === "leader" && !tx.closed
                    ? "applicants"
                    : "chat",
              )
            } else showAllPosts()
          }}
          className="prototype-banner w-full bg-white rounded-2xl p-4 border border-orange-200 shadow-sm active:scale-[0.98] transition-all text-left"

        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-xs text-brand font-semibold mb-1"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {active
                  ? "진행 중인 공동배달"
                  : "함께 주문할 사람을 찾아보세요"}
              </div>
              <div
                className="font-bold text-gray-900"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {active && tx
                  ? tx.post.restaurant
                  : "근처 공동배달 모집글 보기"}
              </div>
              <div
                className="text-xs text-gray-500 mt-0.5"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {active && tx
                  ? `${statusOf(tx)} · ${tx.people.length}명`
                  : "700m 이내 · 가까운 순으로 탐색"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-white shadow-sm">
                🍗
              </div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-4 h-4 text-gray-400"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </div>
        </button>}

        {/* nearby posts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="font-bold text-gray-900"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              근처 모집 중
            </h2>
            <button
              onClick={showAllPosts}
              className="text-xs text-brand font-medium"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              전체보기
            </button>
          </div>
          <div className="space-y-3">
            {posts
              .filter((p) => p.distance <= RECRUITMENT_RADIUS && p.status === "recruiting")
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 6)
              .map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onClick={() => {
                    selectPost(p.id)
                    push("detail")
                  }}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SCREEN 2: CATEGORY ───────────────────────────────────────────────────────

function CategoryScreen({
  pop,
  push,
}: {
  pop: () => void
  push: (s: Screen) => void
}) {
  const { category: sel, setCategory: setSel, setQuery } = useFlow()

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <Header title="음식 카테고리" onBack={pop} />
      <div className="px-4 py-4">
        <p
          className="text-sm text-gray-500 mb-4"
          style={{ fontFamily: "Noto Sans KR" }}
        >
          원하는 음식 종류를 선택해서 모집글을 탐색해 보세요.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                lastListScroll = 0
                setSel(c.id)
                setQuery("")
                push("list")
              }}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                sel === c.id
                  ? "border-brand bg-brand-50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <span className="text-2xl">{c.emoji}</span>
              <span
                className={`text-xs font-semibold ${
                  sel === c.id ? "text-brand" : "text-gray-600"
                }`}
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {c.label}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => push("list")}
          className="w-full mt-6 h-12 bg-brand text-white rounded-2xl font-bold text-sm active:opacity-90"
          style={{ fontFamily: "Noto Sans KR" }}
        >
          {sel === "all"
            ? "전체 모집글 보기"
            : `'${CATEGORIES.find((c) => c.id === sel)?.label}' 모집글 보기`}
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 3: LIST ───────────────────────────────────────────────────────────

function ListScreen({
  pop,
  push,
}: {
  pop: () => void
  push: (s: Screen) => void
}) {
  const {
    category: activeCat,
    setCategory: setActiveCat,
    posts,
    selectPost,
    query,
    setQuery,
    browseView,
    setBrowseView,
    selectedId,
  } = useFlow()
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = lastListScroll
  }, [])
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")

  const visible = posts
    .filter(
      (p) =>
        p.distance <= RECRUITMENT_RADIUS &&
        p.status === "recruiting" &&
        (activeCat === "all" ||
          p.category === CATEGORIES.find((c) => c.id === activeCat)?.label) &&
        (!normalizedQuery || [p.restaurant, p.category, ...(p.menus ?? MENU_BY_CATEGORY[p.category] ?? []).map(item => item.name)]
          .some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery))),
    )
    .sort((a, b) => a.distance - b.distance)

  const selectedMapPost = visible.find(post => post.id === selectedId) ?? visible[0]
  const mapPins: MapPin[] = [
    { id: "me", point: { x: 0, y: 0 }, label: "내 시연 위치", symbol: "나", kind: "me" },
    ...visible.map(post => ({ id: String(post.id), point: postLeaderPoint(post), label: `${post.restaurant} · ${post.distance}m · ${post.currentMembers}/${post.maxMembers}명`, symbol: post.emoji, kind: "post" as const })),
  ]

  return (
    <div ref={scrollRef} onScroll={event => { if (browseView === "list") lastListScroll = event.currentTarget.scrollTop }} className={`app-page flex-1 min-h-0 ${browseView === "map" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={pop}
            className="p-2 -ml-2 text-gray-700 rounded-xl active:bg-gray-100"
          >
            <IcBack />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 h-9 border border-gray-100 text-gray-400">
            <IcSearch />
            <input
              aria-label="음식점 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="음식점·음식 종류·메뉴 검색"
              className="w-full min-w-0 bg-transparent text-sm outline-none text-gray-700"
            />
          </div>
          {query && <button aria-label="검색어 지우기" onClick={() => setQuery("")} className="text-sm text-gray-500 px-2">×</button>}
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                lastListScroll = 0
                setActiveCat(c.id)
                setQuery("")
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCat === c.id
                  ? "bg-brand text-white"
                  : c.id === "all" ? "bg-gray-100 text-gray-600" : categoryStyle(c.label)
              }`}
              style={{ fontFamily: "Noto Sans KR" }}
            >
              <span className="text-xs">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        <span
          className="text-sm text-gray-500"
          style={{ fontFamily: "Noto Sans KR" }}
        >
          주변{" "}
          <span
            className="font-semibold text-gray-800"
            style={{ fontFamily: "Outfit" }}
          >
            700m
          </span>{" "}
          이내 · {visible.length}개
        </span>
        <div className="map-view-toggle flex gap-1 rounded-xl p-1" aria-label="모집글 보기 방식">
          {(["list", "map"] as const).map(view => <button key={view} aria-pressed={browseView === view} onClick={() => { setBrowseView(view); if (view === "list") requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = lastListScroll }) }} className={`px-3 py-1.5 rounded-lg text-xs ${browseView === view ? "map-view-active font-bold" : "text-gray-500"}`}>{view === "map" ? "지도" : "목록"}</button>)}
        </div>
      </div>

      {browseView === "map" ? <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 gap-2 overflow-y-auto">
        <p className="text-[10px] text-gray-500 shrink-0">충남대학교 정문 주변 시연 위치 · 음식점 대신 모집 리더의 위치를 표시해요</p>
        <Suspense fallback={<div className="map-loading flex-1 min-h-[260px] rounded-2xl flex items-center justify-center text-sm">지도 불러오는 중…</div>}>
          <LocationMap pins={mapPins} selectedId={selectedMapPost ? String(selectedMapPost.id) : undefined} onSelect={id => { if (id !== "me") selectPost(Number(id)) }} radius={RECRUITMENT_RADIUS} title="주변 공동배달 모집글 지도" />
        </Suspense>
        {selectedMapPost ? <section className="map-selection shrink-0 rounded-2xl p-3 space-y-2" aria-label="선택한 모집글">
          <label className="flex gap-2 items-center text-xs text-gray-500">모집글 선택<select aria-label="지도에서 모집글 선택" value={selectedMapPost.id} onChange={event => selectPost(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg py-1 px-2 bg-gray-50 text-gray-800">{visible.map(post => <option key={post.id} value={post.id}>{post.emoji} {post.restaurant} · {post.distance}m</option>)}</select></label>
          <div className="flex items-center justify-between gap-2"><div className="min-w-0"><h2 className="text-sm font-bold truncate">{selectedMapPost.restaurant}</h2><p className="mt-1 text-[11px] text-gray-500">{selectedMapPost.currentMembers}/{selectedMapPost.maxMembers}명 · {selectedMapPost.distance}m · {selectedMapPost.deadline} 마감</p></div><button onClick={() => { selectPost(selectedMapPost.id); push("detail") }} className="shrink-0 bg-brand text-white rounded-xl px-4 py-3 text-xs font-bold">상세 보기</button></div>
        </section> : <div className="map-selection shrink-0 p-4 rounded-2xl text-center text-xs"><p>조건에 맞는 모집글이 없어요.</p><button onClick={() => { setActiveCat("all"); setQuery("") }} className="mt-2 text-brand font-semibold">전체 모집글 보기</button></div>}
      </div> : <div className="px-4 pb-4 space-y-3">
        {visible.length === 0 && (
          <div className="text-center p-8 text-sm text-gray-500">
            조건에 맞는 모집글이 없어요.
            <button
              onClick={() => {
                setActiveCat("all")
                setQuery("")
              }}
              className="block mx-auto mt-4 text-brand font-semibold"
            >
              전체 모집글 보기
            </button>
          </div>
        )}
        {visible.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onClick={() => {
              selectPost(p.id)
              push("detail")
            }}
          />
        ))}
      </div>}
    </div>
  )
}

// ─── SCREEN 4: DETAIL ─────────────────────────────────────────────────────────

function DetailScreen({
  pop,
  push,
}: {
  pop: () => void
  push: (s: Screen) => void
}) {
  const { selectedPost: post, tx, setSelectedApplicant } = useFlow()

  const remaining = post.minOrderAmount - post.currentAmount
  const joined = tx?.post.id === post.id && tx.application === "accepted" && !tx.cancelled
  const estimatedPeople = joined ? tx.people.length : Math.min(post.maxMembers, post.currentMembers + 1)
  const estimatedFee = joined ? feeShare(tx, "me") : Math.ceil(deliveryFee / estimatedPeople)

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* hero */}
      <div
        className="h-52 relative"
        style={{
          background: `linear-gradient(135deg, ${post.gradFrom}, ${post.gradTo})`,
        }}
      >
        <FoodPhoto key={post.imageId} post={post} height={280} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <button
            onClick={pop}
            className="w-9 h-9 bg-black/30 rounded-xl flex items-center justify-center text-white backdrop-blur-sm"
          >
            <IcBack />
          </button>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <StatusBadge status={post.status} />
          <div
            className="text-white font-bold text-xl mt-1"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            {post.restaurant}
          </div>
          <div
            className="text-white/80 text-sm"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            {post.category} · 충남대 주변
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <section className="campus-value rounded-2xl p-4 text-sm space-y-2">
          <h2 className="font-bold text-lg text-green-700">예상 배달비 {money(deliveryFee - estimatedFee)} 절약</h2>
          <p className="font-semibold">수령 이동 약 {post.distance}m · 도보 약 {Math.max(1, Math.ceil(post.distance / 75))}분</p>
          <p className="text-xs text-gray-500">혼자 {money(deliveryFee)} → 내 배달비 약 {money(estimatedFee)} · {estimatedPeople}명 기준</p>
          <p className="text-[11px] text-gray-500">{WALKING_NOTE}</p>
          <details className="text-xs text-gray-600"><summary className="cursor-pointer py-1">이동이 부담된다면?</summary><p className="pt-2">2인 거래에서 ‘내 근처에서 받기’를 합의할 수 있어요. 요청자 근처로 배달 주소를 정하고, 요청자가 배달비 3,000원 전액을 부담해요. 이동하는 사람의 배달비는 0원이에요.</p></details>
        </section>
        <div className="text-[11px] text-gray-500 space-y-1">
          <p>사진은 음식 종류 참고 사진 · 모집 위치·최소주문금액·배달비는 시연 조건이에요.</p>
          <p>{post.menuBasis ?? "직접 입력한 가게 · 메뉴는 시연용"} {post.menuSource && <> · <a href={post.menuSource} target="_blank" rel="noopener noreferrer" className="underline">메뉴 정보 출처</a></>}</p>
          <p>{post.priceNote ?? "가격과 실제 판매 메뉴는 주문 전 확인이 필요해요."}</p>
          {post.storeSource && <details><summary className="cursor-pointer py-1">가게 정보 · 자료 확인일</summary><p>{MENU_CHECKED_ON} · <a href={post.storeSource} target="_blank" rel="noopener noreferrer" className="underline">가게 정보 출처</a></p></details>}
        </div>
        {post.menus && <details className="bg-white rounded-xl border border-gray-100 p-4">
          <summary className="cursor-pointer text-sm font-bold">메뉴 미리 보기 · {post.menus.length}개</summary>
          <div className="mt-3 divide-y divide-gray-100">{post.menus.map(item => <div key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span>{item.name}</span><span className="shrink-0 text-gray-500">{money(item.price)}</span></div>)}</div>
          <p className="text-[11px] text-gray-500 mt-2">선택과 수량 입력은 참여 수락 후 채팅방에서 진행해요. 표시 가격은 참고값 또는 시연값이에요.</p>
        </details>}
        {/* amount */}
        <div className="bg-brand-50 rounded-2xl p-4">
          <div className="flex justify-between items-end mb-2">
            <div>
              <div
                className="text-xs text-gray-500 mb-0.5"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                현재 주문 금액
              </div>
              <div
                className="text-2xl font-black text-gray-900"
                style={{ fontFamily: "Outfit" }}
              >
                {post.currentAmount.toLocaleString()}원
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-xs text-gray-500 mb-0.5"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                최소주문금액
              </div>
              <div
                className="text-lg font-bold text-gray-700"
                style={{ fontFamily: "Outfit" }}
              >
                {post.minOrderAmount.toLocaleString()}원
              </div>
            </div>
          </div>
          <AmountBar current={post.currentAmount} min={post.minOrderAmount} />
          <div
            className="text-xs text-brand font-semibold mt-1.5"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            {remaining > 0
              ? `최소주문금액까지 ${remaining.toLocaleString()}원 남음`
              : "✅ 최소주문금액 달성!"}
          </div>
        </div>

        {/* info grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "모집 인원",
              value: `${post.currentMembers}/${post.maxMembers}명`,
              icon: "👥",
            },

            { label: "모집 마감", value: post.deadline, icon: "⏰" },

            { label: "예상 거리", value: `${post.distance}m`, icon: "📍" },

            {
              label: "배달 예정",
              value: post.deliveryTime || "19:00–19:30",
              icon: "🚴",
            },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3">
              <div className="text-base mb-1">{item.icon}</div>
              <div
                className="text-xs text-gray-500 mb-0.5"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {item.label}
              </div>
              <div
                className="font-semibold text-gray-900 text-sm"
                style={{
                  fontFamily:
                    item.label === "모집 마감" ||
                    item.label === "예상 거리" ||
                    item.label === "배달 예정"
                      ? "Outfit"
                      : "Noto Sans KR",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* leader */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
          <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center text-xl">
            👨
          </div>
          <div className="flex-1">
            <div
              className="font-semibold text-gray-900"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              {post.leaderName}
            </div>
            <Stars rating={post.leaderRating} />
            <div
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              공동배달 {post.leaderTrades}회
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedApplicant(0)
              push("applicantProfile")
            }}
            className="text-xs text-brand font-medium border border-brand/30 rounded-lg px-2.5 py-1.5"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            프로필
          </button>
        </div>

        {/* description */}
        {post.description && (
          <div className="p-4 border border-gray-100 rounded-2xl">
            <div
              className="text-xs text-gray-400 mb-1.5"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              리더 메시지
            </div>
            <p
              className="text-sm text-gray-700 leading-relaxed"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              {post.description}
            </p>
          </div>
        )}

        <details className="border border-gray-100 rounded-xl p-3 text-xs text-gray-500"><summary className="cursor-pointer">수령·포장 처리 약속</summary><p className="mt-2">각자 음식을 받아 가져가고 개인 용기·포장 쓰레기는 각자 처리해요. 공용 봉투는 리더가 가져가요. 수령 장소에 포장재를 남기지 않아요.</p></details>
        {/* applicants shortcut (leader view) */}
        {tx?.post.id === post.id && tx.role === "leader" && (
          <button
            onClick={() => push("applicants")}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl active:bg-gray-100 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                👥
              </div>
              <div className="text-left">
                <div
                  className="text-sm font-semibold text-gray-900"
                  style={{ fontFamily: "Noto Sans KR" }}
                >
                  신청자 관리
                </div>
                <div
                  className="text-xs text-gray-400"
                  style={{ fontFamily: "Noto Sans KR" }}
                >
                  신청자 3명 대기 중
                </div>
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4 text-gray-400"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
        <DetailActions push={push} />
      </div>
    </div>
  )
}

// ─── SCREEN 5: CREATE ─────────────────────────────────────────────────────────

function CreateScreen({
  pop,
  push,
}: {
  pop: () => void
  push: (s: Screen) => void
}) {
  const { create, active, setNotice, now } = useFlow()
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)
  const defaultTime = new Date(now + 30 * 60 * 1000).toTimeString().slice(0, 5)

  const [form, setForm] = useState({
    restaurant: "",

    category: "",

    maxMembers: "4",

    deadline: defaultTime,

    minAmount: "",

    currentAmount: "",

    deliveryTime: "",

    note: "",
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <Header title="모집글 작성" onBack={pop} />
      <div className="px-4 py-4 space-y-4">
        {/* restaurant */}
        <div>
          <label
            className="text-xs font-semibold text-gray-500 mb-1.5 block"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            음식점 *
          </label>
          <div className="flex gap-2">
            <input
              value={form.restaurant}
              onChange={(e) => { set("restaurant", e.target.value); setStoreSearchOpen(true) }}
              placeholder="음식점 이름을 입력하세요"
              className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm outline-none focus:border-brand"
              style={{ fontFamily: "Noto Sans KR" }}
            />
            <button
              onClick={() => setStoreSearchOpen(open => !open)}
              className="h-11 px-4 bg-brand-50 text-brand text-sm font-medium rounded-xl border border-brand/20"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              검색
            </button>
          </div>
          {storeSearchOpen && <div className="mt-2 rounded-xl border border-gray-200 p-2 space-y-1">
            <p className="text-xs text-gray-500 px-2 py-1">학교 주변 가게 선택 · 메뉴와 가격은 시연용</p>
            {CAMPUS_STORES.filter(store => !form.restaurant.trim() || store.name.includes(form.restaurant.trim())).map(store => <button key={store.name} onClick={() => {
              setForm(f => ({ ...f, restaurant: store.name, category: CATEGORIES.find(c => c.label === store.category)!.id, minAmount: String(store.demoMinOrder), currentAmount: String(store.menus[0].price), deliveryTime: "모집 마감 후 약 30분" }))
              setStoreSearchOpen(false)
            }} className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-50 text-sm">{store.emoji} {store.name}</button>)}
            {!CAMPUS_STORES.some(store => !form.restaurant.trim() || store.name.includes(form.restaurant.trim())) && <p className="text-xs text-gray-500 p-2">등록된 가게가 없어요. 이름과 카테고리를 직접 입력할 수 있어요.</p>}
          </div>}
        </div>

        {/* category */}
        <div>
          <label
            className="text-xs font-semibold text-gray-500 mb-1.5 block"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            음식 카테고리 *
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.id !== "all")
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => set("category", c.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.category === c.id
                      ? "bg-brand border-brand text-white"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                  style={{ fontFamily: "Noto Sans KR" }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
          </div>
        </div>

        {/* grid fields */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              key: "maxMembers",
              label: "최대 모집 인원",
              placeholder: "4",
              suffix: "명",
              type: "number",
            },

            {
              key: "deadline",
              label: "모집 마감 시간",
              placeholder: "18:30",
              suffix: "",
              type: "time",
            },

            {
              key: "minAmount",
              label: "최소주문금액",
              placeholder: "30,000",
              suffix: "원",
              type: "text",
            },

            {
              key: "currentAmount",
              label: "현재 주문 금액",
              placeholder: "15,000",
              suffix: "원",
              type: "text",
            },
          ].map((f) => (
            <div key={f.key}>
              <label
                className="text-xs font-semibold text-gray-500 mb-1.5 block"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {f.label}
              </label>
              <div className="relative">
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  type={f.type}
                  placeholder={f.placeholder}
                  className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm outline-none focus:border-brand"
                  style={{ fontFamily: "Outfit" }}
                />
                {f.suffix && (
                  <span
                    className="absolute right-3 top-3 text-sm text-gray-400"
                    style={{ fontFamily: "Noto Sans KR" }}
                  >
                    {f.suffix}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* delivery time */}
        <div>
          <label
            className="text-xs font-semibold text-gray-500 mb-1.5 block"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            배달 예정 시간
          </label>
          <input
            value={form.deliveryTime}
            onChange={(e) => set("deliveryTime", e.target.value)}
            placeholder="예: 19:00 ~ 19:30"
            className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm outline-none focus:border-brand"
            style={{ fontFamily: "Noto Sans KR" }}
          />
        </div>

        {/* note */}
        <div>
          <label
            className="text-xs font-semibold text-gray-500 mb-1.5 block"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            기타 전달사항
          </label>
          <textarea
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="수령 장소, 메뉴 관련 안내 등을 입력하세요"
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand resize-none"
            style={{ fontFamily: "Noto Sans KR" }}
          />
        </div>
        <p className="text-xs text-gray-500">등록하면 이 브라우저의 목록·지도에 표시되고 새로고침 후에도 유지돼요. 다른 기기와 공유되지는 않아요.</p>

        <button
          disabled={active}
          onClick={() => {
            if (
              create({
                ...form,
                category:
                  CATEGORIES.find((c) => c.id === form.category)?.label || "",
              })
            )
              { setNotice("모집글을 등록했어요. 목록과 지도에서도 확인할 수 있어요."); push("detail") }
          }}
          className="w-full h-12 rounded-2xl font-bold text-white text-sm active:opacity-90"
          style={{
            background: "linear-gradient(135deg, #FF5500, #FF9500)",
            fontFamily: "Noto Sans KR",
          }}
        >
          {active ? "진행 중인 공동배달을 먼저 마쳐 주세요" : "모집글 등록하기"}
        </button>
      </div>
    </div>
  )
}

// ─── SCREEN 6: APPLICANTS ─────────────────────────────────────────────────────

// ─── SCREEN 7: APPLICANT PROFILE ──────────────────────────────────────────────

function ApplicantProfileScreen({ pop }: { pop: () => void }) {
  const {
    selectedApplicant,
    selectedPost,
    tx,
    menu,
    dispatch,
    now,
    reputation,
  } = useFlow()

  const baseApplicant =
    selectedApplicant === 0
      ? {
          ...APPLICANTS[0],
          name: selectedPost.leaderName,
          rating: selectedPost.leaderRating,
          trades: selectedPost.leaderTrades,
        }
      : (APPLICANTS.find((person) => person.id === selectedApplicant) ??
        APPLICANTS[0])

  const stats = reputation(
    baseApplicant.name,
    baseApplicant.rating,
    baseApplicant.trades,
    baseApplicant.reviews,
  )

  const a = { ...baseApplicant, ...stats }

  const reviews = [
    ...stats.entries.map((r) => ({
      text: r.comment || r.tags.join(" · ") || "별점 평가",
      from: "나",
      date: "이번 체험",
      rating: r.stars,
    })),

    {
      text: "최고의 파티원이에요! 시간도 잘 지키고 소통도 잘 됩니다.",
      from: "배달왕김씨",
      date: "2024.11.12",
      rating: 5,
    },

    {
      text: "처음 공동배달인데 친절하게 알려주셔서 좋았어요.",
      from: "점심파이터",
      date: "2024.11.01",
      rating: 5,
    },

    {
      text: "메뉴 결정이 빠르고 입금도 바로 해줘요.",
      from: "주말배달러",
      date: "2024.10.22",
      rating: 5,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Header
        title={selectedApplicant === 0 ? "리더 프로필" : "신청자 프로필"}
        onBack={pop}
      />

      {/* hero */}
      <div className="bg-white px-4 py-6 flex flex-col items-center border-b border-gray-100">
        <div className="w-20 h-20 bg-brand-100 rounded-2xl flex items-center justify-center text-4xl mb-3">
          {a.avatar}
        </div>
        <div
          className="text-xl font-bold text-gray-900 mb-1"
          style={{ fontFamily: "Noto Sans KR" }}
        >
          {a.name}
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-amber-400">★★★★★</span>
          <span className="font-bold" style={{ fontFamily: "Outfit" }}>
            {a.rating}
          </span>
        </div>
        <div
          className="text-sm text-gray-500"
          style={{ fontFamily: "Noto Sans KR" }}
        >
          공동배달 {a.trades}회 · 후기 {a.reviews}개
        </div>
        <div
          className="mt-3 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium"
          style={{ fontFamily: "Noto Sans KR" }}
        >
          최근 활동: {a.lastActive}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* requested menu */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div
            className="text-xs font-semibold text-gray-500 mb-2"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            신청 메뉴
          </div>
          <div className="flex items-center justify-between">
            <span
              className="font-semibold text-gray-900"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              {selectedApplicant === 0
                ? "채팅방에서 확인"
                : a.requestedMenu === "미정"
                  ? "미정"
                  : (menu.find((item) => item.name === a.requestedMenu)?.name ??
                    menu[0].name)}
            </span>
            <span
              className="text-brand font-bold"
              style={{ fontFamily: "Outfit" }}
            >
              {selectedApplicant === 0 || a.requestedMenu === "미정"
                ? ""
                : money(
                    (
                      menu.find((item) => item.name === a.requestedMenu) ??
                      menu[0]
                    ).price,
                  )}
            </span>
          </div>
        </div>

        {/* tags */}
        {a.name !== "나" && <ReportControl key={`${selectedPost.id}-${a.name}`} person={a.name} postId={selectedPost.id} />}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div
            className="text-xs font-semibold text-gray-500 mb-3"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            받은 평가 키워드
          </div>
          <div className="flex flex-wrap gap-2">
            {a.reviewSnippets.map((r, i) => (
              <span
                key={i}
                className="bg-brand-50 text-brand text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                👍 {r}
              </span>
            ))}
          </div>
        </div>

        {/* reviews */}
        <div>
          <div
            className="text-sm font-bold text-gray-900 mb-3"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            후기 ({reviews.length})
          </div>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border border-gray-100"
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    className="text-sm font-semibold text-gray-900"
                    style={{ fontFamily: "Noto Sans KR" }}
                  >
                    {r.from}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    {"★".repeat(r.rating)}
                    <span className="text-gray-400 ml-1">{r.date}</span>
                  </div>
                </div>
                <p
                  className="text-sm text-gray-600 leading-relaxed"
                  style={{ fontFamily: "Noto Sans KR" }}
                >
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 flex gap-3">
        {selectedApplicant !== 0 &&
        tx?.role === "leader" &&
        !recruitmentClosed(tx, now) &&
        !tx.decisions[a.id] ? (
          <>
            <button
              onClick={() => {
                dispatch({
                  type: "decide",
                  id: a.id,
                  name: a.name,
                  accepted: false,
                  items: menu,
                  now,
                })
                pop()
              }}
              className="flex-1 h-12 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600"
            >
              거절
            </button>
            <button
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
                pop()
              }}
              className="flex-[2] h-12 bg-brand rounded-2xl text-sm font-bold text-white"
            >
              수락하기
            </button>
          </>
        ) : (
          <button
            onClick={pop}
            className="w-full h-12 bg-brand rounded-2xl text-sm font-bold text-white"
          >
            확인하고 돌아가기
          </button>
        )}
      </div>
    </div>
  )
}

// ─── SCREEN 8: CHAT ───────────────────────────────────────────────────────────

// ─── SCREEN 9: MENU ───────────────────────────────────────────────────────────

// ─── SCREEN 10: PAYMENT ───────────────────────────────────────────────────────

// ─── SCREEN 11: DELIVERY ──────────────────────────────────────────────────────

// ─── SCREEN 12: RECEIPT ───────────────────────────────────────────────────────

// ─── SCREEN 13: COMPLETE ──────────────────────────────────────────────────────

// ─── SCREEN 14: RATING ────────────────────────────────────────────────────────

// ─── SCREEN 15: PROFILE ───────────────────────────────────────────────────────

function ProfileScreen({ push }: { push: (s: Screen) => void }) {
  const {
    tx, active, selectPost, completed, reviews: savedReviews,
    suspended, suspensionUntil, myRating, myTrades,
    couponEligible, couponUsed, advancePenaltyClock, themePreference, setThemePreference,
    reports, lateIncidentCount,
  } = useFlow()

  const history = [
    ...completed.map((t) => ({
      date: "이번 체험",
      place: t.post.restaurant,
      amount: due(t, "me"),
      rating: 0,
    })),

    { date: "2024.11.15", place: "bhc 대전궁동점", amount: 26000, rating: 5 },

    {
      date: "2024.11.10",
      place: "한솥도시락 충남대후문점",
      amount: 18000,
      rating: 5,
    },

    { date: "2024.11.03", place: "써브웨이 대전충남대정문점", amount: 12500, rating: 4 },

    { date: "2024.10.28", place: "홍콩반점0410 궁동점", amount: 15000, rating: 5 },
  ]

  const reviews = [
    {
      from: "배달왕김씨",
      text: "항상 시간 잘 지키고 친절해요!",
      date: "11.15",
      rating: 5,
    },

    {
      from: "점심파이터",
      text: "입금도 빠르고 소통이 잘 됩니다.",
      date: "11.10",
      rating: 5,
    },

    {
      from: "주말배달러",
      text: "다음에 또 같이 시켜요 😊",
      date: "11.03",
      rating: 4,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* hero */}
      <div className="bg-white px-4 pt-6 pb-5 border-b border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center text-3xl border-2 border-brand/20">
              🧑
            </div>
            <div>
              <div
                className="text-xl font-black text-gray-900"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                나의 닉네임
              </div>
              <div
                className="text-xs text-gray-400 mt-0.5"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                충남대 주변 · 가입 2024.08
              </div>
            </div>
          </div>
          <button className="p-2 text-gray-400 rounded-xl">
            <IcMenu />
          </button>
        </div>

        {/* stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "평점", value: myRating.toFixed(1), sub: "⭐", highlight: true },

            {
              label: "거래 횟수",
              value: String(myTrades),
              sub: "회",
            },

            { label: "후기", value: "18", sub: "개" },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl p-3 text-center ${
                s.highlight ? "bg-brand text-white" : "bg-gray-50"
              }`}
            >
              <div
                className={`text-xs mb-1 ${
                  s.highlight ? "text-white/70" : "text-gray-400"
                }`}
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {s.label}
              </div>
              <div
                className={`text-xl font-black ${
                  s.highlight ? "text-white" : "text-gray-900"
                }`}
                style={{ fontFamily: "Outfit" }}
              >
                {s.sub === "⭐" ? `${s.sub}${s.value}` : s.value + s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <h2 className="text-sm font-bold mb-2">화면 테마</h2>
          <div className="grid grid-cols-3 gap-2">
            {([['light', '라이트'], ['dark', '다크'], ['system', '기기 설정']] as const).map(([value, label]) => (
              <button key={value} aria-pressed={themePreference === value} onClick={() => setThemePreference(value)} className={`rounded-lg border px-2 py-2 text-xs ${themePreference === value ? "border-brand text-brand font-bold" : "border-gray-200 text-gray-500"}`}>{label}</button>
            ))}
          </div>
        </div>
        {suspended && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <h2 className="font-bold text-amber-800 text-sm">수령 지각 · 새 거래 3일 제한</h2>
            <p className="text-xs text-amber-700">
              {new Date(suspensionUntil).toLocaleString("ko-KR")}까지 새 모집과 동참 신청이 제한돼요.
              진행 중인 수령·평가는 계속할 수 있어요.
            </p>
            <button className="text-xs font-bold text-brand underline" onClick={advancePenaltyClock}>
              시연 시간 3일 진행해 제한 해제 보기
            </button>
          </div>
        )}
        {!suspended && lateIncidentCount > 0 && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3">수령 지각 경고 {lateIncidentCount}회 · 다음 거래에서도 지각이 확인되면 새 모집·참여가 3일 제한돼요.</p>}
        <details className="bg-white rounded-xl border border-gray-100 p-4 text-xs">
          <summary className="font-semibold cursor-pointer">이용 규칙 · 내 신고 내역 {reports.length}건</summary>
          <p className="text-gray-500 mt-3">신고는 사실 확인과 소명 후 경고 또는 이용 제한하는 방식으로 설계했어요. 여기서는 신고 접수 상태만 시연해요.</p>
          {!reports.length && <p className="text-gray-400 mt-2">상대 프로필 또는 채팅의 참여자 메뉴에서 신고할 수 있어요.</p>}
          {reports.map(report => <div key={report.id} className="border-t border-gray-100 mt-3 pt-3 space-y-1"><p className="font-semibold">{report.person} · {report.reason}</p><p className="text-brand">{report.status} (시연)</p>{report.detail && <p className="text-gray-500 break-words">{report.detail}</p>}</div>)}
        </details>
        <details className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <summary className="font-bold text-sm cursor-pointer">⭐ 우수 참여자 혜택 보기</summary>
          <p className="text-xs text-gray-500">평점 4.8 이상 · 공동배달 5회 이상이면 배달비 1,000원 할인 쿠폰을 받을 수 있어요.</p>
          <p className="text-sm font-semibold text-brand">
            {couponUsed ? "이번 시연 쿠폰 사용 완료" : suspended
              ? "제한 기간이 끝나면 쿠폰을 사용할 수 있어요"
              : couponEligible ? "배달비 1,000원 할인 쿠폰 사용 가능 (시연)" : "아직 혜택 조건을 채우지 않았어요"}
          </p>
          <p className="text-[11px] text-gray-400">다음 공동배달의 송금 화면에서 사용할 수 있으며 실제 할인은 발생하지 않아요.</p>
        </details>
        {/* keywords */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div
            className="text-xs font-semibold text-gray-500 mb-3"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            받은 평가 키워드
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "시간 잘 지켜요 (15)",
              "친절해요 (12)",
              "소통 잘 돼요 (10)",
              "믿음직스러워요 (8)",
              "재거래 의사 있어요 (6)",
            ].map((t) => (
              <span
                key={t}
                className="text-xs bg-brand-50 text-brand px-2.5 py-1.5 rounded-full font-medium"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                👍 {t}
              </span>
            ))}
          </div>
        </div>

        {/* active delivery */}
        <button
          onClick={() => {
            if (tx && active) {
              selectPost(tx.post.id)
              push(tx.application === "pending" ? "detail" : "chat")
            } else push("list")
          }}
          className="prototype-banner w-full bg-white rounded-2xl p-4 border border-orange-200 shadow-sm text-left active:scale-[0.98] transition-all"

        >
          <div
            className="text-xs text-brand font-semibold mb-1"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            {active ? "진행 중인 공동배달" : "새로운 공동배달 찾기"}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {active && tx ? tx.post.restaurant : "근처 모집글 살펴보기"}
              </div>
              <div
                className="text-xs text-gray-500"
                style={{ fontFamily: "Noto Sans KR" }}
              >
                {active && tx ? statusOf(tx) : "진행 중인 거래가 없어요"}
              </div>
            </div>
            <StatusBadge
              status={
                active && tx
                  ? tx.ordered
                    ? "delivering"
                    : "recruiting"
                  : "complete"
              }
            />
          </div>
        </button>

        {/* history */}
        <div>
          <div
            className="text-sm font-bold text-gray-900 mb-3"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            거래 이력
          </div>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100"
              >
                <div>
                  <div
                    className="text-sm font-semibold text-gray-900"
                    style={{ fontFamily: "Noto Sans KR" }}
                  >
                    {h.place}
                  </div>
                  <div
                    className="text-xs text-gray-400 mt-0.5"
                    style={{ fontFamily: "Noto Sans KR" }}
                  >
                    {h.date}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-sm font-bold text-gray-900"
                    style={{ fontFamily: "Outfit" }}
                  >
                    {h.amount.toLocaleString()}원
                  </div>
                  <div className="text-xs text-amber-400">
                    {"★".repeat(h.rating)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {completed.some((t) => savedReviews[t.post.id]) && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <h2 className="font-bold text-sm mb-3">내가 작성한 평가</h2>
            {completed.flatMap((t) =>
              Object.entries(savedReviews[t.post.id] ?? {}).map(
                ([id, review]) => (
                  <div
                    key={`${t.post.id}-${id}`}
                    className="border-b border-gray-50 py-2 text-sm"
                  >
                    <b>{t.people.find((p) => p.id === id)?.name}</b>
                    <span className="text-amber-400 ml-2">
                      {"★".repeat(review.stars)}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {review.comment || review.tags.join(" · ") || "별점 평가"}
                    </p>
                  </div>
                ),
              ),
            )}
          </div>
        )}
        {/* reviews */}
        <div>
          <div
            className="text-sm font-bold text-gray-900 mb-3"
            style={{ fontFamily: "Noto Sans KR" }}
          >
            받은 후기
          </div>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-3 border border-gray-100"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span
                    className="text-xs font-semibold text-gray-700"
                    style={{ fontFamily: "Noto Sans KR" }}
                  >
                    {r.from}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    {"★".repeat(r.rating)}
                    <span className="text-gray-400 ml-1">{r.date}</span>
                  </div>
                </div>
                <p
                  className="text-xs text-gray-600"
                  style={{ fontFamily: "Noto Sans KR" }}
                >
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <FlowProvider initialPosts={DEMO_POSTS}>
      <PrototypeApp />
    </FlowProvider>
  )
}

function PrototypeApp() {
  const flow = useFlow()
  const [keyboardViewportHeight, setKeyboardViewportHeight] = useState<number | null>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setKeyboardViewportHeight(
      viewport.height < window.innerHeight - 100 ? viewport.height : null,
    )
    viewport.addEventListener("resize", update)
    return () => viewport.removeEventListener("resize", update)
  }, [])

  const [history, setHistory] = useState<Screen[]>(["main"])

  const [tab, setTab] = useState<Tab>("explore")

  const screen = history[history.length - 1]

  const push = (s: Screen) => {
    setHistory((prev) => {
      if (s === "main") return ["main"]

      const existing = prev.lastIndexOf(s)

      return existing >= 0 ? prev.slice(0, existing + 1) : [...prev, s]
    })

    if (s === "main" || s === "list") setTab("explore")
    else if (s === "create") setTab("new")
    else if (s === "chat") setTab("chat")
    else if (s === "profile") setTab("me")
  }

  const pop = () => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : ["main"]))
  }

  const switchTab = (t: Tab) => {
    setTab(t)

    if (t === "explore") setHistory(["main"])
    else if (t === "new") setHistory(["create"])
    else if (t === "chat") {
      if (!flow.tx || flow.tx.cancelled || flow.tx.application === "rejected") {
        flow.setNotice("진행 중인 공동배달이 없어요.")
        setHistory(["main"])
        setTab("explore")
      } else {
        flow.selectPost(flow.tx.post.id)
        setHistory([flow.tx.application === "pending" ? "detail" : "chat"])
      }
    } else setHistory(["profile"])
  }

  const showBottomNav = ["main", "list", "create", "profile"].includes(
    screen,
  )

  const screenProps = { pop, push }

  return (
    <div className="min-h-dvh bg-stone-200 flex items-start justify-center sm:items-center sm:p-4">
      <div
        className={`relative w-full sm:w-[390px] h-dvh sm:h-[calc(100dvh-2rem)] bg-[#FFF6EE] flex flex-col overflow-hidden sm:rounded-[40px] sm:shadow-2xl ${flow.isDark ? "app-dark" : ""}`}
        style={{ maxHeight: "900px", ...(keyboardViewportHeight ? { height: `${keyboardViewportHeight}px` } : {}) }}
      >
        {screen !== "chat" && <div className="flex-shrink-0 flex justify-end bg-white px-4 border-b border-gray-100">
          <button aria-label={`알림 열기, 읽지 않은 알림 ${flow.unreadCount}개`} onClick={() => flow.setNotificationsOpen(true)} className="flex items-center gap-2 py-2 text-xs text-gray-600">
            <IcBell /> 알림
            {flow.unreadCount > 0 && <span className="rounded-full bg-red-500 px-1.5 text-white font-bold">{flow.unreadCount}</span>}
          </button>
        </div>}
        {flow.notice && (
          <div
            role="status"
            className={screen === "chat" ? "absolute top-24 left-4 right-4 z-40 rounded-xl px-4 py-3 bg-gray-800 text-white text-xs leading-relaxed shadow-lg pointer-events-none" : "flex-shrink-0 px-4 py-3 bg-gray-800 text-white text-xs leading-relaxed"}
          >
            {flow.notice}
          </div>
        )}
        {![
          "chat",
          "category",
          "list",
          "create",
          "applicantProfile",
          "profile",
          "main",
        ].includes(screen) && (screen !== "detail" || flow.tx?.post.id === flow.selectedId) && <FlowBar />}
        {/* Screen content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {screen === "main" && <MainScreen push={push} />}
          {screen === "category" && <CategoryScreen {...screenProps} />}
          {screen === "list" && <ListScreen {...screenProps} />}
          {screen === "detail" && <DetailScreen {...screenProps} />}
          {screen === "create" && <CreateScreen {...screenProps} />}
          {screen === "applicants" && (
            <ApplicantsScreen {...screenProps} applicants={APPLICANTS} />
          )}
          {screen === "applicantProfile" && (
            <ApplicantProfileScreen pop={pop} />
          )}
          {screen === "chat" && <ChatScreen {...screenProps} />}
          {screen === "menu" && <MenuScreen {...screenProps} />}
          {screen === "payment" && <PaymentScreen {...screenProps} />}
          {screen === "delivery" && <DeliveryScreen {...screenProps} />}
          {screen === "receipt" && <ReceiptScreen {...screenProps} />}
          {screen === "complete" && <CompleteScreen push={push} />}
          {screen === "rating" && <RatingScreen {...screenProps} />}
          {screen === "profile" && <ProfileScreen push={push} />}
        </div>

        {["detail", "applicants", "receipt"].includes(screen) && (
          <details className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-1 text-[10px] text-gray-400">
            <summary className="cursor-pointer">시연 시간 조절</summary>
            <button className="text-brand py-2" onClick={flow.advanceClock}>
              30분 진행 (모집 마감·수령 지각 체험)
            </button>
          </details>
        )}
        {/* Bottom nav */}
        {showBottomNav && <BottomNav tab={tab} onTab={switchTab} />}
        {flow.notificationsOpen && (
          <div role="dialog" aria-modal="true" aria-label="알림 목록" className="absolute inset-0 z-50 bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="font-bold">알림 {flow.unreadCount > 0 && `(${flow.unreadCount})`}</h2>
              <button autoFocus aria-label="알림 닫기" onClick={() => flow.setNotificationsOpen(false)} className="p-2 text-sm">닫기</button>
            </div>
            <div className="px-4 py-2 flex justify-end border-b border-gray-100">
              <button disabled={!flow.unreadCount} onClick={flow.readAllNotifications} className="text-xs text-brand disabled:text-gray-300">모두 읽음</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!flow.notifications.length && <p className="px-4 py-10 text-center text-sm text-gray-500">아직 도착한 알림이 없어요.</p>}
              {flow.notifications.map(item => (
                <button key={item.id} onClick={() => {
                  flow.readNotification(item.id)
                  flow.setNotificationsOpen(false)
                  if (flow.tx?.post.id !== item.postId) {
                    flow.setNotice("이 공동배달은 현재 진행 중인 거래가 아니에요.")
                    return
                  }
                  flow.selectPost(item.postId)
                  push(item.target)
                }} className={`w-full text-left px-4 py-4 border-b border-gray-100 ${item.read ? "bg-white" : "bg-orange-50"}`}>
                  <div className="flex justify-between gap-3 text-xs text-gray-500"><span>{item.restaurant}</span><span>{new Date(item.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}</span></div>
                  <p className={`mt-1 text-sm break-words ${item.read ? "text-gray-600" : "text-gray-900 font-semibold"}`}>{item.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
