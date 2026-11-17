import { useEffect, useRef, useState, type FormEvent } from "react"

import {
  amount,
  companionItems,
  itemText,
  menuPhoto,
  ownFee,
  pickupClock,
  storeById,
  subtotal,
  type Item,
  type Message,
  type Order,
  type Room,
  type Store,
} from "./data"

import Icon from "./icons"

import {
  AmountInput,
  Avatar,
  Brand,
  Button,
  CampusMap,
  Empty,
  SectionTitle,
  Tag,
  Topbar,
} from "./ui"

export type OrderTool = "pickup" | "account" | "profile" | "map" | "applicant"

export function Menus({
  store,
  initial,
  back,
  purpose,
  fee,
  done,
}: {
  store: Store
  initial: Item[]
  back: () => void
  purpose: "join" | "create" | "edit"
  fee: number
  done: (items: Item[]) => void
}) {
  const [items, setItems] = useState(initial),
    [temps, setTemps] = useState<Record<number, "ICE" | "HOT">>({})

  const change = (
    menuId: number,
    temperature: Item["temperature"],
    delta: number,
  ) =>
    setItems((values) => {
      const current = values.find(
          (i) => i.menuId === menuId && i.temperature === temperature,
        ),
        total = values
          .filter((i) => i.menuId === menuId)
          .reduce((n, i) => n + i.quantity, 0)

      if (delta > 0 && total >= 10) return values

      const quantity = Math.max(0, (current?.quantity ?? 0) + delta)

      return [
        ...values.filter((i) => i !== current),
        ...(quantity ? [{ menuId, temperature, quantity }] : []),
      ]
    })

  const count = items.reduce((n, i) => n + i.quantity, 0),
    food = subtotal(store, items),
    groups =
      store.category === "coffee"
        ? [
            { title: "커피와 음료", menus: store.menus.filter((m) => m.drink) },
            {
              title: "다른 메뉴도 함께",
              menus: store.menus.filter((m) => !m.drink),
            },
          ]
        : [{ title: "메뉴", menus: store.menus }]

  return (
    <div className="bv-route">
      <Topbar
        title={purpose === "edit" ? "내 메뉴 수정" : "내 메뉴 담기"}
        back={back}
      />
      <div className="bv-route-body bv-padded">
        <div className="bv-menu-store">
          <Brand store={store} />
          <div>
            <span className="bv-eyebrow">
              {purpose === "create" ? "2 / 3 · 메뉴 선택" : "먹고 싶은 만큼만"}
            </span>
            <h1>{store.short}</h1>
            <p>
              {purpose === "edit"
                ? "저장할 메뉴와 수량을 확인해 주세요."
                : "내 메뉴를 고르면 다음 단계로 이어져요."}
            </p>
          </div>
        </div>
        {groups
          .filter((g) => g.menus.length)
          .map((group) => (
            <section className="bv-menu-group" key={group.title}>
              <SectionTitle title={group.title} />
              {group.menus.map((menu) => {
                const temperature = menu.drink
                    ? (temps[menu.id] ??
                      (menu.temperatures.includes("ICE")
                        ? "ICE"
                        : menu.temperatures[0]))
                    : "",
                  selected =
                    items.find(
                      (i) =>
                        i.menuId === menu.id && i.temperature === temperature,
                    )?.quantity ?? 0,
                  all = items
                    .filter((i) => i.menuId === menu.id)
                    .reduce((n, i) => n + i.quantity, 0)

                return (
                  <article
                    className={`bv-menu-row ${all ? "chosen" : ""}`}
                    key={menu.id}
                  >
                    {menu.photo && (
                      <img
                        src={menuPhoto(store, menu, temperature)}
                        alt={menu.name}
                        loading="lazy"
                      />
                    )}
                    <div className="bv-menu-info">
                      <h3>{menu.name}</h3>
                      <b>{amount(menu.price)}</b>
                      {menu.drink && (
                        <div
                          className="bv-temperature"
                          aria-label={`${menu.name} 온도`}
                        >
                          {menu.temperatures.map((t) => (
                            <button
                              key={t}
                              type="button"
                              aria-pressed={temperature === t}
                              onClick={() =>
                                setTemps((v) => ({ ...v, [menu.id]: t }))
                              }
                            >
                              {t}
                              {items.some(
                                (i) =>
                                  i.menuId === menu.id && i.temperature === t,
                              ) && (
                                <span>
                                  {" "}
                                  ·{" "}
                                  {
                                    items.find(
                                      (i) =>
                                        i.menuId === menu.id &&
                                        i.temperature === t,
                                    )!.quantity
                                  }
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div
                      className={`bv-quantity ${selected ? "has-value" : ""}`}
                    >
                      <button
                        aria-label={`${menu.name} ${temperature} 빼기`}
                        disabled={!selected}
                        onClick={() => change(menu.id, temperature, -1)}
                      >
                        <Icon name="minus" size={16} />
                      </button>
                      <span aria-live="polite">{selected}</span>
                      <button
                        aria-label={`${menu.name} ${temperature} 추가`}
                        disabled={all >= 10}
                        onClick={() => change(menu.id, temperature, 1)}
                      >
                        <Icon name="plus" size={16} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>
          ))}
      </div>
      <footer className="bv-action-footer bv-menu-footer">
        <div className="bv-menu-bill">
          <span>
            메뉴 {count}개 <b>{amount(food)}</b>
          </span>
          <small>예상 배달비 {amount(fee)}</small>
        </div>
        <Button disabled={!count} onClick={() => done(items)}>
          {!count
            ? "메뉴를 하나 이상 담아 주세요"
            : purpose === "edit"
              ? "내 메뉴 저장"
              : purpose === "create"
                ? "모집 조건 확인"
                : "이 메뉴로 참가 신청"}
          {count > 0 && <strong>{amount(food + fee)}</strong>}
        </Button>
      </footer>
    </div>
  )
}

export function CreateRoom({
  store,
  items,
  back,
  create,
}: {
  store: Store
  items: Item[]
  back: () => void
  create: (data: {
    max: number
    goal: number
    fee: number
    time: string
    place: string
    note: string
    deadline: number
  }) => void
}) {
  const [max, setMax] = useState(2),
    [deadline, setDeadline] = useState(15),
    [goal, setGoal] = useState(store.goal),
    [fee, setFee] = useState(3000),
    [time, setTime] = useState(pickupClock()),
    [place, setPlace] = useState("충남대 정문 앞 벤치"),
    [note, setNote] = useState("")

  return (
    <div className="bv-route">
      <Topbar title="모집 조건 확인" back={back} />
      <div className="bv-route-body bv-padded">
        <div className="bv-entry-steps">
          <span>1 가게 선택</span>
          <span>2 메뉴 담기</span>
          <b>3 모집 등록</b>
        </div>
        <h1 className="bv-screen-heading">
          함께할 배프를
          <br />
          모아볼까요?
        </h1>
        <div className="bv-selected-meal">
          <Brand store={store} />
          <div>
            <b>{store.short}</b>
            <p>
              {items
                .map((i) => `${itemText(store, i)} ${i.quantity}개`)
                .join(" · ")}
            </p>
          </div>
          <strong>{amount(subtotal(store, items))}</strong>
        </div>
        <section className="bv-form-section">
          <h2>몇 명이 함께할까요?</h2>
          <p>나를 포함한 인원이에요.</p>
          <div className="bv-member-choices">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-pressed={max === n}
                onClick={() => setMax(n)}
              >
                {n}명{n === 2 && <small>가볍게</small>}
              </button>
            ))}
          </div>
        </section>
        <section className="bv-form-section">
          <h2>언제, 어디서 받을까요?</h2>
          <div className="bv-two-fields">
            <label>
              희망 수령 시간
              <input
                aria-label="희망 수령 시간"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
            <label>
              모집 마감
              <select
                value={deadline}
                onChange={(e) => setDeadline(Number(e.target.value))}
              >
                <option value="15">15분 뒤</option>
                <option value="30">30분 뒤</option>
                <option value="45">45분 뒤</option>
              </select>
            </label>
          </div>
          <label className="bv-field">
            공개 수령 장소
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={80}
              placeholder="예: 정문 앞 벤치"
            />
          </label>
        </section>
        <section className="bv-form-section">
          <AmountInput
            label="목표 주문금액"
            value={goal}
            onChange={setGoal}
            min={1000}
          />
        </section>
        <details className="bv-optional">
          <summary>
            배달비·전달사항 설정
            <Icon name="down" size={16} />
          </summary>
          <AmountInput label="총 배달비" value={fee} onChange={setFee} />
          <label className="bv-field">
            함께할 배프에게
            <textarea
              placeholder="수령 장소 등 미리 알려줄 내용을 적어 주세요."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          </label>
        </details>
        <div className="bv-create-summary">
          <Icon name="users" />
          <p>
            <b>
              {max}명이 모이면 배달비 약 {amount(Math.ceil(fee / max))}씩
            </b>
            <span>리더가 참가 신청을 확인하고 주문을 진행해요.</span>
          </p>
        </div>
      </div>
      <footer className="bv-action-footer">
        <Button
          disabled={!place.trim() || !time || !items.length}
          onClick={() =>
            create({ max, goal, fee, time, place, note, deadline })
          }
        >
          이 조건으로 모집 시작
          <Icon name="arrow" size={19} />
        </Button>
      </footer>
    </div>
  )
}

function Progress({ order }: { order: Order }) {
  const current =
    order.phase === "pending"
      ? 0
      : order.phase === "menu"
        ? 0
        : order.phase === "payment"
          ? 1
          : order.phase === "delivery"
            ? 2
            : order.phase === "receipt"
              ? 3
              : 4
  return (
    <ol className="bv-order-progress" aria-label="주문 진행 단계">
      {["메뉴", "송금", "배달", "수령", "완료"].map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          data-done={i < current}
        >
          <i>{i < current ? <Icon name="check" size={12} /> : i + 1}</i>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}

export function OrderView({
  order,
  nickname,
  back,
  chat,
  tool,
  edit,
  update,
  notify,
  finish,
  onRate,
}: {
  order: Order
  nickname: string
  back: () => void
  chat: () => void
  tool: (t: OrderTool) => void
  edit: () => void
  update: (data: Partial<Order>) => void
  notify: (s: string) => void
  finish: () => void
  onRate: () => void
}) {
  const store = storeById(order.room.storeId),
    food = subtotal(store, order.items),
    fee = ownFee(order),
    otherFood = subtotal(
      store,
      companionItems(store, order.items, order.room.goal ?? store.goal),
    ),
    owner = order.role === "leader",
    other = owner ? "지우" : order.room.leader

  let heading = "",
    description = "",
    action = "",
    disabled = false,
    execute = () => {}

  if (order.phase === "pending") {
    heading = "리더가 신청을 확인하고 있어요"
    description = "수락되면 이 화면에서 주문을 이어갈 수 있어요."
  }

  if (order.phase === "menu" && owner) {
    heading =
      order.applicant !== "accepted"
        ? "함께 주문할 배프를 기다려요"
        : !order.account
          ? "송금받을 계좌를 등록해 주세요"
          : "주문할 준비를 마쳤어요"

    description =
      order.applicant !== "accepted"
        ? "신청이 오면 상대의 프로필을 보고 수락해 주세요."
        : !order.account
          ? "계좌는 이 모임의 참가자에게만 보여요."
          : "메뉴와 수령 장소를 확인하고 주문을 확정해 주세요."

    action =
      order.applicant !== "accepted"
        ? "참가 신청 확인"
        : !order.account
          ? "리더 계좌 등록"
          : "주문 확정하고 송금으로"

    disabled = order.applicant === "waiting"
    if (order.applicant === "rejected") {
      action = "다른 배프 기다리기"
      execute = () => update({ applicant: "waiting" })
    }

    execute = () =>
      order.applicant === "rejected"
        ? update({ applicant: "waiting" })
        : order.applicant !== "accepted"
          ? tool("applicant")
          : !order.account
            ? tool("account")
            : update({ phase: "payment" })
  }

  if (order.phase === "menu" && !owner) {
    heading = "내 메뉴와 수령 장소를 확인해 주세요"
    description = "준비가 끝나면 리더가 확정한 송금 금액을 확인할 수 있어요."
    action = "확인하고 송금 금액 보기"
    execute = () => update({ phase: "payment" })
  }

  if (order.phase === "menu" && order.pickupPending) {
    description =
      "상대가 수령 제안을 확인하고 있어요. 동의하면 다음 단계로 이어갈 수 있어요."
    action = "수령 제안 확인 대기"
    disabled = true
  }

  if (order.phase === "payment") {
    heading = owner
      ? !order.leaderReady
        ? "내 결제 준비를 확인해 주세요"
        : !order.confirmed
          ? "참가자 입금을 확인해 주세요"
          : "모두 준비됐어요. 주문해 주세요"
      : order.claimed
        ? "리더가 입금을 확인하고 있어요"
        : "내 금액을 리더에게 보내 주세요"

    description = owner
      ? "배달앱에서 주문을 마친 뒤 주문 완료를 알려 주세요."
      : order.claimed
        ? "입금 확인과 주문이 끝나면 배달 상태로 이어져요."
        : "계좌와 금액을 확인한 뒤 송금 완료를 눌러 주세요."

    action = owner
      ? !order.leaderReady
        ? "내 결제 준비 완료"
        : !order.confirmed
          ? order.claimed
            ? "참가자 입금 확인"
            : "참가자 송금 대기"
          : "배달앱 주문 완료"
      : order.claimed
        ? "리더 입금 확인 대기"
        : "송금했어요"

    disabled = owner ? order.leaderReady && !order.claimed : order.claimed

    execute = () => {
      if (!owner) {
        update({ claimed: true })
        notify("송금 완료를 리더에게 알렸어요.")
      } else if (!order.leaderReady) update({ leaderReady: true })
      else if (!order.confirmed) {
        update({ confirmed: true })
        notify("참가자의 입금을 확인했어요.")
      } else update({ phase: "delivery" })
    }
  }

  if (order.phase === "delivery") {
    heading = owner
      ? "음식이 도착하면 알려 주세요"
      : "주문을 마쳤어요. 배달을 기다려요"
    description =
      order.pickup === "contactless"
        ? "리더가 음식을 놓으면 사진과 알림을 확인해 주세요."
        : "받을 장소와 시간을 미리 확인해 주세요."
    action = owner ? "음식 도착 알리기" : "배달 현황 확인"
    execute = () =>
      update({
        phase: "receipt",
        dropoff: !owner && order.pickup === "contactless",
      })
  }

  if (order.phase === "receipt") {
    heading = order.received
      ? "내 수령 확인을 마쳤어요"
      : order.pickup === "contactless" && !order.dropoff
        ? "음식을 놓고 모두에게 알려 주세요"
        : "내 음식을 받았다면 확인해 주세요"
    description = order.received
      ? "다른 배프의 수령 확인을 기다리고 있어요."
      : "닉네임과 주문 메뉴를 확인하고 내 음식을 받아요."
    action = order.received
      ? "다른 배프 수령 확인 대기"
      : order.pickup === "contactless" && !order.dropoff
        ? "음식을 놓았어요 · 모두에게 알리기"
        : "내 음식 수령 완료"
    disabled = order.received
    execute = () =>
      order.pickup === "contactless" && !order.dropoff
        ? update({ dropoff: true })
        : update({ received: true })
  }

  if (order.phase === "complete") {
    heading = "함께라서 더 가벼웠던 한 끼"
    description = "모든 배프가 음식을 받았어요. 다음에도 함께해요."
    action = order.reviewed
      ? "다른 주문 둘러보기"
      : "함께한 배프에게 후기 남기기"
    execute = () => (order.reviewed ? finish() : onRate())
  }

  return (
    <div className="bv-route">
      <Topbar title="내 주문" back={back}>
        <button className="bv-text-button" onClick={chat}>
          <Icon name="chat" size={18} />
          채팅
        </button>
      </Topbar>
      <div className="bv-route-body bv-padded">
        <Progress order={order} />
        <div
          className={`bv-order-heading ${
            order.phase === "complete" ? "complete" : ""
          }`}
        >
          {order.phase === "complete" ? (
            <span className="bv-complete-check">
              <Icon name="check" size={32} />
            </span>
          ) : (
            <span className="bv-eyebrow">
              {owner ? "리더" : "참가자"} · {store.short}
            </span>
          )}
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {order.phase === "pending" && (
          <div className="bv-pending-state">
            <div className="bv-wait-dots">
              <i />
              <i />
              <i />
            </div>
            <Avatar name={order.room.leader} tone={1} />
            <b>{order.room.leader}님에게 신청을 보냈어요</b>
            <p>내 메뉴와 프로필이 전달됐어요.</p>
            <Button secondary onClick={back}>
              주변 주문 계속 둘러보기
            </Button>
          </div>
        )}
        {order.phase === "menu" && order.applicant === "pending" && (
          <button
            className="bv-applicant-banner"
            onClick={() => tool("applicant")}
          >
            <Avatar name="지우" tone={2} />
            <span>
              <b>지우님이 참가를 신청했어요</b>
              <small>★ 4.9 · 함께 주문 12회</small>
            </span>
            <span className="bv-inline-action">신청 확인 →</span>
          </button>
        )}
        {order.phase !== "pending" && order.phase !== "complete" && (
          <>
            {order.phase === "payment" ? (
              <>
                <section className="bv-payment-total">
                  <span>
                    {owner ? "내가 부담할 금액" : "리더에게 보낼 금액"}
                  </span>
                  <strong>{amount(food + fee)}</strong>
                  <p>
                    메뉴 {amount(food)} + 배달비 {amount(fee)}
                  </p>
                  {order.claimed && !owner && (
                    <Tag green>송금 완료 · 입금 확인 대기</Tag>
                  )}
                </section>
                <section className="bv-bank-card">
                  <div>
                    <span className="bv-bank-mark">
                      {order.bank.slice(0, 1) || "카"}
                    </span>
                    <span>
                      <b>{order.bank || "카카오뱅크"}</b>
                      <small>{order.holder || order.room.leader}</small>
                    </span>
                    <Tag green>리더 계좌</Tag>
                  </div>
                  <p>{order.account || "3333-01-4826190"}</p>
                  <button
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(order.account || "3333-01-4826190")
                        .then(() => notify("계좌번호를 복사했어요."))
                        .catch(() =>
                          notify("계좌번호를 길게 눌러 복사해 주세요."),
                        )
                    }}
                  >
                    <Icon name="copy" size={16} />
                    계좌번호 복사
                  </button>
                </section>
                {owner && (
                  <div className="bv-transfer-person">
                    <Avatar name={other} tone={2} />
                    <span>
                      <b>{other}</b>
                      <small>
                        {amount(
                          otherFood + (order.pickup === "nearby" ? 0 : fee),
                        )}
                      </small>
                    </span>
                    <Tag green={order.confirmed}>
                      {order.confirmed
                        ? "입금 확인"
                        : order.claimed
                          ? "송금 표시됨"
                          : "송금 대기"}
                    </Tag>
                  </div>
                )}
              </>
            ) : null}
            {order.phase === "delivery" && (
              <div className="bv-delivery-card">
                <div className="bv-delivery-illustration">
                  <Icon name="bag" size={54} />
                  <span>
                    <Icon name="check" size={18} />
                  </span>
                </div>
                <b>기다림은 조금, 맛있는 한 끼는 곧.</b>
                <p>수령 약속 {order.time}</p>
                <div className="bv-delivery-track">
                  <span className="done">주문 완료</span>
                  <i />
                  <span className="active">음식 준비·배달</span>
                  <i />
                  <span>도착</span>
                </div>
              </div>
            )}
            {order.phase === "receipt" && order.pickup === "contactless" && (
              <section className="bv-contactless-info">
                <Tag green>
                  {order.dropoff ? "음식 놓기 알림 도착" : "비대면 수령"}
                </Tag>
                <h2>
                  {order.dropoff
                    ? "약속한 장소에서 찾아가 주세요"
                    : "음식에 닉네임을 표시해 주세요"}
                </h2>
                <CampusMap place={order.place} />
                <p>{order.place} · 봉투에 적힌 닉네임을 확인해 주세요.</p>
                {owner && !order.dropoff && (
                  <label className="bv-photo-upload">
                    <Icon name="camera" size={20} />
                    {order.photo
                      ? "수령 사진 선택 완료"
                      : "수령 장소 사진 추가"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 8 * 1024 * 1024) {
                          notify("8MB 이하의 사진을 선택해 주세요.")
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () =>
                          update({ photo: String(reader.result) })
                        reader.readAsDataURL(file)
                      }}
                    />
                  </label>
                )}
                {order.photo && (
                  <img
                    className="bv-dropoff-photo"
                    src={order.photo}
                    alt="음식을 놓은 장소"
                  />
                )}
              </section>
            )}
            {(order.phase === "menu" || order.phase === "receipt") && (
              <section className="bv-order-meal">
                <SectionTitle
                  title={
                    order.phase === "menu" ? "내 주문 메뉴" : "내가 받을 메뉴"
                  }
                  aside={
                    order.phase === "menu" ? (
                      <button className="bv-text-button" onClick={edit}>
                        수정
                        <Icon name="edit" size={14} />
                      </button>
                    ) : undefined
                  }
                />
                {order.items.map((item) => {
                  const m = store.menus.find((m) => m.id === item.menuId)!
                  return (
                    <div
                      className="bv-order-meal-row"
                      key={`${item.menuId}:${item.temperature}`}
                    >
                      {m.photo && (
                        <img
                          src={menuPhoto(store, m, item.temperature)}
                          alt={m.name}
                        />
                      )}
                      <div>
                        <b>{itemText(store, item)}</b>
                        <small>{item.quantity}개</small>
                      </div>
                      <strong>{amount(m.price * item.quantity)}</strong>
                    </div>
                  )
                })}
              </section>
            )}
            <section className="bv-order-pickup">
              <SectionTitle
                title="수령 장소와 시간"
                aside={
                  order.phase === "menu" ? (
                    <button
                      className="bv-text-button"
                      onClick={() => tool("pickup")}
                    >
                      변경
                    </button>
                  ) : undefined
                }
              />
              <button className="bv-pickup-summary" onClick={() => tool("map")}>
                <span className="bv-round-icon">
                  <Icon name="pin" />
                </span>
                <span>
                  <b>{order.place}</b>
                  <small>
                    {order.time} ·{" "}
                    {order.pickup === "nearby"
                      ? "내 이동 0m"
                      : `도보 약 ${order.room.minutes}분`}
                  </small>
                </span>
                <Icon name="chevron" size={17} />
              </button>
              <span className="bv-pickup-mode-label">
                <Icon
                  name={order.pickup === "contactless" ? "bag" : "users"}
                  size={15}
                />
                {order.pickup === "contactless"
                  ? "지정 장소에서 비대면 수령"
                  : order.pickup === "nearby"
                    ? "내 근처에서 받기 · 내가 배달비 부담"
                    : "직접 만나서 받기"}
              </span>
            </section>
            {order.phase === "menu" && owner && (
              <button
                className="bv-account-row"
                onClick={() => tool("account")}
              >
                <Icon name="wallet" size={23} />
                <span>
                  <b>송금받을 계좌</b>
                  <small>
                    {order.account
                      ? `${order.bank} · ${order.holder}`
                      : "아직 등록하지 않았어요"}
                  </small>
                </span>
                {order.account ? (
                  <Icon name="check" size={19} />
                ) : (
                  <span className="bv-inline-action">등록하기 →</span>
                )}
              </button>
            )}
            {order.phase === "receipt" && (
              <div className="bv-receipt-people">
                <SectionTitle
                  title="함께 수령 확인"
                  aside={
                    <span>
                      {Number(order.received) + Number(order.companionReceived)}{" "}
                      / 2명
                    </span>
                  }
                />
                {[
                  { name: nickname, received: order.received },
                  { name: other, received: order.companionReceived },
                ].map((p, i) => (
                  <div key={i}>
                    <Avatar name={p.name} size="small" tone={i} />
                    <span>
                      {p.name}
                      {i === 0 && " (나)"}
                    </span>
                    <b className={p.received ? "done" : ""}>
                      {p.received ? "수령 완료" : "수령 대기"}
                      {p.received && <Icon name="check" size={15} />}
                    </b>
                  </div>
                ))}
              </div>
            )}
            {order.phase !== "receipt" && (
              <button
                className="bv-companion-row"
                onClick={() => tool("profile")}
              >
                <span className="bv-avatar-pair">
                  <Avatar name={nickname} size="small" />
                  <Avatar name={other} size="small" tone={1} />
                </span>
                <span>
                  {owner ? "나와 함께할 배프" : `${other}님과 함께 주문 중`}
                  <small>프로필·거래 후기 보기</small>
                </span>
                <Icon name="chevron" size={17} />
              </button>
            )}
          </>
        )}
        {order.phase === "complete" && (
          <>
            <div className="bv-complete-receipt">
              <Brand store={store} />
              <h2>{store.short}</h2>
              <p>
                {order.items
                  .map((i) => `${itemText(store, i)} ${i.quantity}개`)
                  .join(" · ")}
              </p>
              <div>
                <span>이번에 아낀 배달비</span>
                <b>
                  {amount(order.pickup === "nearby" ? 0 : order.room.fee - fee)}
                </b>
              </div>
              <div>
                <span>수령 이동</span>
                <b>
                  {order.pickup === "nearby" ? "0m" : `${order.room.distance}m`}
                </b>
              </div>
              <div className="bv-points-earned">
                <span>함께 걸은 만큼 포인트도</span>
                <b>
                  +
                  {20 +
                    Math.floor(
                      (order.pickup === "nearby" ? 0 : order.room.distance) / 5,
                    )}{" "}
                  P
                </b>
              </div>
            </div>
            <button
              className="bv-companion-row"
              onClick={() => tool("profile")}
            >
              <Avatar name={other} tone={1} />
              <span>
                함께한 {other}님<small>덕분에 가볍게 주문했어요</small>
              </span>
              <Icon name="chevron" size={17} />
            </button>
          </>
        )}
        {order.phase === "menu" && (
          <p className="bv-bottom-hint">
            {owner ? "현재 2명이 주문하면 배달비는 " : "내 예상 배달비는 "}
            {amount(fee)}이에요.{" "}
            {order.pickupPending
              ? "수령 제안에 대한 상대의 동의를 기다리고 있어요."
              : "메뉴와 수령 방법을 확인한 뒤 진행해 주세요."}
          </p>
        )}
      </div>
      {action && (
        <footer className="bv-action-footer">
          <Button disabled={disabled} onClick={execute}>
            {action}
            {!disabled && <Icon name="arrow" size={18} />}
          </Button>
        </footer>
      )}
    </div>
  )
}

export function ChatView({
  order,
  messages,
  nickname,
  back,
  openOrder,
  send,
  openPickup,
}: {
  order: Order
  messages: Message[]
  nickname: string
  back: () => void
  openOrder: () => void
  send: (text: string) => void
  openPickup: () => void
}) {
  const [draft, setDraft] = useState(""),
    [unread, setUnread] = useState(false),
    list = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true)

  const other = order.role === "leader" ? "지우" : order.room.leader

  useEffect(() => {
    if (nearBottom.current) {
      list.current?.scrollTo({ top: list.current.scrollHeight })
      setUnread(false)
    } else setUnread(true)
  }, [messages.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    nearBottom.current = true
    send(draft.trim())
    setDraft("")
  }

  return (
    <div className="bv-chat">
      <Topbar title={storeById(order.room.storeId).short} back={back}>
        <button className="bv-text-button" onClick={openOrder}>
          주문 보기
          <Icon name="chevron" size={16} />
        </button>
      </Topbar>
      <button className="bv-chat-pickup" onClick={openPickup}>
        <Icon name="pin" size={19} />
        <span>
          <b>{order.place}</b>
          <small>
            {order.time} ·{" "}
            {order.pickup === "contactless" ? "비대면 수령" : "함께 수령"}
          </small>
        </span>
        <Icon name="chevron" size={17} />
      </button>
      <div
        className="bv-chat-messages"
        ref={list}
        onScroll={() => {
          const el = list.current
          if (el) {
            nearBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 70
            if (nearBottom.current) setUnread(false)
          }
        }}
      >
        <span className="bv-chat-date">오늘</span>
        {messages.map((m) =>
          m.system ? (
            <p className="bv-chat-system" key={m.id}>
              {m.body}
            </p>
          ) : (
            <div className={`bv-message ${m.mine ? "mine" : ""}`} key={m.id}>
              {!m.mine && <Avatar name={other} size="small" tone={1} />}
              <div>
                {!m.mine && <b>{other}</b>}
                <p>{m.body}</p>
              </div>
              <small>{m.time}</small>
            </div>
          ),
        )}
        <p className="bv-chat-system">{nickname}님과 함께하는 주문이에요.</p>
      </div>
      {unread && (
        <button
          className="bv-new-message"
          onClick={() => {
            nearBottom.current = true
            list.current?.scrollTo({
              top: list.current.scrollHeight,
              behavior: "smooth",
            })
            setUnread(false)
          }}
        >
          새 메시지 ↓
        </button>
      )}
      <form className="bv-chat-composer" onSubmit={submit}>
        <button
          type="button"
          className="bv-icon"
          aria-label="수령 장소 확인"
          onClick={openPickup}
        >
          <Icon name="pin" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="메시지를 입력해 주세요"
          aria-label="채팅 메시지"
          maxLength={1000}
          enterKeyHint="send"
        />
        <button
          className="bv-send"
          type="submit"
          disabled={!draft.trim()}
          aria-label="메시지 보내기"
        >
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  )
}
