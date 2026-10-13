import { useEffect, useRef, useState } from "react"

import { FlowProvider, MENU_BY_CATEGORY, useFlow } from "./FlowContext"

import {
  allReceived,
  recruitmentClosed,
  statusOf,
  money,
  due,
  deliveryFee,
  RECRUITMENT_RADIUS,
} from "./workflow"

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

  { id: "fastfood", label: "패스트푸드", emoji: "🍔" },

  { id: "japanese", label: "일식", emoji: "🍱" },

  { id: "cafe", label: "카페", emoji: "☕" },

  { id: "snack", label: "분식", emoji: "🍢" },

  { id: "burger", label: "버거", emoji: "🍟" },
]
const CATEGORY_COLOR: Record<string, string> = {
  치킨: "bg-amber-100 text-amber-800", 피자: "bg-red-100 text-red-800", 한식: "bg-green-100 text-green-800",
  중식: "bg-violet-100 text-violet-800", 패스트푸드: "bg-yellow-100 text-yellow-900", 일식: "bg-sky-100 text-sky-800",
  카페: "bg-teal-100 text-teal-800", 분식: "bg-pink-100 text-pink-800",
}
const categoryStyle = (category: string) => CATEGORY_COLOR[category === "버거" ? "패스트푸드" : category] ?? "bg-gray-100 text-gray-700"
let lastListScroll = 0

const POSTS = [
  {
    id: 1,

    restaurant: "BBQ치킨 역삼역점",

    category: "치킨",

    emoji: "🍗",

    currentMembers: 2,

    maxMembers: 4,

    minOrderAmount: 30000,

    currentAmount: 18000,

    distance: 120,

    deadline: "18:30",

    leaderRating: 4.8,

    leaderTrades: 34,

    leaderName: "배달왕김씨",

    status: "recruiting",

    gradFrom: "#FF6B35",

    gradTo: "#FF9500",

    description:
      "역삼역 2번 출구 앞에서 수령 예정입니다. 황금올리브 같이 시킬 분 환영해요!",

    imageId: "1569050467450-2de3c2afc2cd",
  },

  {
    id: 2,

    restaurant: "도미노피자 강남점",

    category: "피자",

    emoji: "🍕",

    currentMembers: 3,

    maxMembers: 4,

    minOrderAmount: 46000,

    currentAmount: 42000,

    distance: 210,

    deadline: "19:00",

    leaderRating: 4.6,

    leaderTrades: 18,

    leaderName: "점심파이터",

    status: "recruiting",

    gradFrom: "#E63946",

    gradTo: "#FF6B6B",

    description: "강남역 10번 출구 근처에서 수령합니다. 거의 다 찼어요!",

    imageId: "1513104890138-7c749dbe5d58",
  },

  {
    id: 3,

    restaurant: "맥도날드 역삼점",

    category: "패스트푸드",

    emoji: "🍔",

    currentMembers: 1,

    maxMembers: 3,

    minOrderAmount: 25000,

    currentAmount: 10500,

    distance: 85,

    deadline: "17:45",

    leaderRating: 4.9,

    leaderTrades: 47,

    leaderName: "치킨마니아",

    status: "recruiting",

    gradFrom: "#FFC300",

    gradTo: "#FF5722",

    description:
      "맥모닝 세트 같이 시킬 분! 회사 앞 편의점에서 수령 가능합니다.",

    imageId: "1568901346375-23c9450c58cd",
  },

  {
    id: 4,

    restaurant: "홍콩반점 서초점",

    category: "중식",

    emoji: "🥡",

    currentMembers: 2,

    maxMembers: 3,

    minOrderAmount: 35000,

    currentAmount: 25000,

    distance: 300,

    deadline: "19:30",

    leaderRating: 4.7,

    leaderTrades: 23,

    leaderName: "야식러버",

    status: "recruiting",

    gradFrom: "#6C63FF",

    gradTo: "#4ECDC4",

    description: "짜장면+짬뽕+탕수육 세트 같이 시킬 분들 모집합니다.",

    imageId: "1563245372-f21724e3856d",
  },
]

const ADDITIONAL_POSTS = [
  { restaurant: "바삭치킨 역삼점", category: "치킨", emoji: "🍗", distance: 350, currentMembers: 1, maxMembers: 3, currentAmount: 22000, minOrderAmount: 30000, deadline: "19:00", leaderName: "치킨친구", leaderRating: 4.7, leaderTrades: 12, description: "저녁 치킨 같이 주문해요. 배달비를 나누고 건물 입구에서 만나요.", imageId: "1569050467450-2de3c2afc2cd" },
  { restaurant: "우리피자 테헤란로점", category: "피자", emoji: "🍕", distance: 480, currentMembers: 2, maxMembers: 4, currentAmount: 24000, minOrderAmount: 40000, deadline: "19:20", leaderName: "피자한조각", leaderRating: 4.9, leaderTrades: 31, description: "피자와 사이드 함께 주문할 분 구해요. 각자 원하는 메뉴를 골라 주세요.", imageId: "1513104890138-7c749dbe5d58" },
  { restaurant: "따뜻한밥상 역삼점", category: "한식", emoji: "🍜", distance: 160, currentMembers: 1, maxMembers: 3, currentAmount: 9000, minOrderAmount: 20000, deadline: "18:40", leaderName: "든든한저녁", leaderRating: 4.8, leaderTrades: 20, description: "김치찌개나 제육덮밥 같이 주문해요. 퇴근하고 저녁 먹을 분 환영해요.", imageId: "1547592180-85f173990554" },
  { restaurant: "한그릇식당 강남점", category: "한식", emoji: "🍜", distance: 620, currentMembers: 2, maxMembers: 4, currentAmount: 18000, minOrderAmount: 25000, deadline: "19:10", leaderName: "밥친구", leaderRating: 4.6, leaderTrades: 9, description: "든든한 한 끼 함께 주문해요. 만날 장소는 채팅에서 정해요.", imageId: "1547592180-85f173990554" },
  { restaurant: "동네반점 역삼점", category: "중식", emoji: "🥡", distance: 430, currentMembers: 1, maxMembers: 3, currentAmount: 10000, minOrderAmount: 25000, deadline: "18:50", leaderName: "짬뽕좋아", leaderRating: 4.7, leaderTrades: 16, description: "짜장면, 짬뽕 같이 시켜요. 탕수육도 각자 메뉴에 추가할 수 있어요.", imageId: "1563245372-f21724e3856d" },
  { restaurant: "버거스테이션 역삼점", category: "패스트푸드", emoji: "🍔", distance: 270, currentMembers: 2, maxMembers: 4, currentAmount: 20000, minOrderAmount: 25000, deadline: "18:20", leaderName: "감튀러버", leaderRating: 4.8, leaderTrades: 25, description: "버거 세트 함께 주문할 분 모집해요. 배달 도착 후 바로 수령해 주세요.", imageId: "1568901346375-23c9450c58cd" },
  { restaurant: "오늘초밥 역삼점", category: "일식", emoji: "🍱", distance: 240, currentMembers: 1, maxMembers: 3, currentAmount: 14000, minOrderAmount: 25000, deadline: "18:50", leaderName: "초밥한접시", leaderRating: 4.9, leaderTrades: 38, description: "초밥과 우동 같이 주문해요. 각자 먹을 메뉴를 채팅방에서 선택해 주세요.", imageId: "1579871494447-9811cf80d66c" },
  { restaurant: "소담일식 테헤란로점", category: "일식", emoji: "🍱", distance: 690, currentMembers: 2, maxMembers: 4, currentAmount: 28000, minOrderAmount: 35000, deadline: "19:30", leaderName: "우동친구", leaderRating: 4.6, leaderTrades: 7, description: "일식 저녁 메뉴 함께 시킬 분 구해요. 수령 위치는 추천 장소를 보고 정해요.", imageId: "1579871494447-9811cf80d66c" },
  { restaurant: "오후커피 역삼점", category: "카페", emoji: "☕", distance: 110, currentMembers: 2, maxMembers: 4, currentAmount: 10000, minOrderAmount: 15000, deadline: "18:10", leaderName: "커피타임", leaderRating: 4.8, leaderTrades: 22, description: "커피와 디저트 함께 주문해요. 건물 1층에서 수령하면 편할 것 같아요.", imageId: "1509042239860-f550ce710b93" },
  { restaurant: "달콤카페 강남점", category: "카페", emoji: "☕", distance: 550, currentMembers: 1, maxMembers: 3, currentAmount: 6500, minOrderAmount: 15000, deadline: "19:00", leaderName: "디저트산책", leaderRating: 4.7, leaderTrades: 14, description: "저녁 커피 같이 주문해요. 케이크도 메뉴에서 골라 주세요.", imageId: "1509042239860-f550ce710b93" },
  { restaurant: "매콤분식 역삼점", category: "분식", emoji: "🍢", distance: 190, currentMembers: 1, maxMembers: 3, currentAmount: 9000, minOrderAmount: 20000, deadline: "18:30", leaderName: "떡볶이친구", leaderRating: 4.9, leaderTrades: 29, description: "떡볶이, 김밥, 튀김 같이 주문할 분 모집해요.", imageId: "1563245372-f21724e3856d" },
  { restaurant: "김밥한줄 테헤란로점", category: "분식", emoji: "🍢", distance: 380, currentMembers: 2, maxMembers: 4, currentAmount: 16000, minOrderAmount: 20000, deadline: "19:15", leaderName: "가벼운한끼", leaderRating: 4.5, leaderTrades: 6, description: "간단한 저녁 함께 시켜요. 김밥과 분식 메뉴 중에서 선택해 주세요.", imageId: "1563245372-f21724e3856d" },
].map((post, index) => ({
  ...POSTS.find(template => template.category === post.category) ?? POSTS[0],
  ...post,
  id: index + 5,
  status: "recruiting",
  deliveryTime: "모집 마감 후 약 30~40분",
}))

const DEMO_POSTS = [...POSTS, ...ADDITIONAL_POSTS]

const APPLICANTS = [
  {
    id: 1,

    name: "점심파이터",

    rating: 4.6,

    trades: 18,

    reviews: 14,

    avatar: "🧑",

    lastActive: "방금 전",

    requestedMenu: "소이갈릭치킨",

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

function PostCard({
  post,
  onClick,
}: {
  post: typeof POSTS[0]
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
        <img
          src={`https://images.unsplash.com/photo-${post.imageId}?w=400&h=200&fit=crop&auto=format`}
          alt={post.restaurant}
          className="w-full h-full object-cover mix-blend-overlay opacity-60"
        />
        <div className="absolute inset-0 flex flex-col justify-between p-3">
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
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${categoryStyle(post.category)}`}>{post.emoji} {post.category}</span>
          <span className="text-xs font-semibold text-green-700">배달비 약 {money(deliveryFee - Math.ceil(deliveryFee / (post.currentMembers + 1)))} 절약</span>
        </div>
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
  const { posts, tx, active, selectPost, setCategory, setQuery, myLocation, setMyLocation, setNotice } = useFlow()
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState(myLocation)
  const showAllPosts = () => {
    lastListScroll = 0
    setCategory("all")
    setQuery("")
    push("list")
  }

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
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
        {/* categories */}
        <div>
          <button onClick={() => push("category")} className="font-bold text-gray-900 mb-3" style={{ fontFamily: "Noto Sans KR" }}>카테고리</button>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.slice(0, 10).map((c) => (
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
        <button
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
          style={{ background: "linear-gradient(135deg, #FFF6EE, #FFE8D6)" }}
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
        </button>

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
          p.category === (activeCat === "burger" ? "패스트푸드" : CATEGORIES.find((c) => c.id === activeCat)?.label)) &&
        (!normalizedQuery || [p.restaurant, p.category, ...(MENU_BY_CATEGORY[p.category] ?? []).map(item => item.name)]
          .some(value => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery))),
    )
    .sort((a, b) => a.distance - b.distance)

  return (
    <div ref={scrollRef} onScroll={event => { lastListScroll = event.currentTarget.scrollTop }} className="flex-1 overflow-y-auto bg-brand-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
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

      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
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
        <div className="flex gap-2">
          <span className="text-xs bg-white text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full">
            가까운순
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
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
      </div>
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

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* hero */}
      <div
        className="h-52 relative"
        style={{
          background: `linear-gradient(135deg, ${post.gradFrom}, ${post.gradTo})`,
        }}
      >
        <img
          src={`https://images.unsplash.com/photo-${post.imageId}?w=400&h=280&fit=crop&auto=format`}
          alt={post.restaurant}
          className="w-full h-full object-cover mix-blend-overlay opacity-50"
        />
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
            {post.category} · 역삼동
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
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
        <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800">
          <p className="font-bold">혼자 주문할 때보다 배달비 약 {money(deliveryFee - Math.ceil(deliveryFee / (post.currentMembers + 1)))} 절약</p>
          <p className="text-xs mt-1">일반 수령 기준: 혼자 {money(deliveryFee)} → 참여 시 예상 {money(Math.ceil(deliveryFee / (post.currentMembers + 1)))} · 최종 인원에 따라 달라져요.</p>
          <p className="text-xs mt-1">수령을 위해 리더 근처까지 약 {post.distance}m 이동 · 도보 약 {Math.max(1, Math.round(post.distance / 75))}분 (시연 추정)</p>
          <p className="text-xs mt-1">2인 거래에서는 ‘내 근처에서 받기’를 합의할 수도 있어요.</p>
        </div>
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
  const { create, active, setNotice } = useFlow()

  const [form, setForm] = useState({
    restaurant: "",

    category: "",

    maxMembers: "4",

    deadline: "18:30",

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
              onChange={(e) => set("restaurant", e.target.value)}
              placeholder="음식점 이름을 입력하세요"
              className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm outline-none focus:border-brand"
              style={{ fontFamily: "Noto Sans KR" }}
            />
            <button
              onClick={() =>
                setNotice("시연에서는 음식점 이름을 직접 입력해 주세요.")
              }
              className="h-11 px-4 bg-brand-50 text-brand text-sm font-medium rounded-xl border border-brand/20"
              style={{ fontFamily: "Noto Sans KR" }}
            >
              검색
            </button>
          </div>
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
              .slice(0, 8)
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
              push("applicants")
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
  } = useFlow()

  const history = [
    ...completed.map((t) => ({
      date: "이번 체험",
      place: t.post.restaurant,
      amount: due(t, "me"),
      rating: 0,
    })),

    { date: "2024.11.15", place: "BBQ치킨 역삼역점", amount: 26000, rating: 5 },

    {
      date: "2024.11.10",
      place: "도미노피자 강남점",
      amount: 18000,
      rating: 5,
    },

    { date: "2024.11.03", place: "맥도날드 역삼점", amount: 12500, rating: 4 },

    { date: "2024.10.28", place: "홍콩반점 서초점", amount: 15000, rating: 5 },
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
                역삼동 · 가입 2024.08
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
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <h2 className="font-bold text-sm">⭐ 우수 참여자 혜택</h2>
          <p className="text-xs text-gray-500">평점 4.8 이상 · 공동배달 5회 이상이면 배달비 1,000원 할인 쿠폰을 받을 수 있어요.</p>
          <p className="text-sm font-semibold text-brand">
            {couponUsed ? "이번 시연 쿠폰 사용 완료" : suspended
              ? "제한 기간이 끝나면 쿠폰을 사용할 수 있어요"
              : couponEligible ? "배달비 1,000원 할인 쿠폰 사용 가능 (시연)" : "아직 혜택 조건을 채우지 않았어요"}
          </p>
          <p className="text-[11px] text-gray-400">다음 공동배달의 송금 화면에서 사용할 수 있으며 실제 할인은 발생하지 않아요.</p>
        </div>
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
          style={{ background: "linear-gradient(135deg, #FFF6EE, #FFE8D6)" }}
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

  const showBottomNav = ["main", "list", "create", "chat", "profile"].includes(
    screen,
  )

  const screenProps = { pop, push }

  return (
    <div className="min-h-dvh bg-stone-200 flex items-start justify-center sm:items-center sm:p-4">
      <div
        className={`relative w-full sm:w-[390px] h-dvh sm:h-[calc(100dvh-2rem)] bg-[#FFF6EE] flex flex-col overflow-hidden sm:rounded-[40px] sm:shadow-2xl ${flow.isDark ? "app-dark" : ""}`}
        style={{ maxHeight: "900px", ...(keyboardViewportHeight ? { height: `${keyboardViewportHeight}px` } : {}) }}
      >
        {/* Status bar */}
        <div className="flex-shrink-0 h-10 flex items-center justify-between px-7 bg-white">
          <span
            className="text-xs font-bold text-gray-900"
            style={{ fontFamily: "Outfit" }}
          >
            9:41
          </span>
          <div className="flex items-center gap-1 text-gray-900">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <rect x="1" y="6" width="15" height="12" rx="2" />
              <path d="M23 13v-2a2 2 0 0 0 0 4v-2" />
            </svg>
          </div>
        </div>

        <div className="flex-shrink-0 px-4 py-1.5 bg-white border-b border-gray-100 text-[10px] text-gray-400 flex justify-between">
          <span>프로토타입 · 실제 주문 / 송금 없음</span>
          <span>
            시연 시간{" "}
            {new Date(flow.now).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
        </div>
        <div className="flex-shrink-0 flex justify-end bg-white px-4 border-b border-gray-100">
          <button aria-label={`알림 열기, 읽지 않은 알림 ${flow.unreadCount}개`} onClick={() => flow.setNotificationsOpen(true)} className="flex items-center gap-2 py-2 text-xs text-gray-600">
            <IcBell /> 알림
            {flow.unreadCount > 0 && <span className="rounded-full bg-red-500 px-1.5 text-white font-bold">{flow.unreadCount}</span>}
          </button>
        </div>
        {flow.notice && (
          <div
            role="status"
            className="flex-shrink-0 px-4 py-3 bg-gray-800 text-white text-xs leading-relaxed"
          >
            {flow.notice}
          </div>
        )}
        {![
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

        {["detail", "applicants", "chat", "receipt"].includes(screen) && (
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
