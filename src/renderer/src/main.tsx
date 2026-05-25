import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

async function mount() {
  // On Electron, window.api is injected by the preload script before this runs.
  // On Android (Capacitor), it is not — so we load the Capacitor bridge here.
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
