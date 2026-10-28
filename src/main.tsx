import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      registration.update().catch(() => { /* Offline start is fine. */ })
    }).catch(() => { /* The app still works without offline support. */ })
  })
  // A newer worker taking over means the cached shell and exercise data changed.
  // Reload once so the page never keeps mixing old and new assets.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  const target = window as Window & { __fitdayInstallPrompt?: Event }
  target.__fitdayInstallPrompt = event
  window.dispatchEvent(new Event('fitday-install-available'))
})
