import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { requestPersistentStorage } from './logic/storageHealth'
import './index.css'

// Ask the browser to protect this origin's storage from pressure eviction.
// Best-effort: denial or an unsupported API changes nothing at runtime.
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
