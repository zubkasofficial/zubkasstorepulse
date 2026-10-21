import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { WooProvider } from './auth/WooContext'
import './index.css'
import { registerServiceWorker } from './registerServiceWorker'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WooProvider>
          <App />
        </WooProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

registerServiceWorker()
