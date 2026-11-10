import { useState, type ReactNode } from 'react'
import './store-brand.css'

const brands = [
  { name: '써브웨이', file: 'subway.png', tone: 'subway' },
  { name: '맘스터치', file: 'momstouch.svg', tone: 'momstouch' },
  { name: '이디야', file: 'ediya.gif', tone: 'ediya' },
  { name: '메가', file: 'mega.png', tone: 'mega' },
  { name: '컴포즈', file: 'compose.svg', tone: 'compose' },
  { name: '빽다방', file: 'paik.png', tone: 'paik' },
  { name: '롯데리아', file: 'lotteria.svg', tone: 'lotteria' },
  { name: '더벤티', file: 'theventi.png', tone: 'theventi' },
]

export default function StoreBrand({ name, fallback }: { name: string; fallback?: ReactNode }) {
  const brand = brands.find(v => name.startsWith(v.name))
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const src = brand ? `/images/brands/${brand.file}` : null
  if (!brand || !src || failedSource === src) return <>{fallback}</>
  return <span className={`baef-store-brand baef-store-brand--${brand.tone}`}>
    <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedSource(src)} />
  </span>
}
