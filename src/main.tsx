import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SharedDeliveryProvider } from './SharedDelivery'
import './index.css'
import './styles/base.css'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SharedDeliveryProvider><App /></SharedDeliveryProvider>
  </React.StrictMode>,
)
