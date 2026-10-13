import type { MenuItem, Post } from "./workflow"

export const CAMPUS_CENTER = { lat: 36.3621, lng: 127.3444 }
export const CAMPUS_LOCATION = "충남대학교 정문 주변"
export const CATEGORY_PHOTOS: Record<string, string> = {
  치킨: "1569050467450-2de3c2afc2cd", 한식: "1512058564366-18510be2db19", 패스트푸드: "1553909489-cd47e0ef937f",
  중식: "1563245372-f21724e3856d", 카페: "1509042239860-f550ce710b93", 피자: "1513104890138-7c749dbe5d58",
  일식: "1579871494447-9811cf80d66c", 분식: "1635363638580-c2809d049eee",
}

// Store names are based on public listings. Menus, prices and recruitment are demo data.
export const CAMPUS_STORES = [
  { name: "bhc 대전궁동점", category: "치킨", emoji: "🍗", imageId: "1569050467450-2de3c2afc2cd", source: "https://www.daangn.com/kr/local-profile/bhc-대전궁동점-4kouep69s3jz/", menus: [
    { id: 1, name: "뿌링클", price: 22000, category: "치킨" },
    { id: 2, name: "후라이드 치킨", price: 20000, category: "치킨" },
    { id: 3, name: "치즈볼", price: 5000, category: "사이드" },
    { id: 4, name: "콜라", price: 2000, category: "음료" },
  ] },
  { name: "한솥도시락 충남대후문점", category: "한식", emoji: "🍱", imageId: "1512058564366-18510be2db19", source: "https://www.diningcode.com/profile.php?rid=ItvGu8AIaw8u", menus: [
    { id: 1, name: "치킨마요", price: 4500, category: "도시락" },
    { id: 2, name: "돈까스 도련님", price: 5500, category: "도시락" },
    { id: 3, name: "제육 도시락", price: 6500, category: "도시락" },
  ] },
  { name: "써브웨이 대전충남대정문점", category: "패스트푸드", emoji: "🥪", imageId: "1553909489-cd47e0ef937f", source: "https://www.albamon.com/jobs/detail-company/JAITP7_Ci6FhjHWbAZLdpQ%3D%3D", menus: [
    { id: 1, name: "에그마요 샌드위치", price: 6500, category: "샌드위치" },
    { id: 2, name: "이탈리안 비엠티", price: 7500, category: "샌드위치" },
    { id: 3, name: "쿠키", price: 1500, category: "사이드" },
  ] },
  { name: "홍콩반점0410 궁동점", category: "중식", emoji: "🥡", imageId: "1563245372-f21724e3856d", source: "https://www.koobig.com/716413", menus: [
    { id: 1, name: "짜장면", price: 7000, category: "식사" },
    { id: 2, name: "짬뽕", price: 9000, category: "식사" },
    { id: 3, name: "탕수육", price: 17000, category: "사이드" },
  ] },
  { name: "이디야커피 충대정문점", category: "카페", emoji: "☕", imageId: "1509042239860-f550ce710b93", source: "https://www.diningcode.com/list.dc?query=대전궁동++빙수", menus: [
    { id: 1, name: "아메리카노", price: 3500, category: "음료" },
    { id: 2, name: "카페라테", price: 4500, category: "음료" },
    { id: 3, name: "바닐라 라테", price: 5000, category: "음료" },
  ] },
] satisfies { name: string; category: string; emoji: string; imageId: string; source: string; menus: MenuItem[] }[]

export const CAMPUS_POSTS: Post[] = Array.from({ length: 12 }, (_, index) => {
  const store = CAMPUS_STORES[index % CAMPUS_STORES.length]
  const members = index % 3 === 0 ? 2 : 1
  return {
    id: index + 1, restaurant: store.name, category: store.category, emoji: store.emoji,
    currentMembers: members, maxMembers: 3, minOrderAmount: 15000,
    currentAmount: store.menus[0].price * members, distance: [120, 210, 85, 300, 110, 350, 160, 270, 430, 550, 190, 620][index],
    deadline: index % 2 ? "19:00" : "18:30", deliveryTime: "모집 마감 후 약 30분",
    leaderRating: 4.6 + (index % 4) / 10, leaderTrades: 8 + index * 3,
    leaderName: ["공강한끼", "밥친구", "샌드위치친구", "짬뽕좋아", "커피타임"][index % 5] + (index >= 5 ? String(index) : ""),
    status: "recruiting", gradFrom: "#f8b181", gradTo: "#e87945",
    description: "충남대 정문 주변에서 각자 음식을 받아 가져가요. 정확한 장소와 시간은 채팅에서 합의해요.",
    imageId: store.imageId, menus: store.menus, storeSource: store.source,
  }
})

export const WALKING_NOTE = "리더까지의 직선거리 기준 시연 추정 · 수령 장소 확정 후 달라질 수 있어요."
