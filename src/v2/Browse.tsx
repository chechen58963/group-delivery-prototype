import { useState } from "react"

import {
  amount,
  rooms,
  stores,
  storeById,
  type Category,
  type Room,
  type Store,
} from "./data"

import Icon from "./icons"

import {
  Avatar,
  Brand,
  Button,
  CampusMap,
  Empty,
  SectionTitle,
  Tag,
  Topbar,
} from "./ui"

export function Browse({
  openRoom,
  create,
  location,
  openLocation,
  active,
  openOrder,
  saved,
  toggleSaved,
}: {
  openRoom: (r: Room) => void
  create: (s?: Store) => void
  location: string
  openLocation: () => void
  active: boolean
  openOrder: () => void
  saved: string[]
  toggleSaved: (id: string) => void
}) {
  const [category, setCategory] = useState<Category>("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("추천순"),
    [map, setMap] = useState(false)

  const choices = [
    { id: "all", label: "전체", photo: "" },
    { id: "coffee", label: "커피", photo: "/images/menus/ediya-1-ice.webp" },
    { id: "burger", label: "버거", photo: "/images/menus/mom-1.webp" },
    { id: "sandwich", label: "샌드위치", photo: "/images/menus/subway-1.webp" },
  ] as const

  const found = rooms
    .filter((r) => {
      const store = storeById(r.storeId)
      return (
        (category === "all" || store.category === category) &&
        `${store.name} ${r.title} ${store.menus.map((m) => m.name).join(" ")}`.includes(
          search.trim(),
        )
      )
    })
    .sort((a, b) =>
      sort === "가까운순"
        ? a.distance - b.distance
        : sort === "마감순"
          ? a.until - b.until
          : 0,
    )

  return (
    <div className="bv-page bv-browse">
      <button className="bv-location-link" onClick={openLocation}>
        <Icon name="pin" size={17} />
        <span>{location}</span>
        <Icon name="down" size={15} />
        <small>출발 위치</small>
      </button>
      <div className="bv-home-intro">
        <div>
          <p className="bv-eyebrow">오늘도 가볍게, 함께</p>
          <h1>
            한 잔만 주문해도,
            <br />
            함께라면 가볍게.
          </h1>
          <p className="bv-home-sub">가까운 배프와 주문하고 배달비를 나눠요.</p>
        </div>
        <div className="bv-intro-art" aria-hidden="true">
          <div className="bv-art-circle" />
          <img src="/images/menus/ediya-1-ice.webp" alt="" />
          <img src="/images/menus/subway-1.webp" alt="" />
          <span>
            함께라서
            <br />
            <b>가벼운 한 끼</b>
          </span>
        </div>
      </div>
      {active && (
        <button className="bv-active-strip" onClick={openOrder}>
          <span className="bv-active-dot" />
          <span>
            <b>진행 중인 주문이 있어요</b>
            <small>다음 할 일을 확인해 주세요</small>
          </span>
          <Icon name="arrow" size={20} />
        </button>
      )}
      <div className="bv-search">
        <Icon name="search" size={21} />
        <input
          type="search"
          enterKeyHint="search"
          placeholder="가게나 먹고 싶은 메뉴 검색"
          aria-label="가게 또는 메뉴 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="bv-icon"
            aria-label="검색어 지우기"
            onClick={() => setSearch("")}
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <div className="bv-categories" aria-label="음식 종류">
        {choices.map((c) => (
          <button
            key={c.id}
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.photo ? (
              <img src={c.photo} alt="" />
            ) : (
              <span className="bv-category-all">
                <Icon name="explore" size={20} />
              </span>
            )}
            <span>{c.label}</span>
            {category === c.id && <i />}
          </button>
        ))}
      </div>
      <div className="bv-discovery-layout">
        <section className="bv-results">
          <div className="bv-list-heading">
            <div>
              <h2>
                {search
                  ? `검색 결과 ${found.length}개`
                  : "지금 함께 주문할 배프"}
                <span>{!search && found.length}</span>
              </h2>
              <p>각자 400m 안에서 만날 수 있는 주문이에요.</p>
            </div>
            <div className="bv-list-options">
              <select
                aria-label="모집 정렬"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {["추천순", "가까운순", "마감순"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <button
                className={`bv-map-toggle ${map ? "selected" : ""}`}
                aria-pressed={map}
                onClick={() => setMap(!map)}
              >
                <Icon name={map ? "receipt" : "map"} size={17} />
                {map ? "목록" : "지도"}
              </button>
            </div>
          </div>
          {map && (
            <div className="bv-browse-map">
              <CampusMap place="주변 공동배달" />
              {found.slice(0, 4).map((r, i) => (
                <button
                  key={r.id}
                  style={{
                    left: `${20 + i * 18}%`,
                    top: `${35 + (i % 2) * 25}%`,
                  }}
                  className="bv-room-pin"
                  onClick={() => openRoom(r)}
                >
                  <Brand store={storeById(r.storeId)} small />
                  <span>{amount(Math.ceil(r.fee / 2))}</span>
                </button>
              ))}
            </div>
          )}
          <div className="bv-room-grid">
            {found.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                open={() => openRoom(room)}
                saved={saved.includes(room.id)}
                save={() => toggleSaved(room.id)}
                priority={i < 2}
              />
            ))}
          </div>
          {!found.length && (
            <Empty
              title="아직 딱 맞는 주문이 없어요"
              body="다른 메뉴로 찾아보거나, 먼저 모집을 시작해 보세요."
            >
              <Button
                secondary
                onClick={() => {
                  setSearch("")
                  setCategory("all")
                }}
              >
                전체 주문 보기
              </Button>
            </Empty>
          )}
          <button className="bv-create-inline" onClick={() => create()}>
            <span className="bv-create-circle">
              <Icon name="plus" />
            </span>
            <span>
              <b>찾는 가게가 없나요?</b>
              <small>내가 먼저 함께 주문할 배프를 모아보세요</small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        </section>
        <aside className="bv-discovery-aside">
          <section className="bv-how-card">
            <span className="bv-eyebrow">배프와 주문하기</span>
            <h2>
              커피 한 잔도
              <br />
              부담 없이.
            </h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <b>먹고 싶은 메뉴 담기</b>
                  <small>근처 모집에서 내 메뉴를 골라요</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <b>배달비 나누기</b>
                  <small>주문 금액을 리더에게 보내요</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <b>가까운 곳에서 받기</b>
                  <small>약속한 장소에서 내 음식을 받아요</small>
                </div>
              </li>
            </ol>
          </section>
          <div className="bv-aside-note">
            <Icon name="leaf" size={22} />
            <p>
              조금 걷고, 함께 아끼는
              <br />
              <b>우리 동네 주문 습관.</b>
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function RoomCard({
  room,
  open,
  saved,
  save,
  priority,
}: {
  room: Room
  open: () => void
  saved: boolean
  save: () => void
  priority: boolean
}) {
  const store = storeById(room.storeId),
    image = store.menus.find((m) => m.photo)?.photo

  return (
    <article className="bv-room-card">
      <button
        className="bv-room-main"
        onClick={open}
        aria-label={`${room.title} · ${store.short}`}
      >
        <div className="bv-room-photo" style={{ background: store.tone }}>
          <img
            src={image}
            alt={store.menus[0].name}
            loading={priority ? "eager" : "lazy"}
          />
          <span className="bv-room-photo-tag">{room.until}분 뒤 마감</span>
        </div>
        <div className="bv-room-content">
          <div className="bv-room-store">
            <Brand store={store} small />
            <span>{store.short}</span>
            {room.tag && <b>{room.tag}</b>}
          </div>
          <h3>{room.title}</h3>
          <div className="bv-room-route">
            <span>
              <Icon name="walk" size={15} />
              {room.distance}m · 약 {room.minutes}분
            </span>
            <span>1 / {room.max}명</span>
          </div>
          <div className="bv-room-cost">
            <span>
              내 예상 배달비 <b>{amount(Math.ceil(room.fee / 2))}</b>
            </span>
            <span className="bv-saving">
              {amount(room.fee - Math.ceil(room.fee / 2))} 절약
            </span>
          </div>
        </div>
      </button>
      <button
        className={`bv-save ${saved ? "saved" : ""}`}
        aria-label={saved ? "모집 저장 취소" : "모집 저장"}
        aria-pressed={saved}
        onClick={save}
      >
        <Icon name="heart" size={19} />
      </button>
    </article>
  )
}

export function RoomDetail({
  room,
  back,
  join,
  profile,
  showMap,
  saved,
  toggleSaved,
}: {
  room: Room
  back: () => void
  join: () => void
  profile: () => void
  showMap: () => void
  saved: boolean
  toggleSaved: () => void
}) {
  const store = storeById(room.storeId)

  return (
    <div className="bv-route">
      <Topbar title="함께 주문" back={back}>
        <button
          className={`bv-icon ${saved ? "saved" : ""}`}
          aria-label={saved ? "모집 저장 취소" : "모집 저장"}
          onClick={toggleSaved}
        >
          <Icon name="heart" />
        </button>
      </Topbar>
      <div className="bv-route-body">
        <div className="bv-detail-hero" style={{ background: store.tone }}>
          <Brand store={store} />
          <img
            src={store.menus.find((m) => m.photo)?.photo}
            alt={store.menus[0].name}
          />
          <span className="bv-hero-caption">한 잔도, 한 끼도 함께</span>
        </div>
        <div className="bv-detail-copy">
          <div className="bv-detail-labels">
            <Tag>모집 중 · 1자리 남음</Tag>
            <span>{room.until}분 뒤 마감</span>
          </div>
          <h1>{room.title}</h1>
          <p>{store.name}</p>
          <div className="bv-benefit-box">
            <Icon name="wallet" size={25} />
            <div>
              <b>혼자 시킬 때보다 {amount(room.fee / 2)} 아껴요</b>
              <p>배달비 {amount(room.fee)}을 둘이 나눠 내요.</p>
            </div>
          </div>
          <SectionTitle title="이렇게 함께 받아요" />
          <button className="bv-pickup-summary" onClick={showMap}>
            <span className="bv-round-icon">
              <Icon name="pin" />
            </span>
            <span>
              <b>{room.place}</b>
              <small>
                내 출발점에서 {room.distance}m · 도보 약 {room.minutes}분
              </small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
          <div className="bv-detail-facts">
            <div>
              <span>예상 수령</span>
              <b>지금부터 약 35분 뒤</b>
            </div>
            <div>
              <span>주문 목표금액</span>
              <b>{amount(store.goal)}</b>
            </div>
            <div>
              <span>현재 인원</span>
              <b>리더 포함 1 / {room.max}명</b>
            </div>
          </div>
          <SectionTitle title="함께할 리더" />
          <button className="bv-leader" onClick={profile}>
            <Avatar name={room.leader} tone={1} />
            <span>
              <b>
                {room.leader}
                <span className="bv-role-chip">리더</span>
              </b>
              <small>
                <span className="bv-star">★ {room.rating}</span> · 함께 주문{" "}
                {room.trades}회
              </small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
          <p className="bv-detail-note">
            메뉴를 담아 신청하면 리더가 확인해요.
            <br />
            수락 후 주문 금액과 수령 장소를 함께 확인할 수 있어요.
          </p>
        </div>
      </div>
      <footer className="bv-action-footer">
        <div className="bv-footer-price">
          <small>내 예상 배달비</small>
          <b>{amount(room.fee / 2)}</b>
        </div>
        <Button onClick={join}>
          메뉴 고르고 참가 신청
          <Icon name="arrow" size={18} />
        </Button>
      </footer>
    </div>
  )
}

export function ChooseStore({
  back,
  select,
}: {
  back: () => void
  select: (s: Store) => void
}) {
  const [category, setCategory] = useState<Category>("all")

  return (
    <div className="bv-route">
      <Topbar title="새 모집 시작하기" back={back} />
      <div className="bv-route-body bv-padded">
        <div className="bv-entry-steps">
          <b>1 가게 선택</b>
          <span>2 메뉴 담기</span>
          <span>3 모집 등록</span>
        </div>
        <h1 className="bv-screen-heading">
          어디서 함께
          <br />
          주문할까요?
        </h1>
        <p className="bv-muted">내가 먹을 메뉴를 고르고 배프를 모아요.</p>
        <div className="bv-filter-pills">
          {([
            { id: "all", name: "전체" },
            { id: "coffee", name: "커피" },
            { id: "burger", name: "버거" },
            { id: "sandwich", name: "샌드위치" },
          ] as const).map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="bv-store-choices">
          {stores
            .filter((s) => category === "all" || s.category === category)
            .map((store) => (
              <button key={store.id} onClick={() => select(store)}>
                <Brand store={store} />
                <span>
                  <b>{store.short}</b>
                  <small>
                    {store.name.replace(store.short, "").trim()} · 메뉴{" "}
                    {store.menus.length}개
                  </small>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
