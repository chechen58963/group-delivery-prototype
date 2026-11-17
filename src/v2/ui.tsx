import { useEffect, useRef, type ReactNode } from "react"
import Icon from "./icons"
import type { Store } from "./data"

export function Brand({
  store,
  small = false,
}: {
  store: Store
  small?: boolean
}) {
  return (
    <span className={`bv-brand ${small ? "small" : ""}`}>
      <img src={store.logo} alt={store.short} />
    </span>
  )
}
export function Avatar({
  name,
  size = "normal",
  tone = 0,
}: {
  name: string
  size?: "normal" | "large" | "small"
  tone?: number
}) {
  return (
    <span className={`bv-avatar ${size} tone-${tone % 4}`}>
      {name.slice(0, 1)}
    </span>
  )
}
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode
  onClick?: () => void
  secondary?: boolean
  disabled?: boolean
  type?: "button" | "submit"
  className?: string
}) {
  return (
    <button
      type={type}
      className={`bv-button ${secondary ? "secondary" : ""} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
export function Topbar({
  title,
  back,
  children,
}: {
  title: string
  back: () => void
  children?: ReactNode
}) {
  return (
    <header className="bv-topbar">
      <button className="bv-icon" aria-label="뒤로 가기" onClick={back}>
        <Icon name="back" />
      </button>
      <h1>{title}</h1>
      <div>{children}</div>
    </header>
  )
}
export function Modal({
  title,
  close,
  children,
  footer,
  wide = false,
}: {
  title: string
  close: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    return () => {
      ref.current?.close()
      opener?.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`bv-dialog ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      aria-label={title}
    >
      <section>
        <header>
          <h2>{title}</h2>
          <button
            className="bv-icon"
            onClick={close}
            aria-label={`${title} 닫기`}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="bv-dialog-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </dialog>
  )
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div className="bv-empty">
      <span className="bv-empty-icon">
        <Icon name="bag" size={32} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {children}
    </div>
  )
}
export function Tag({
  children,
  green = false,
}: {
  children: ReactNode
  green?: boolean
}) {
  return <span className={`bv-tag ${green ? "green" : ""}`}>{children}</span>
}
export function SectionTitle({
  title,
  aside,
}: {
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="bv-section-title">
      <h2>{title}</h2>
      {aside}
    </div>
  )
}
export function CampusMap({
  place = "충남대 정문",
  selectable = false,
  point = { x: 57, y: 62 },
  onChange,
}: {
  place?: string
  selectable?: boolean
  point?: { x: number; y: number }
  onChange?: (point: { x: number; y: number }) => void
}) {
  return (
    <div
      className={`bv-campus-map ${selectable ? "selectable" : ""}`}
      onClick={(e) => {
        if (!selectable || !onChange) return
        const b = e.currentTarget.getBoundingClientRect()
        onChange({
          x: Math.max(10, Math.min(90, (100 * (e.clientX - b.left)) / b.width)),
          y: Math.max(15, Math.min(85, (100 * (e.clientY - b.top)) / b.height)),
        })
      }}
    >
      <svg
        viewBox="0 0 600 320"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="600" height="320" fill="#f0f2e9" />
        <path
          d="M-20 245 620 190M120-20 200 340M420-20 350 340"
          fill="none"
          stroke="#fff"
          strokeWidth="24"
        />
        <path
          d="M-20 245 620 190M120-20 200 340M420-20 350 340"
          fill="none"
          stroke="#dedfd6"
          strokeWidth="2"
        />
        <g fill="#dce5d5" stroke="#d0dbca">
          <rect x="215" y="46" width="110" height="80" rx="7" />
          <rect x="36" y="42" width="73" height="93" rx="7" />
          <rect x="435" y="55" width="85" height="72" rx="7" />
          <rect x="225" y="250" width="87" height="60" rx="7" />
          <rect x="428" y="252" width="98" height="65" rx="7" />
        </g>
        <g fill="#75806f" fontFamily="sans-serif" fontSize="15">
          <text x="232" y="89">
            충남대학교
          </text>
          <text x="47" y="94">
            도서관
          </text>
          <text x="454" y="96">
            공과대학
          </text>
          <text x="450" y="288">
            궁동
          </text>
        </g>
        <path
          d="M240 180Q280 160 350 196"
          fill="none"
          stroke="#df7b51"
          strokeWidth="4"
          strokeDasharray="7 8"
        />
      </svg>
      <span className="bv-map-origin" style={{ left: "40%", top: "55%" }}>
        나
      </span>
      <span
        className="bv-map-marker"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
      >
        <Icon name="pin" size={24} />
      </span>
      <span
        className="bv-map-label"
        style={{ left: `${point.x}%`, top: `${Math.min(91, point.y + 16)}%` }}
      >
        {place}
      </span>
      <span className="bv-map-scale">100m ━━━</span>
    </div>
  )
}
export function AmountInput({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  return (
    <div className="bv-amount-editor">
      <label>
        {label}
        <span>
          <input
            aria-label={label}
            type="number"
            inputMode="numeric"
            min={min}
            max={1000000}
            value={value}
            onChange={(e) =>
              onChange(Math.max(min, Math.min(1000000, Number(e.target.value))))
            }
          />
          원
        </span>
      </label>
      <div>
        {[-1000, 1000, 10000].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() =>
              onChange(Math.max(min, Math.min(1000000, value + n)))
            }
            aria-label={`${label} ${
              n > 0 ? "더하기" : "빼기"
            } ${Math.abs(n)}원`}
          >
            {n > 0 ? "+" : "−"}
            {Math.abs(n).toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  )
}
