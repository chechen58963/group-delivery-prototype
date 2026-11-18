import type { CSSProperties } from "react"

const paths = {
  explore: "m21 3-5.6 13.4L2 22 7.6 8.6 21 3ZM8 9l7 7",
  bag: "M5 7h14l2 14H3L5 7ZM9 8V6a3 3 0 0 1 6 0v2",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  chat: "M21 11.5a8.5 8.5 0 0 1-12 7.8L3 21l1.7-6A8.5 8.5 0 1 1 21 11.5Z",
  person:
    "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "m15 18-6-6 6-6",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  walk: "m13 9 3 3h4M7 21l3-6-3-3 3-6 4 2v6l3 7M5 11l2-4 3-1M15 2h.01",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  star: "m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.9L12 18l-6.2 3.1L7 14.2l-5-4.9 6.9-1L12 2Z",
  copy: "M9 9h12v12H9zM15 5V3H3v12h2",
  send: "m22 2-7 20-4-9L2 9 22 2ZM11 13 22 2",
  wallet: "M3 6h17v15H3V6Zm1 0V3h14v3M16 11h5v5h-5v-5Z",
  shield: "m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7l9-4Zm-4 9 3 3 5-6",
  edit: "m16 3 5 5L9 20l-6 1 1-6L16 3Zm-2 2 5 5",
  camera: "M3 6h5l2-3h4l2 3h5v15H3V6Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  cup: "M4 3h13v12a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V3Zm13 2h2a3 3 0 0 1 0 6h-2M2 23h18",
  settings: "M4 7h16M4 17h16M9 4v6m6 4v6",
  receipt: "M5 2l3 2 4-2 4 2 3-2v20l-3-2-4 2-4-2-3 2V2Zm4 6h6m-6 4h6m-6 4h4",
  leaf: "M20 3c-10 0-17 4-17 11a7 7 0 0 0 7 7c7 0 11-8 10-18ZM3 21 16 8",
} as const
export type IconName = keyof typeof paths
export default function Icon({
  name,
  size = 22,
  style,
  className = "",
}: {
  name: IconName
  size?: number
  style?: CSSProperties
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}
