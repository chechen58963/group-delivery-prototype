import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SharedDeliveryProvider } from './SharedDelivery'
import './index.css'
import './v2/v2.css'
import './live-v2.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SharedDeliveryProvider><App /></SharedDeliveryProvider>
  </React.StrictMode>,
)
