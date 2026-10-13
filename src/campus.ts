import type { MenuItem, Post } from "./workflow"

export const CAMPUS_CENTER = { lat: 36.3621, lng: 127.3444 }
export const CAMPUS_LOCATION = "충남대학교 정문 주변"
export const MENU_CHECKED_ON = "2026-10-13"
export const CATEGORY_PHOTOS: Record<string, string> = {
  치킨: "1626082927389-6cd097cdc6ec", 한식: "1512058564366-18510be2db19", 패스트푸드: "1528735602780-2552fd46c7af",
  중식: "1563245372-f21724e3856d", 카페: "1509042239860-f550ce710b93", 피자: "1571407970349-bc81e7e96d47",
  일식: "1579871494447-9811cf80d66c", 분식: "1635363638580-c2809d049eee", 버거: "1568901346375-23c9450c58cd",
}
type Store = {
  name: string; category: string; emoji: string; imageId: string; source: string;
  menuSource: string; menuBasis: string; priceNote: string; demoMinOrder: number; menus: MenuItem[];
}
const referencePrice = "공개 자료의 참고 가격이에요. 배달앱 가격·지점별 판매 메뉴와 선택 옵션은 달라질 수 있어요."
function store(name: string, category: string, emoji: string, source: string, demoMinOrder: number, items: [string, number, string][], options: Partial<Pick<Store, "menuSource" | "menuBasis" | "priceNote">> = {}): Store {
  return { name, category, emoji, imageId: CATEGORY_PHOTOS[category], source, demoMinOrder,
    menuSource: source, menuBasis: "매장 공개 메뉴", priceNote: referencePrice, ...options,
    menus: items.map(([name, price, category], index) => ({ id: index + 1, name, price, category })),
  }
}
// First five stores retain their order so existing recruitment IDs remain stable.
// Reputation, recruitment locations and minimum order conditions are simulated.
export const CAMPUS_STORES: Store[] = [
  store("bhc 대전궁동점", "치킨", "🍗", "https://www.diningcode.com/profile.php?rid=ti2FyS4YcLQd", 20000, [
    ["뿌링클", 21000, "치킨"], ["콰삭킹", 21000, "치킨"], ["커링클", 21900, "치킨"], ["크리스피번(밀크)", 5500, "사이드"],
  ]),
  store("한솥도시락 충남대후문점", "한식", "🍱", "https://www.diningcode.com/profile.php?rid=ItvGu8AIaw8u", 10000, [
    ["빅치킨마요", 4500, "도시락"], ["돈까스도련님 고기고기", 8500, "도시락"], ["진달래 도시락", 10000, "도시락"], ["한솥 닭강정(소)", 4100, "사이드"],
  ]),
  store("써브웨이 대전충남대정문점", "패스트푸드", "🥪", "https://www.diningcode.com/profile.php?rid=denVMMONBpsd", 12000, [
    ["에그마요 (15cm)", 7200, "샌드위치"], ["이탈리안 비엠티 (15cm)", 8500, "샌드위치"], ["로스트 치킨 (15cm)", 9000, "샌드위치"], ["초코칩 쿠키", 2100, "사이드"],
  ]),
  store("홍콩반점0410 궁동점", "중식", "🥡", "https://www.koobig.com/716413", 15000, [
    ["짜장면", 7000, "식사"], ["짬뽕", 9000, "식사"], ["탕수육(소)", 16800, "사이드"], ["군만두 반접시", 4000, "사이드"],
  ], { menuSource: "https://www.diningcode.com/profile.php?rid=8uOLcQfANUHA", menuBasis: "브랜드 메뉴 참고 · 궁동점 판매 확인 필요", priceNote: "브랜드의 다른 지점 공개 메뉴를 참고한 시연 가격이에요. 궁동점의 가격·판매 여부는 확인이 필요해요." }),
  store("이디야커피 충대정문점", "카페", "☕", "https://www.diningcode.com/profile.php?rid=htpPcDkbr6gj", 8000, [
    ["카페 아메리카노", 3200, "음료"], ["카페 라떼", 4200, "음료"], ["토피 넛 라떼", 4200, "음료"],
  ]),
  store("씨멘트 궁동충남대점", "피자", "🍕", "https://www.diningcode.com/profile.php?rid=tHaC5ZhnUpeb", 18000, [
    ["포테이토피자", 13000, "피자"], ["불고기 샐러드 피자", 14000, "피자"], ["매운해물토마토파스타", 10500, "파스타"], ["매콤쉬림프필라프", 10500, "필라프"], ["씨멘트크런치", 8900, "사이드"],
  ]),
  store("신전떡볶이 충남대로데오점", "분식", "🍢", "https://www.diningcode.com/profile.php?rid=etTXjuW1odB4", 10000, [
    ["신전떡볶이(순한맛)", 4000, "떡볶이"], ["순대떡볶이(중간맛)", 4500, "떡볶이"], ["모둠튀김", 4500, "튀김"], ["신전치킨마요컵밥", 4000, "컵밥"],
  ]),
  store("뎅뎅뎅 연어와 덮밥 궁동본점", "일식", "🍣", "https://www.diningcode.com/profile.php?rid=IoeZCfrIHVnG", 15000, [
    ["양념사케동", 10500, "덮밥"], ["육회동", 8500, "덮밥"], ["돈테키동", 8500, "덮밥"], ["돈코츠라멘", 8000, "라멘"],
  ]),
  store("맘스터치 충남대점", "버거", "🍔", "https://triple.guide/restaurants/43c29be1-e8e6-4b74-a7db-c84c4a61cbc5", 12000, [
    ["싸이버거", 4900, "버거"], ["불싸이버거", 5100, "버거"], ["화이트갈릭버거", 5500, "버거"], ["간장마늘싸이버거", 5400, "버거"],
  ], { menuSource: "https://order.momstouch.co.kr/momsmall/menu.jsp?menu_cd=001", menuBasis: "공식 브랜드 메뉴", priceNote: "실제 브랜드 메뉴를 사용하며 금액은 시연용이에요. 이 지점의 배달앱 가격은 확인이 필요해요." }),
  store("메가MGC커피 대전충남대정문점", "카페", "🧋", "https://www.diningcode.com/profile.php?rid=pd9NSPLFSMO8", 8000, [
    ["메가리카노", 3000, "음료"], ["퐁크러쉬플레인", 3900, "음료"], ["쿠키프라페", 3900, "음료"],
  ]),
  store("이런이궈마라탕 충남대점", "중식", "🍲", "https://www.diningcode.com/profile.php?rid=CFETDIsOSmst", 17000, [
    ["마라탕(2인분)", 17000, "마라탕"], ["마라샹궈(2인분)", 22000, "마라샹궈"], ["꿔바로우(중)", 10000, "사이드"], ["공기밥", 1000, "사이드"],
  ]),
  store("봉구스밥버거 충남대점", "한식", "🍚", "https://www.diningcode.com/profile.php?rid=rXa2Plvb2Zey", 10000, [
    ["햄치즈", 4300, "밥버거"], ["봉구퀸", 6500, "밥버거"], ["육개장 사발면", 1200, "사이드"], ["펩시제로", 1300, "음료"],
  ]),
]
const oldStoreIndexes = Array.from({ length: 12 }, (_, i) => i % 5)
const addedStoreIndexes = CAMPUS_STORES.slice(5).flatMap((_, i) => [i + 5, i + 5])
export const CAMPUS_POSTS: Post[] = [...oldStoreIndexes, ...addedStoreIndexes].map((storeIndex, index) => {
  const store = CAMPUS_STORES[storeIndex]
  const members = index % 3 === 0 ? 2 : 1
  return {
    id: index < 12 ? index + 1 : 101 + index - 12,
    restaurant: store.name, category: store.category, emoji: store.emoji,
    currentMembers: members, maxMembers: 3, minOrderAmount: store.demoMinOrder,
    currentAmount: store.menus[0].price * members,
    distance: [120, 210, 85, 300, 110, 350, 160, 270, 430, 550, 190, 620][index % 12],
    deadline: index % 2 ? "19:00" : "18:30", deliveryTime: "모집 마감 후 약 30분",
    leaderRating: (46 + index % 4) / 10, leaderTrades: 8 + index * 3,
    leaderName: ["공강한끼", "밥친구", "샌드위치친구", "짬뽕좋아", "커피타임"][index % 5] + (index >= 5 ? String(index) : ""),
    status: "recruiting", gradFrom: "#f8b181", gradTo: "#e87945",
    description: "충남대 정문 주변에서 각자 음식을 받아 가져가요. 정확한 장소와 시간은 채팅에서 합의해요.",
    imageId: store.imageId, menus: store.menus, storeSource: store.source,
    menuSource: store.menuSource, menuBasis: store.menuBasis, priceNote: store.priceNote,
  }
})
// Preserve owned recruitment and ongoing orders when refreshing the catalogue.
export function mergeCampusPosts(savedPosts: Post[], seedPosts: Post[], activeId?: number): Post[] {
  const seeds = new Map(seedPosts.map(post => [post.id, post]))
  const knownIds = new Set(savedPosts.map(post => post.id))
  return [...savedPosts.map(post => {
    const seed = seeds.get(post.id)
    if (!seed || post.leaderName === "나" || post.id === activeId) return post
    return { ...seed, status: post.status, ...(post.closesAt !== undefined ? { closesAt: post.closesAt } : {}) }
  }), ...seedPosts.filter(post => !knownIds.has(post.id))]
}
export const WALKING_NOTE = "리더까지의 직선거리 기준 시연 추정 · 수령 장소 확정 후 달라질 수 있어요."
