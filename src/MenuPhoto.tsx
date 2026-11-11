import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import photos from './menuPhotos.json'
import './menu-photo.css'

const menuPhotos = photos as Record<string, Record<string, string>>

export default function MenuPhoto({ storeName, name }: { storeName: string; name: string }) {
  const brand = Object.keys(menuPhotos).find(key => storeName.startsWith(key))
  const src = brand ? menuPhotos[brand][name] : undefined
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!expanded || !src) return
    const opener = trigger.current
    dialog.current?.showModal()
    return () => { opener?.focus({ preventScroll: true }) }
  }, [expanded, src])

  if (!src || failedSource === src) return null
  return <>
    <button ref={trigger} type="button" className="baef-menu-photo" aria-label={`${name} 사진 크게 보기`} aria-haspopup="dialog" onClick={() => setExpanded(true)}>
      <img src={src} alt="" width="72" height="72" loading="lazy" decoding="async" onError={() => setFailedSource(src)} />
    </button>
    {expanded && createPortal(<dialog ref={dialog} className="baef-menu-photo-dialog" aria-label={`${name} 사진`} onCancel={e => { e.stopPropagation(); setExpanded(false) }} onClose={() => setExpanded(false)} onKeyDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) setExpanded(false) }}>
      <div className="baef-menu-photo-view">
        <button type="button" className="baef-menu-photo-close" aria-label="메뉴 사진 닫기" autoFocus onClick={() => setExpanded(false)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
        <img src={src} alt={name} width="480" height="480" />
        <div><h2>{name}</h2><p>{storeName}</p></div>
      </div>
    </dialog>, document.body)}
  </>
}
