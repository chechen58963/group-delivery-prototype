import catalog from "../catalogExpansion.json"

import photos from "../menuPhotos.json"

import variants from "../menuPhotoVariants.json"

import presentation from "../menuPresentation.json"

export type Category = "all" | "coffee" | "burger" | "sandwich"

export type Menu = {
  id: number
  name: string
  price: number
  photo: string
  drink: boolean
  temperatures: ("ICE" | "HOT")[]
}

export type Store = {
  id: string
  name: string
  short: string
  category: Exclude<Category, "all">
  logo: string
  tone: string
  goal: number
  menus: Menu[]
}

const brandData = [
  {
    id: "ediya",
    prefix: "이디야",
    short: "이디야커피",
    logo: "ediya.gif",
    tone: "#edf3fb",
  },

  {
    id: "mom",
    prefix: "맘스터치",
    short: "맘스터치",
    logo: "momstouch.svg",
    tone: "#fff1e9",
  },

  {
    id: "subway",
    prefix: "써브웨이",
    short: "써브웨이",
    logo: "subway.png",
    tone: "#f0f5df",
  },

  {
    id: "mega",
    prefix: "메가",
    short: "메가MGC커피",
    logo: "mega.png",
    tone: "#fff8d9",
  },

  {
    id: "compose",
    prefix: "컴포즈",
    short: "컴포즈커피",
    logo: "compose.svg",
    tone: "#fff5de",
  },

  {
    id: "paik",
    prefix: "빽다방",
    short: "빽다방",
    logo: "paik.png",
    tone: "#fff9e0",
  },

  {
    id: "lotteria",
    prefix: "롯데리아",
    short: "롯데리아",
    logo: "lotteria.svg",
    tone: "#fff0ed",
  },

  {
    id: "venti",
    prefix: "더벤티",
    short: "더벤티",
    logo: "theventi.png",
    tone: "#f1edfc",
  },
]

const imageMap = photos as Record<string, Record<string, string>>,
  temperatureMap =
    variants as Record<string, Record<string, Record<string, string>>>

export const stores: Store[] = brandData.map((brand) => {
  const raw = catalog.find((s) => s.store_name.startsWith(brand.prefix))!

  const photoBrand = Object.keys(imageMap).find((p) =>
    raw.store_name.startsWith(p),
  )!

  return {
    id: brand.id,
    name: raw.store_name,
    short: brand.short,
    category: raw.menu_key as Store["category"],
    logo: `/images/brands/${brand.logo}`,
    tone: brand.tone,
    goal: raw.goal_amount,
    menus: raw.menus.map((m) => {
      const temperatures = (presentation
        .find((s) => s.store_name === raw.store_name)
        ?.menus.find((v) => v.id === m.id)?.temperature_options ??
        []) as ("ICE" | "HOT")[]
      return {
        ...m,
        photo:
          temperatureMap[photoBrand]?.[m.name]?.ICE ??
          imageMap[photoBrand]?.[m.name] ??
          "",
        drink: temperatures.length > 0,
        temperatures,
      }
    }),
  }
})

export const storeById = (id: string) =>
  stores.find((s) => s.id === id) ?? stores[0]

export type Room = {
  id: string
  storeId: string
  title: string
  leader: string
  rating: string
  trades: number
  distance: number
  minutes: number
  until: number
  place: string
  max: number
  fee: number
  tag?: string
  goal?: number
  note?: string
}

export const rooms: Room[] = [
  {
    id: "coffee-01",
    storeId: "ediya",
    title: "아아 한 잔, 같이 시킬 분?",
    leader: "민지",
    rating: "4.9",
    trades: 24,
    distance: 180,
    minutes: 3,
    until: 12,
    place: "충남대 정문 앞 벤치",
    max: 2,
    fee: 3000,
    tag: "곧 마감",
  },

  {
    id: "burger-01",
    storeId: "mom",
    title: "출출한데 버거 하나 어때요?",
    leader: "도윤",
    rating: "4.8",
    trades: 18,
    distance: 240,
    minutes: 4,
    until: 24,
    place: "충남대 도서관 입구",
    max: 2,
    fee: 3000,
  },

  {
    id: "sandwich-01",
    storeId: "subway",
    title: "가볍게 샌드위치 같이 먹어요",
    leader: "지우",
    rating: "4.9",
    trades: 31,
    distance: 320,
    minutes: 5,
    until: 18,
    place: "궁동 로데오 입구",
    max: 2,
    fee: 3000,
  },

  {
    id: "coffee-02",
    storeId: "mega",
    title: "오후 커피 한 잔 함께해요",
    leader: "현우",
    rating: "4.7",
    trades: 12,
    distance: 120,
    minutes: 2,
    until: 32,
    place: "충남대 정문 앞 벤치",
    max: 2,
    fee: 3000,
  },

  {
    id: "coffee-03",
    storeId: "compose",
    title: "라떼랑 디저트 드실 분 찾아요",
    leader: "서연",
    rating: "4.9",
    trades: 42,
    distance: 270,
    minutes: 4,
    until: 22,
    place: "공대 1호관 입구",
    max: 2,
    fee: 3000,
  },

  {
    id: "burger-02",
    storeId: "lotteria",
    title: "버거 먹고 다시 힘내봐요",
    leader: "준호",
    rating: "4.8",
    trades: 21,
    distance: 360,
    minutes: 6,
    until: 40,
    place: "충남대 후문 앞",
    max: 2,
    fee: 3000,
  },
]

export type Item = {
  menuId: number
  quantity: number
  temperature: "ICE" | "HOT" | ""
}

export type Pickup = "meet" | "nearby" | "contactless"

export type Phase = "pending" | "menu" | "payment" | "delivery" | "receipt" | "complete"

export type Order = {
  id: string
  room: Room
  role: "participant" | "leader"
  phase: Phase
  items: Item[]
  pickup: Pickup
  place: string
  time: string
  bank: string
  account: string
  holder: string
  applicant: "waiting" | "pending" | "accepted" | "rejected"
  leaderReady: boolean
  claimed: boolean
  confirmed: boolean
  received: boolean
  companionReceived: boolean
  dropoff: boolean
  photo: string
  reviewed: boolean
  pickupPending?: boolean
}

export type Message = {
  id: number
  mine: boolean
  body: string
  time: string
  system?: boolean
}

export type Notice = {
  id: number
  title: string
  body: string
  read: boolean
  target: "order" | "explore"
  time: string
}

export const amount = (n: number) => n.toLocaleString("ko-KR") + "원"

export const subtotal = (store: Store, items: Item[]) =>
  items.reduce(
    (n, i) =>
      n + (store.menus.find((m) => m.id === i.menuId)?.price ?? 0) * i.quantity,
    0,
  )

export const ownFee = (order: Order) =>
  order.pickup === "nearby" ? order.room.fee : Math.ceil(order.room.fee / 2)

export function companionItems(
  store: Store,
  own: Item[],
  goal = store.goal,
): Item[] {
  const first = store.menus[1] ?? store.menus[0],
    needed = Math.max(first.price, goal - subtotal(store, own))

  return [
    {
      menuId: first.id,
      quantity: Math.min(4, Math.ceil(needed / first.price)),
      temperature: first.drink ? "ICE" : "",
    },
  ]
}

export const itemText = (store: Store, item: Item) =>
  `${store.menus.find((m) => m.id === item.menuId)?.name ?? "메뉴"}${
    item.temperature ? ` · ${item.temperature}` : ""
  }`

export function menuPhoto(store: Store, menu: Menu, temperature: string) {
  const brand = Object.keys(temperatureMap).find((p) =>
    store.name.startsWith(p),
  )
  return (
    (brand && temperatureMap[brand]?.[menu.name]?.[temperature]) || menu.photo
  )
}

export function pickupClock() {
  const d = new Date(Date.now() + 35 * 60000)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export const reviews = [
  {
    name: "지우",
    stars: 5,
    text: "약속 장소를 자세히 알려주셔서 쉽게 찾았어요.",
    date: "11.14",
  },
  {
    name: "도윤",
    stars: 5,
    text: "메뉴 확인도 빠르고 시간도 잘 맞춰주셨어요.",
    date: "11.12",
  },
  {
    name: "서연",
    stars: 5,
    text: "처음 같이 주문했는데 편하게 받을 수 있었어요.",
    date: "11.09",
  },
]
