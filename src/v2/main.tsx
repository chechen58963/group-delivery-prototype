import React from "react"
import { createRoot } from "react-dom/client"
import BaefV2 from "./BaefV2"
import "./v2.css"

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BaefV2 />
  </React.StrictMode>,
)
