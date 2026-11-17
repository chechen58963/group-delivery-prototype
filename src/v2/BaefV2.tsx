import { useEffect, useRef, useState } from "react"

import { Browse, ChooseStore, RoomDetail } from "./Browse"

import {
  ChatView,
  CreateRoom,
  Menus,
  OrderView,
  type OrderTool,
} from "./OrderFlow"

import {
  AccountSheet,
  LocationSheet,
  MapSheet,
  PersonSheet,
  PickupSheet,
  PreferencesSheet,
  ReviewSheet,
  ShopSheet,
  VoucherSheet,
  products,
} from "./Sheets"

import { Avatar, Button, Empty, Modal, SectionTitle, Tag } from "./ui"

import Icon, { type IconName } from "./icons"

import {
  ownFee,
  pickupClock,
  reviews,
  rooms,
  storeById,
  type Item,
  type Message,
  type Notice,
  type Order,
  type Pickup,
  type Room,
  type Store,
} from "./data"

type View = "explore" | "detail" | "stores" | "menus" | "create" | "order" | "chat" | "profile"

type Route = {
  view: View
  room: string
  store: string
  purpose: "join" | "create" | "edit"
}

type Sheet = OrderTool | "location" | "alerts" | "review" | "shop" | "voucher" | "edit-profile" | "theme" | "preferences" | "saved" | null

type Model = {
  version: 1
  nickname: string
  location: string
  order: Order | null
  messages: Message[]
  notices: Notice[]
  saved: string[]
  points: number
  vouchers: string[]
  preference: string[]
  theme: "light" | "dark"
}

const storageKey = "baef-v2-ui-v1"

const initial: Model = {
  version: 1,
  nickname: "수민",
  location: "충남대 정문",
  order: null,
  messages: [],
  notices: [],
  saved: [],
  points: 1280,
  vouchers: [],
  preference: [],
  theme: "light",
}

function restore(): Model {
  try {
    const x = JSON.parse(sessionStorage.getItem(storageKey) ?? "null")
    if (
      x?.version === 1 &&
      typeof x.nickname === "string" &&
      Array.isArray(x.saved) &&
      Array.isArray(x.messages) &&
      Array.isArray(x.notices) &&
      typeof x.points === "number" &&
      Array.isArray(x.vouchers) &&
      Array.isArray(x.preference)
    )
      return { ...initial, ...x }
  } catch {
    /* Keep the UI usable if storage is unavailable. */
  }
  return initial
}

const views: View[] = [
  "explore",
  "detail",
  "stores",
  "menus",
  "create",
  "order",
  "chat",
  "profile",
]

function readRoute(): Route {
  const p = new URLSearchParams(location.search),
    v = p.get("view") as View
  return {
    view: views.includes(v) ? v : "explore",
    room: p.get("room") ?? rooms[0].id,
    store: p.get("store") ?? "ediya",
    purpose:
      p.get("purpose") === "create"
        ? "create"
        : p.get("purpose") === "edit"
          ? "edit"
          : "join",
  }
}

const clock = () =>
  new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

const introduction = (name: string): Message[] => [
  {
    id: 1,
    mine: false,
    body: "안녕하세요! 같이 주문하게 되어 반가워요.",
    time: clock(),
  },
  {
    id: 2,
    mine: true,
    body: "안녕하세요. 제 메뉴도 담아두었어요!",
    time: clock(),
  },
  {
    id: 3,
    mine: false,
    body: "좋아요 :) 정문 앞 벤치에서 받으면 어떨까요?",
    time: clock(),
  },
  {
    id: 4,
    mine: false,
    body: "음식 도착하면 제가 먼저 알려드릴게요.",
    time: clock(),
  },
  {
    id: 5,
    mine: false,
    body: `${name}님도 편한 장소가 있으면 말씀해 주세요.`,
    time: clock(),
  },
]

export default function BaefV2() {
  const [model, setModel] = useState<Model>(restore),
    [route, setRoute] = useState<Route>(readRoute),
    [sheet, setSheet] = useState<Sheet>(null),
    [toast, setToast] = useState(""),
    [draft, setDraft] = useState<{ store: string; items: Item[] }>({
      store: "ediya",
      items: [],
    }),
    [voucher, setVoucher] = useState("snack")

  const sequence = useRef(Date.now()),
    chatTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    proposalTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const order = model.order,
    active = !!order && order.phase !== "complete",
    room =
      order?.room.id === route.room
        ? order.room
        : (rooms.find((r) => r.id === route.room) ?? rooms[0]),
    store = storeById(route.store)

  const notify = (text: string) => setToast(text)

  const notice = (
    title: string,
    body: string,
    target: Notice["target"] = "order",
  ): Notice => ({
    id: ++sequence.current,
    title,
    body,
    read: false,
    target,
    time: clock(),
  })

  const push = (
    view: View,
    options: Partial<Omit<Route, "view">> = {},
    replace = false,
  ) => {
    const next = { ...route, ...options, view },
      url = new URL(location.href)
    url.search = ""
    if (view !== "explore") url.searchParams.set("view", view)

    if (["detail", "menus"].includes(view))
      url.searchParams.set("room", next.room)

    if (["menus", "create"].includes(view)) {
      url.searchParams.set("store", next.store)
      url.searchParams.set("purpose", next.purpose)
    }

    history[replace ? "replaceState" : "pushState"](
      {
        bv2: true,
        depth: Number(history.state?.depth ?? 0) + (replace ? 0 : 1),
      },
      "",
      url,
    )
    setRoute(next)
    setSheet(null)
  }

  const back = () => {
    setSheet(null)
    if (history.state?.bv2 && history.state.depth > 0) history.back()
    else push("explore", {}, true)
  }

  const patch = (data: Partial<Order>) =>
    setModel((m) =>
      !m.order || m.order.id !== order?.id
        ? m
        : { ...m, order: { ...m.order, ...data } },
    )

  const save = (id: string) =>
    setModel((m) => ({
      ...m,
      saved: m.saved.includes(id)
        ? m.saved.filter((s) => s !== id)
        : [...m.saved, id],
    }))

  useEffect(() => {
    document.title = "배프.v2 · 가볍게 함께 주문해요"
    document.documentElement.lang = "ko"
    if (!history.state?.bv2) history.replaceState({ bv2: true, depth: 0 }, "")
    const pop = () => {
      setRoute(readRoute())
      setSheet(null)
    }
    window.addEventListener("popstate", pop)
    return () => {
      window.removeEventListener("popstate", pop)
      if (chatTimer.current) clearTimeout(chatTimer.current)
      if (proposalTimer.current) clearTimeout(proposalTimer.current)
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(model))
    } catch {
      /* Photos may exceed the available session storage; the current screen remains usable. */
    }
  }, [model])

  useEffect(() => {
    document.documentElement.dataset.bvTheme = model.theme
    return () => {
      delete document.documentElement.dataset.bvTheme
    }
  }, [model.theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!order) return
    const id = order.id
    let timer: ReturnType<typeof setTimeout> | undefined

    if (order.phase === "pending")
      timer = setTimeout(() => {
        setModel((m) =>
          m.order?.id !== id || m.order.phase !== "pending"
            ? m
            : {
                ...m,
                order: {
                  ...m.order,
                  phase: "menu",
                  applicant: "accepted",
                  bank: "카카오뱅크",
                  account: "3333-01-4826190",
                  holder: m.order.room.leader,
                },
                notices: [
                  notice(
                    "참가 신청이 수락됐어요",
                    "내 메뉴와 수령 장소를 확인해 주세요.",
                  ),
                  ...m.notices,
                ],
              },
        )
        notify("리더가 참가 신청을 수락했어요. 내 주문을 확인해 주세요.")
      }, 3200)
    else if (
      order.phase === "menu" &&
      order.role === "leader" &&
      order.applicant === "waiting"
    )
      timer = setTimeout(
        () =>
          setModel((m) =>
            m.order?.id !== id || m.order.phase !== "menu"
              ? m
              : {
                  ...m,
                  order: { ...m.order, applicant: "pending" },
                  notices: [
                    notice(
                      "새 참가 신청이 왔어요",
                      "지우님의 프로필을 확인하고 함께 주문할지 정해 주세요.",
                    ),
                    ...m.notices,
                  ],
                },
          ),
        2200,
      )
    else if (
      order.phase === "payment" &&
      order.role === "participant" &&
      order.claimed &&
      !order.confirmed
    )
      timer = setTimeout(() => {
        setModel((m) =>
          m.order?.id !== id || m.order.phase !== "payment"
            ? m
            : {
                ...m,
                order: { ...m.order, confirmed: true, phase: "delivery" },
                notices: [
                  notice(
                    "입금 확인 · 주문 완료",
                    "리더가 입금을 확인하고 주문을 마쳤어요.",
                  ),
                  ...m.notices,
                ],
              },
        )
        notify("입금이 확인됐어요. 음식이 준비되고 있어요.")
      }, 2600)
    else if (
      order.phase === "payment" &&
      order.role === "leader" &&
      order.leaderReady &&
      !order.claimed
    )
      timer = setTimeout(
        () =>
          setModel((m) =>
            m.order?.id !== id || m.order.phase !== "payment"
              ? m
              : {
                  ...m,
                  order: { ...m.order, claimed: true },
                  notices: [
                    notice(
                      "지우님이 송금을 표시했어요",
                      "계좌에 입금된 금액을 확인해 주세요.",
                    ),
                    ...m.notices,
                  ],
                },
          ),
        2200,
      )
    else if (
      order.phase === "receipt" &&
      order.received &&
      !order.companionReceived
    )
      timer = setTimeout(() => {
        setModel((m) =>
          m.order?.id !== id || m.order.phase !== "receipt"
            ? m
            : {
                ...m,
                order: {
                  ...m.order,
                  companionReceived: true,
                  phase: "complete",
                },
                points:
                  m.points +
                  20 +
                  Math.floor(
                    (m.order.pickup === "nearby" ? 0 : m.order.room.distance) /
                      5,
                  ),
                notices: [
                  notice(
                    "모든 배프가 음식을 받았어요",
                    "함께한 배프에게 후기를 남겨 주세요.",
                  ),
                  ...m.notices,
                ],
              },
        )
        notify("모두 수령했어요. 포인트가 적립됐어요!")
      }, 1900)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [
    order?.id,
    order?.phase,
    order?.applicant,
    order?.leaderReady,
    order?.claimed,
    order?.confirmed,
    order?.received,
    order?.companionReceived,
  ])

  const startCreate = (selected?: Store) => {
    if (active) {
      notify("진행 중인 주문을 먼저 마쳐 주세요.")
      push("order")
      return
    }
    if (selected) {
      setDraft({ store: selected.id, items: [] })
      push("menus", { store: selected.id, purpose: "create" })
    } else push("stores")
  }

  const beginOrder = (
    role: Order["role"],
    newRoom: Room,
    items: Item[],
    extra: Partial<Order> = {},
  ) => {
    const next: Order = {
      id: `order-${Date.now()}`,
      room: newRoom,
      role,
      phase: role === "leader" ? "menu" : "pending",
      items,
      pickup: "meet",
      place: newRoom.place,
      time: pickupClock(),
      bank: "",
      account: "",
      holder: "",
      applicant: role === "leader" ? "waiting" : "accepted",
      leaderReady: false,
      claimed: false,
      confirmed: false,
      received: false,
      companionReceived: false,
      dropoff: false,
      photo: "",
      reviewed: false,
      ...extra,
    }

    setModel((m) => ({ ...m, order: next, messages: introduction(m.nickname) }))
    push("order")
  }

  const menuDone = (items: Item[]) => {
    setDraft({ store: store.id, items })
    if (route.purpose === "create")
      push("create", { store: store.id, purpose: "create" })
    else if (route.purpose === "edit") {
      patch({ items })
      push("order")
      notify("내 메뉴를 저장했어요.")
    } else beginOrder("participant", room, items)
  }

  const createOrder = (data: {
    max: number
    goal: number
    fee: number
    time: string
    place: string
    note: string
    deadline: number
  }) => {
    const newRoom: Room = {
      id: `my-${Date.now()}`,
      storeId: store.id,
      title: `${store.short}, 같이 주문해요`,
      leader: model.nickname,
      rating: "4.9",
      trades: 8,
      distance: 180,
      minutes: 3,
      until: data.deadline,
      place: data.place,
      max: data.max,
      fee: data.fee,
      goal: data.goal,
      note: data.note,
    }
    beginOrder("leader", newRoom, draft.items, { time: data.time })
    notify("모집을 시작했어요. 함께할 배프를 기다려요.")
  }

  const send = (body: string) => {
    setModel((m) => ({
      ...m,
      messages: [
        ...m.messages,
        { id: ++sequence.current, mine: true, body, time: clock() },
      ],
    }))
    if (chatTimer.current) clearTimeout(chatTimer.current)
    chatTimer.current = setTimeout(
      () =>
        setModel((m) => ({
          ...m,
          messages: [
            ...m.messages,
            {
              id: ++sequence.current,
              mine: false,
              body: "확인했어요! 그럼 약속한 장소에서 편하게 받아요 :)",
              time: clock(),
            },
          ],
        })),
      1300,
    )
  }

  const unread = model.notices.filter((n) => !n.read).length,
    mainView = ["explore", "profile"].includes(route.view),
    other =
      order?.role === "leader" ? "지우" : (order?.room.leader ?? room.leader)

  const nav: [View, string, IconName][] = [
    ["explore", "둘러보기", "explore"],
    ["order", "내 주문", "bag"],
    ["chat", "채팅", "chat"],
    ["profile", "내 정보", "person"],
  ]

  const tool = (t: OrderTool) => setSheet(t)

  return (
    <div className="bv-app">
      <a className="bv-skip" href="#bv-content">
        본문으로 건너뛰기
      </a>
      <aside className="bv-sidebar">
        <a className="bv-wordmark" href="/v2/">
          배프<span>.</span>
          <small>v2</small>
        </a>
        <p className="bv-brand-note">가볍게 함께 주문해요</p>
        <nav aria-label="주 메뉴">
          {nav.map(([view, label, icon]) => (
            <button
              key={view}
              className={route.view === view ? "active" : ""}
              aria-current={route.view === view ? "page" : undefined}
              onClick={() => push(view)}
            >
              <Icon name={icon} />
              {label}
              {view === "order" && active && <i />}
            </button>
          ))}
        </nav>
        <Button secondary onClick={() => startCreate()}>
          <Icon name="plus" size={19} />새 모집 시작
        </Button>
        <div className="bv-sidebar-bottom">
          <div className="bv-sidebar-points">
            <Icon name="walk" size={24} />
            <span>
              오늘도 한 걸음 가볍게<b>{model.points.toLocaleString()} P</b>
            </span>
          </div>
          <a href="/" className="bv-original-link">
            기존 배프 보기
            <Icon name="arrow" size={15} />
          </a>
        </div>
      </aside>
      <div className={`bv-main ${route.view === "chat" ? "chat-mode" : ""}`}>
        {mainView && (
          <header className="bv-app-header">
            <a className="bv-wordmark bv-mobile-logo" href="/v2/">
              배프<span>.</span>
              <small>v2</small>
            </a>
            <span className="bv-desktop-greeting">
              {model.nickname}님, 오늘은 뭘 드실래요?
            </span>
            <div>
              <button
                className="bv-icon bv-notification-button"
                aria-label={`알림 ${unread}개`}
                onClick={() => setSheet("alerts")}
              >
                <Icon name="bell" />
                {unread > 0 && <i>{unread}</i>}
              </button>
              <button
                className="bv-header-avatar"
                aria-label="내 정보 보기"
                onClick={() => push("profile")}
              >
                <Avatar name={model.nickname} size="small" />
              </button>
            </div>
          </header>
        )}
        <main
          id="bv-content"
          className={`bv-content view-${route.view}`}
          key={
            route.view === "menus"
              ? `${route.view}:${route.store}:${route.purpose}`
              : route.view
          }
        >
          {route.view === "explore" && (
            <>
              <Browse
                openRoom={(r) => push("detail", { room: r.id })}
                create={startCreate}
                location={model.location}
                openLocation={() => setSheet("location")}
                active={active}
                openOrder={() => push("order")}
                saved={model.saved}
                toggleSaved={save}
              />
              <div className="bv-preferences-link">
                <button onClick={() => setSheet("preferences")}>
                  <Icon name="bell" size={20} />
                  <span>
                    <b>
                      {model.preference.length
                        ? `${model.preference.join(" · ")} 메뉴 알림을 기다리고 있어요`
                        : "아직 뭘 먹을지 고민된다면?"}
                    </b>
                    <small>먹고 싶은 메뉴만 먼저 골라두세요</small>
                  </span>
                  <Icon name="chevron" size={17} />
                </button>
              </div>
            </>
          )}
          {route.view === "detail" && (
            <RoomDetail
              room={room}
              back={back}
              join={() => {
                if (active) {
                  push("order")
                  return
                }
                setDraft({ store: room.storeId, items: [] })
                push("menus", {
                  store: room.storeId,
                  room: room.id,
                  purpose: "join",
                })
              }}
              profile={() => setSheet("profile")}
              showMap={() => setSheet("map")}
              saved={model.saved.includes(room.id)}
              toggleSaved={() => save(room.id)}
            />
          )}
          {route.view === "stores" && (
            <ChooseStore back={back} select={startCreate} />
          )}
          {route.view === "menus" && (
            <Menus
              key={`${route.store}:${route.purpose}`}
              store={store}
              initial={
                route.purpose === "edit"
                  ? (order?.items ?? [])
                  : draft.store === store.id
                    ? draft.items
                    : []
              }
              purpose={route.purpose}
              back={back}
              fee={route.purpose === "edit" && order ? ownFee(order) : 1500}
              done={menuDone}
            />
          )}
          {route.view === "create" && (
            <CreateRoom
              store={store}
              items={draft.items}
              back={back}
              create={createOrder}
            />
          )}
          {route.view === "order" &&
            (order ? (
              <OrderView
                order={order}
                nickname={model.nickname}
                back={() => push("explore")}
                chat={() => push("chat")}
                tool={tool}
                edit={() =>
                  push("menus", { store: order.room.storeId, purpose: "edit" })
                }
                update={patch}
                notify={notify}
                finish={() => push("explore")}
                onRate={() => setSheet("review")}
              />
            ) : (
              <Empty
                title="함께 주문할 한 끼를 찾아봐요"
                body="모집에 참가하거나 직접 모집하면 여기서 주문을 이어갈 수 있어요."
              >
                <Button onClick={() => push("explore")}>
                  주변 배프 둘러보기
                </Button>
              </Empty>
            ))}
          {route.view === "chat" &&
            (order ? (
              <ChatView
                order={order}
                messages={model.messages}
                nickname={model.nickname}
                back={back}
                openOrder={() => push("order")}
                send={send}
                openPickup={() => setSheet("map")}
              />
            ) : (
              <Empty
                title="함께 주문하면 대화가 시작돼요"
                body="메뉴와 수령 장소를 편하게 이야기해 보세요."
              >
                <Button onClick={() => push("explore")}>
                  함께할 배프 찾기
                </Button>
              </Empty>
            ))}
          {route.view === "profile" && (
            <div className="bv-page bv-profile">
              <div className="bv-profile-heading">
                <div>
                  <span className="bv-eyebrow">나의 배프</span>
                  <h1>
                    {model.nickname}님,
                    <br />
                    오늘도 반가워요.
                  </h1>
                </div>
                <button
                  aria-label="프로필 수정"
                  onClick={() => setSheet("edit-profile")}
                >
                  <Avatar name={model.nickname} size="large" />
                  <span>
                    <Icon name="edit" size={14} />
                  </span>
                </button>
              </div>
              <div className="bv-reputation-strip">
                <span>
                  <b>
                    4.9<span>★</span>
                  </b>
                  <small>평균 별점</small>
                </span>
                <span>
                  <b>
                    8<small>회</small>
                  </b>
                  <small>함께한 주문</small>
                </span>
                <span>
                  <b>
                    6<small>개</small>
                  </b>
                  <small>받은 후기</small>
                </span>
              </div>
              <button
                className="bv-points-card"
                onClick={() => setSheet("shop")}
              >
                <span>
                  <small>차곡차곡 모은 포인트</small>
                  <b>
                    {model.points.toLocaleString()}
                    <small>P</small>
                  </b>
                  <span>함께 걷고, 작은 즐거움으로 바꿔요.</span>
                </span>
                <span className="bv-point-symbol">P</span>
                <span className="bv-shop-link">
                  상점 보기
                  <Icon name="arrow" size={16} />
                </span>
              </button>
              <div className="bv-profile-links">
                <button onClick={() => setSheet("saved")}>
                  <Icon name="heart" />
                  <span>저장한 모집</span>
                  <b>{model.saved.length}</b>
                  <Icon name="chevron" size={17} />
                </button>
                <button
                  onClick={() => {
                    if (!model.vouchers.length) {
                      notify("포인트 상점에서 마음에 드는 교환권을 골라보세요.")
                      setSheet("shop")
                    } else {
                      setVoucher(model.vouchers[model.vouchers.length - 1])
                      setSheet("voucher")
                    }
                  }}
                >
                  <Icon name="wallet" />
                  <span>내 교환권</span>
                  <b>{model.vouchers.length}</b>
                  <Icon name="chevron" size={17} />
                </button>
                <button onClick={() => setSheet("preferences")}>
                  <Icon name="bell" />
                  <span>메뉴 알림 설정</span>
                  <Icon name="chevron" size={17} />
                </button>
                <button onClick={() => setSheet("theme")}>
                  <Icon name="settings" />
                  <span>화면 설정</span>
                  <b>{model.theme === "light" ? "라이트" : "다크"}</b>
                  <Icon name="chevron" size={17} />
                </button>
              </div>
              <SectionTitle
                title="배프들이 남긴 후기"
                aside={<span>6개</span>}
              />
              {reviews.slice(0, 2).map((r) => (
                <div className="bv-profile-review" key={r.name}>
                  <div>
                    <Avatar name={r.name} size="small" tone={2} />
                    <b>{r.name}</b>
                    <span className="bv-star">★★★★★</span>
                  </div>
                  <p>{r.text}</p>
                </div>
              ))}
              <a className="bv-mobile-original" href="/">
                기존 배프 보기 →
              </a>
            </div>
          )}
        </main>
        {mainView && (
          <nav className="bv-bottom-nav" aria-label="하단 메뉴">
            {nav.map(([view, label, icon]) => (
              <button
                key={view}
                aria-current={route.view === view ? "page" : undefined}
                onClick={() => push(view)}
              >
                <span>
                  <Icon name={icon} size={23} />
                  {view === "order" && active && <i />}
                </span>
                <small>{label}</small>
              </button>
            ))}
          </nav>
        )}
      </div>
      {toast && (
        <div className="bv-toast" role="status">
          <Icon name="check" size={18} />
          <span>{toast}</span>
          <button aria-label="안내 닫기" onClick={() => setToast("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {sheet === "location" && (
        <LocationSheet
          location={model.location}
          close={() => setSheet(null)}
          save={(location) => {
            setModel((m) => ({ ...m, location }))
            setSheet(null)
            notify("출발 위치를 저장했어요.")
          }}
        />
      )}
      {sheet === "map" && (
        <MapSheet
          order={route.view === "detail" ? null : order}
          room={route.view === "detail" ? room : (order?.room ?? room)}
          close={() => setSheet(null)}
        />
      )}
      {sheet === "profile" && (
        <PersonSheet name={other} close={() => setSheet(null)} />
      )}
      {sheet === "applicant" && order && (
        <PersonSheet
          applicant
          name="지우"
          close={() => setSheet(null)}
          accept={() => {
            patch({ applicant: "accepted" })
            setSheet(null)
            notify("지우님과 함께 주문해요. 수령 장소와 계좌를 확인해 주세요.")
          }}
          reject={() => {
            patch({ applicant: "rejected" })
            setSheet(null)
            notify("참가 신청을 거절했어요. 다른 배프를 기다릴게요.")
          }}
        />
      )}
      {sheet === "account" && order && (
        <AccountSheet
          order={order}
          nickname={model.nickname}
          close={() => setSheet(null)}
          save={(data) => {
            patch(data)
            setSheet(null)
            notify("송금받을 계좌를 저장했어요.")
          }}
        />
      )}
      {sheet === "pickup" && order && (
        <PickupSheet
          order={order}
          close={() => setSheet(null)}
          save={(pickup: Pickup, place: string, time: string) => {
            const id = order.id
            patch({ pickupPending: true })
            setSheet(null)
            notify("수령 방법을 제안했어요. 상대 확인을 기다려 주세요.")
            if (proposalTimer.current) clearTimeout(proposalTimer.current)
            proposalTimer.current = setTimeout(() => {
              setModel((m) =>
                m.order?.id !== id
                  ? m
                  : {
                      ...m,
                      order: {
                        ...m.order,
                        pickup,
                        place,
                        time,
                        pickupPending: false,
                      },
                      notices: [
                        notice(
                          "상대가 수령 제안에 동의했어요",
                          `${place} · ${time}`,
                        ),
                        ...m.notices,
                      ],
                      messages: [
                        ...m.messages,
                        {
                          id: ++sequence.current,
                          mine: false,
                          body: `수령 장소를 ${place}, ${time}로 확인했어요. 이 방식으로 받을게요!`,
                          time: clock(),
                        },
                      ],
                    },
              )
              notify("상대가 수령 제안에 동의했어요.")
            }, 1800)
          }}
        />
      )}
      {sheet === "review" && order && (
        <ReviewSheet
          name={other}
          close={() => setSheet(null)}
          save={() => {
            patch({ reviewed: true })
            setSheet(null)
            notify("후기를 남겼어요. 다음에도 좋은 배프와 함께해요.")
          }}
        />
      )}
      {sheet === "shop" && (
        <ShopSheet
          points={model.points}
          close={() => setSheet(null)}
          buy={(id) => {
            const p = products.find((p) => p.id === id)!
            if (model.points < p.price) return
            setModel((m) => ({
              ...m,
              points: m.points - p.price,
              vouchers: [...m.vouchers, id],
            }))
            setVoucher(id)
            setSheet("voucher")
            notify("내 교환권에 담았어요.")
          }}
        />
      )}
      {sheet === "voucher" && (
        <VoucherSheet id={voucher} close={() => setSheet(null)} />
      )}
      {sheet === "preferences" && (
        <PreferencesSheet
          close={() => setSheet(null)}
          save={(preference) => {
            setModel((m) => ({
              ...m,
              preference,
              notices: [
                notice(
                  "같은 메뉴를 고른 배프가 있어요",
                  `${preference.join("·")} 메뉴를 기다리는 배프와 함께 주문해 보세요.`,
                  "explore",
                ),
                ...m.notices,
              ],
            }))
            setSheet(null)
            notify("조건이 맞는 배프가 생기면 알려드릴게요.")
          }}
        />
      )}
      {sheet === "edit-profile" && (
        <EditProfile
          nickname={model.nickname}
          close={() => setSheet(null)}
          save={(nickname) => {
            setModel((m) => ({ ...m, nickname }))
            setSheet(null)
            notify("프로필을 저장했어요.")
          }}
        />
      )}
      {sheet === "theme" && (
        <Modal title="화면 설정" close={() => setSheet(null)}>
          <p className="bv-muted">눈에 편한 화면을 선택해 주세요.</p>
          <div className="bv-theme-options">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={model.theme === t}
                onClick={() => setModel((m) => ({ ...m, theme: t }))}
              >
                <span className={`bv-theme-preview ${t}`}>
                  <i />
                  <i />
                  <i />
                </span>
                <b>{t === "light" ? "라이트" : "다크"}</b>
                {model.theme === t && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {sheet === "alerts" && (
        <Modal title="알림" close={() => setSheet(null)}>
          <div className="bv-alert-heading">
            <span>새 알림 {unread}개</span>
            <button
              className="bv-text-button"
              onClick={() =>
                setModel((m) => ({
                  ...m,
                  notices: m.notices.map((n) => ({ ...n, read: true })),
                }))
              }
            >
              모두 읽기
            </button>
          </div>
          {model.notices.length ? (
            model.notices.map((n) => (
              <button
                key={n.id}
                className={`bv-notice ${n.read ? "" : "unread"}`}
                onClick={() => {
                  setModel((m) => ({
                    ...m,
                    notices: m.notices.map((v) =>
                      v.id === n.id ? { ...v, read: true } : v,
                    ),
                  }))
                  push(n.target)
                }}
              >
                <span className="bv-notice-icon">
                  <Icon name="bell" size={18} />
                </span>
                <span>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  <small>{n.time}</small>
                </span>
                {!n.read && <i />}
              </button>
            ))
          ) : (
            <Empty
              title="새 소식이 오면 알려드릴게요"
              body="참가 수락과 수령 장소 변경 등을 여기서 확인할 수 있어요."
            />
          )}
        </Modal>
      )}
      {sheet === "saved" && (
        <Modal title="저장한 모집" close={() => setSheet(null)}>
          {model.saved.length ? (
            rooms
              .filter((r) => model.saved.includes(r.id))
              .map((r) => (
                <button
                  className="bv-saved-room"
                  key={r.id}
                  onClick={() => push("detail", { room: r.id })}
                >
                  <Avatar name={r.leader} tone={1} />
                  <span>
                    <b>{r.title}</b>
                    <small>{storeById(r.storeId).short}</small>
                  </span>
                  <Icon name="chevron" size={18} />
                </button>
              ))
          ) : (
            <Empty
              title="마음에 드는 모집을 모아보세요"
              body="모집의 하트 버튼을 누르면 여기서 다시 볼 수 있어요."
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function EditProfile({
  nickname,
  close,
  save,
}: {
  nickname: string
  close: () => void
  save: (name: string) => void
}) {
  const [name, setName] = useState(nickname)
  return (
    <Modal
      title="프로필 수정"
      close={close}
      footer={
        <Button
          disabled={name.trim().length < 2}
          onClick={() => save(name.trim())}
        >
          프로필 저장
        </Button>
      }
    >
      <div className="bv-profile-edit-avatar">
        <Avatar name={name || nickname} size="large" />
      </div>
      <label className="bv-field">
        닉네임
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={20}
        />
      </label>
      <p className="bv-muted">함께 주문하는 배프에게 보여줄 이름이에요.</p>
    </Modal>
  )
}
