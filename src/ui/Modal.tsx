import { useEffect, useRef, type ReactNode } from "react"
import Icon from "./Icon"

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
