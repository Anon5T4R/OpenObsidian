import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// On Electron, window.api is injected by the preload script before this runs.
// On Android (Capacitor), there is no preload — we dynamically import capacitorApi.
async function mount() {
  if (!window.api) {
    const { capacitorApi } = await import('./api/capacitorApi')
    ;(window as any).api = capacitorApi
  }
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

mount()
