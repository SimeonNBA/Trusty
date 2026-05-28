import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TrustConnectProvider } from '@trustwallet/connect-react'
import './index.css'
import App from './App.tsx'
import { trustConfig } from './trustConfig'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrustConnectProvider config={trustConfig}>
      <App />
    </TrustConnectProvider>
  </StrictMode>,
)
