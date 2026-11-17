import { useState, type FormEvent } from "react"
import {
  amount,
  ownFee,
  reviews,
  storeById,
  type Order,
  type Pickup,
} from "./data"
import Icon from "./icons"
import { Avatar, Button, CampusMap, Modal, Tag } from "./ui"

export function LocationSheet({
  location,
  save,
  close,
}: {
  location: string
  save: (s: string) => void
  close: () => void
}) {
  const [selected, setSelected] = useState(location),
    [point, setPoint] = useState({ x: 57, y: 62 }),
    [map, setMap] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState("")
  const gps = () => {
    if (!navigator.geolocation) {
      setMessage(
        "이 브라우저에서 위치를 확인할 수 없어요. 아래에서 출발점을 골라 주세요.",
      )
      return
    }
    setLoading(true)
    setMessage("")
    navigator.geolocation.getCurrentPosition(
      () => {
        setSelected("현재 위치")
        setMessage("현재 위치를 확인했어요. 이 출발점을 사용할 수 있어요.")
        setLoading(false)
      },
      () => {
        setMessage(
          "현재 위치를 확인하지 못했어요. 위치 권한을 확인하거나 지도에서 골라 주세요.",
        )
        setLoading(false)
      },
      { timeout: 10000 },
    )
  }
  return (
    <Modal
      title="내 출발 위치"
      close={close}
      footer={
        <Button onClick={() => save(selected)}>
          이 위치에서 출발할게요
          <Icon name="check" size={18} />
        </Button>
      }
    >
      <p className="bv-muted">출발 위치를 정하면 가까운 배프를 찾기 쉬워요.</p>
      <div className="bv-location-choices">
        {["충남대 정문", "충남대 도서관", "충남대 후문", "궁동 로데오"].map(
          (place, i) => (
            <button
              key={place}
              aria-pressed={selected === place}
              onClick={() => setSelected(place)}
            >
              <span className="bv-round-icon">
                <Icon name="pin" size={20} />
              </span>
              <span>
                <b>{place}</b>
                <small>
                  {
                    [
                      "정문·궁동 주변",
                      "중앙도서관 주변",
                      "후문·농대입구 주변",
                      "궁동 공영주차장 주변",
                    ][i]
                  }
                </small>
              </span>
              {selected === place && <Icon name="check" size={20} />}
            </button>
          ),
        )}
      </div>
      <div className="bv-location-tools">
        <button onClick={gps} disabled={loading}>
          <Icon name="pin" size={19} />
          {loading ? "위치 확인 중…" : "현재 위치 사용"}
        </button>
        <button onClick={() => setMap((v) => !v)}>
          <Icon name="map" size={19} />
          지도에서 선택
        </button>
      </div>
      {map && (
        <>
          <CampusMap
            selectable
            point={point}
            place={selected}
            onChange={(p) => {
              setPoint(p)
              setSelected("지도에서 선택한 출발점")
            }}
          />
          <p className="bv-muted">지도를 눌러 출발할 곳을 선택해 주세요.</p>
        </>
      )}
      {message && (
        <p className="bv-inline-feedback" role="status">
          {message}
        </p>
      )}
      <div className="bv-origin-confirm">
        <Icon name="check" size={17} />
        <span>
          선택한 출발점 <b>{selected}</b>
        </span>
      </div>
    </Modal>
  )
}

export function PickupSheet({
  order,
  close,
  save,
}: {
  order: Order
  close: () => void
  save: (pickup: Pickup, place: string, time: string) => void
}) {
  const [mode, setMode] = useState(order.pickup),
    [place, setPlace] = useState(order.place),
    [time, setTime] = useState(order.time)
  const choices = [
    {
      id: "meet",
      icon: "users",
      title: "직접 만나서 받기",
      text: "가까운 공개 장소에서 만나 음식을 나눠요.",
    },
    {
      id: "contactless",
      icon: "bag",
      title: "비대면으로 찾아가기",
      text: "리더가 음식을 놓으면 각자 찾아가요.",
    },
    {
      id: "nearby",
      icon: "pin",
      title: "내 근처에서 받기",
      text: "내 이동은 0m, 배달비는 내가 전액 부담해요.",
    },
  ] as const
  return (
    <Modal
      title="수령 방법 정하기"
      close={close}
      footer={
        <Button
          disabled={!place.trim() || !time}
          onClick={() => save(mode, place, time)}
        >
          이 장소·시간으로 제안
          <Icon name="arrow" size={18} />
        </Button>
      }
    >
      <p className="bv-muted">
        어떻게 받을지 함께 정해요. 상대에게 변경 내용을 알려드려요.
      </p>
      <div className="bv-pickup-choices">
        {choices.map((c) => (
          <button
            key={c.id}
            aria-pressed={mode === c.id}
            onClick={() => setMode(c.id)}
          >
            <Icon name={c.icon} size={24} />
            <span>
              <b>{c.title}</b>
              <small>{c.text}</small>
            </span>
            <i>{mode === c.id && <Icon name="check" size={13} />}</i>
          </button>
        ))}
      </div>
      <label className="bv-field">
        공개 수령 장소
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          maxLength={100}
        />
      </label>
      <label className="bv-field">
        수령 약속 시간
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      {mode === "contactless" && (
        <p className="bv-inline-feedback">
          음식을 놓을 정확한 위치와 닉네임 표시 방법은 채팅에서 함께 확인해
          주세요.
        </p>
      )}
      {mode === "nearby" && (
        <p className="bv-inline-feedback">
          내 배달비 {amount(order.room.fee)} · 상대 배달비 0원
          <br />
          상대가 제안에 동의하면 적용돼요.
        </p>
      )}
    </Modal>
  )
}

export function AccountSheet({
  order,
  nickname,
  close,
  save,
}: {
  order: Order
  nickname: string
  close: () => void
  save: (data: Partial<Order>) => void
}) {
  const [bank, setBank] = useState(order.bank || "카카오뱅크"),
    [account, setAccount] = useState(order.account),
    [holder, setHolder] = useState(order.holder || nickname)
  const valid =
    account.replace(/\D/g, "").length >= 8 && holder.trim().length > 0
  return (
    <Modal
      title="송금받을 계좌"
      close={close}
      footer={
        <Button
          disabled={!valid}
          onClick={() =>
            save({ bank, account: account.trim(), holder: holder.trim() })
          }
        >
          계좌 저장
        </Button>
      }
    >
      <p className="bv-muted">함께 주문하는 참가자가 이 계좌로 송금해요.</p>
      <label className="bv-field">
        은행
        <select value={bank} onChange={(e) => setBank(e.target.value)}>
          {[
            "카카오뱅크",
            "토스뱅크",
            "국민은행",
            "신한은행",
            "하나은행",
            "우리은행",
            "농협은행",
            "기업은행",
          ].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label className="bv-field">
        계좌번호
        <input
          inputMode="numeric"
          value={account}
          onChange={(e) => setAccount(e.target.value.replace(/[^0-9-]/g, ""))}
          maxLength={24}
          placeholder="계좌번호를 입력해 주세요"
        />
      </label>
      <label className="bv-field">
        예금주
        <input
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          maxLength={20}
        />
      </label>
      <p className="bv-small-note">
        <Icon name="shield" size={16} />
        계좌는 이 모임의 참가자에게만 보여요.
      </p>
    </Modal>
  )
}

export function PersonSheet({
  name,
  close,
  applicant = false,
  accept,
  reject,
}: {
  name: string
  close: () => void
  applicant?: boolean
  accept?: () => void
  reject?: () => void
}) {
  return (
    <Modal
      title={applicant ? "참가 신청 확인" : "배프 프로필"}
      close={close}
      footer={
        applicant ? (
          <div className="bv-double-actions">
            <Button secondary onClick={reject}>
              거절
            </Button>
            <Button onClick={accept}>
              함께 주문 수락
              <Icon name="check" size={18} />
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="bv-person-profile">
        <Avatar name={name} size="large" tone={1} />
        <h2>
          {name}
          {applicant && <span>참가 신청자</span>}
        </h2>
        <p>
          <span className="bv-star">★ 4.9</span> · 함께 주문 {applicant ? 12 : 24}회
        </p>
        <Tag green>약속을 잘 지키는 배프</Tag>
      </div>
      {applicant && (
        <div className="bv-applicant-menu">
          <b>신청한 메뉴</b>
          <p>먹고 싶은 메뉴를 담아 참가를 신청했어요.</p>
        </div>
      )}
      <div className="bv-section-title">
        <h2>함께한 배프의 후기</h2>
        <span>18개</span>
      </div>
      {reviews.map((review) => (
        <div className="bv-review-row" key={review.name}>
          <div>
            <Avatar name={review.name} size="small" tone={2} />
            <b>{review.name}</b>
            <span>{review.date}</span>
          </div>
          <span className="bv-review-stars">★★★★★</span>
          <p>{review.text}</p>
        </div>
      ))}
    </Modal>
  )
}

export function ReviewSheet({
  name,
  close,
  save,
}: {
  name: string
  close: () => void
  save: (stars: number, comment: string) => void
}) {
  const [stars, setStars] = useState(5),
    [comment, setComment] = useState("")
  return (
    <Modal
      title="함께한 배프에게 후기"
      close={close}
      footer={<Button onClick={() => save(stars, comment)}>후기 남기기</Button>}
    >
      <div className="bv-review-intro">
        <Avatar name={name} size="large" tone={1} />
        <h2>{name}님과 함께해서 어땠나요?</h2>
        <p>소통과 약속, 음식 수령 경험을 알려 주세요.</p>
      </div>
      <div className="bv-rating-stars" aria-label="별점 선택">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n}점`}
            aria-pressed={stars === n}
            onClick={() => setStars(n)}
            className={n <= stars ? "selected" : ""}
          >
            <Icon name="star" size={34} />
          </button>
        ))}
      </div>
      <label className="bv-field">
        한마디 남기기
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          placeholder="시간을 잘 맞춰주셔서 편하게 받았어요."
        />
      </label>
    </Modal>
  )
}

export function MapSheet({
  order,
  room,
  close,
}: {
  order: Order | null
  room: { place: string; distance: number; minutes: number }
  close: () => void
}) {
  return (
    <Modal title="수령 장소 확인" close={close}>
      <CampusMap place={order?.place ?? room.place} />
      <div className="bv-map-place">
        <Icon name="pin" size={24} />
        <div>
          <h2>{order?.place ?? room.place}</h2>
          <p>
            {order?.pickup === "nearby"
              ? "내 출발점에서 0m"
              : `내 출발점에서 ${room.distance}m · 도보 약 ${room.minutes}분`}
          </p>
        </div>
      </div>
      {order && (
        <div className="bv-fact-row">
          <span>약속한 수령 시간</span>
          <b>{order.time}</b>
        </div>
      )}
      <p className="bv-muted">
        실제 걸어가는 길과 건물 출입구를 확인하고 만나 주세요.
      </p>
    </Modal>
  )
}

export const products = [
  {
    id: "snack",
    name: "작은 간식 교환권",
    brand: "가볍게 모아 즐겨요",
    price: 200,
    image: "/images/reward-icecream.jpg",
  },
  {
    id: "convenience",
    name: "편의점 모바일 금액권",
    brand: "먹고 싶은 간식으로",
    price: 3000,
    image: "/images/reward-convenience.jpg",
  },
  {
    id: "ebike",
    name: "전기자전거 이용권",
    brand: "가까운 거리를 더 편하게",
    price: 1000,
    image: "/images/reward-ebike.jpg",
  },
  {
    id: "escooter",
    name: "전동킥보드 이용권",
    brand: "내 이동에 작은 보탬",
    price: 1000,
    image: "/images/reward-escooter.jpg",
  },
]
export function ShopSheet({
  points,
  close,
  buy,
}: {
  points: number
  close: () => void
  buy: (id: string) => void
}) {
  return (
    <Modal title="포인트로 누리는 작은 즐거움" close={close} wide>
      <div className="bv-shop-balance">
        <span>사용 가능한 포인트</span>
        <strong>{points.toLocaleString()} P</strong>
      </div>
      <div className="bv-product-grid">
        {products.map((p) => (
          <article key={p.id}>
            <img src={p.image} alt={p.name} />
            <small>{p.brand}</small>
            <h3>{p.name}</h3>
            <b>{p.price.toLocaleString()} P</b>
            <Button
              secondary
              disabled={points < p.price}
              onClick={() => buy(p.id)}
            >
              {points < p.price
                ? `${(p.price - points).toLocaleString()}P 더 모으면`
                : "포인트로 교환"}
            </Button>
          </article>
        ))}
      </div>
    </Modal>
  )
}
export function VoucherSheet({ id, close }: { id: string; close: () => void }) {
  const p = products.find((p) => p.id === id) ?? products[0]
  return (
    <Modal title="내 교환권" close={close}>
      <div className="bv-voucher">
        <img src={p.image} alt={p.name} />
        <Tag green>사용 가능</Tag>
        <h2>{p.name}</h2>
        <p>결제 전 직원에게 교환권을 보여 주세요.</p>
        <svg viewBox="0 0 240 70" role="img" aria-label="교환권 바코드">
          {Array.from({ length: 54 }, (_, i) => (
            <rect
              key={i}
              x={i * 4 + 10}
              y={5}
              width={i % 3 === 0 ? 3 : 1.5}
              height={60}
              fill="currentColor"
            />
          ))}
        </svg>
        <span>8201 7492 6038</span>
      </div>
    </Modal>
  )
}

export function PreferencesSheet({
  close,
  save,
}: {
  close: () => void
  save: (menus: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(["커피"])
  return (
    <Modal
      title="먹고 싶은 메뉴, 먼저 골라두기"
      close={close}
      footer={
        <Button disabled={!selected.length} onClick={() => save(selected)}>
          조건이 맞는 배프가 생기면 알려줘요
        </Button>
      }
    >
      <p className="bv-muted">
        바로 모집하지 않아도 괜찮아요.
        <br />
        근처에 같은 메뉴를 고른 배프가 생기면 알려드려요.
      </p>
      <div className="bv-preference-choices">
        {[
          { name: "커피", photo: "/images/menus/ediya-1-ice.webp" },
          { name: "버거", photo: "/images/menus/mom-1.webp" },
          { name: "샌드위치", photo: "/images/menus/subway-1.webp" },
        ].map((m) => (
          <button
            key={m.name}
            aria-pressed={selected.includes(m.name)}
            onClick={() =>
              setSelected((v) =>
                v.includes(m.name)
                  ? v.filter((s) => s !== m.name)
                  : [...v, m.name],
              )
            }
          >
            <img src={m.photo} alt="" />
            <span>{m.name}</span>
            {selected.includes(m.name) && <Icon name="check" size={16} />}
          </button>
        ))}
      </div>
      <label className="bv-field">
        언제 먹고 싶나요?
        <select>
          <option>지금부터 1시간 안에</option>
          <option>오늘 저녁</option>
          <option>내일 점심</option>
        </select>
      </label>
    </Modal>
  )
}
