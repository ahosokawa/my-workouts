import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Force iOS standalone PWA to recalculate viewport height on load.
// Works around WebKit bugs where the viewport doesn't initially
// extend to the full screen until a scroll event occurs.
if ((window.navigator as any).standalone) {
  requestAnimationFrame(() => {
    window.scrollTo(0, 1)
    requestAnimationFrame(() => {
      window.scrollTo(0, 0)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
