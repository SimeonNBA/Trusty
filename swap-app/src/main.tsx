import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrustConnectProvider } from '@trustwallet/connect-react'
import './index.css'
import App from './App.tsx'
import { trustConfig } from './trustConfig'

// TrustConnect's eip155 hooks (useSendTransaction etc.) are built on
// @tanstack/react-query and require a QueryClientProvider ancestor.
// Without it the transaction hooks throw "No QueryClient set" and the
// app renders blank. Provider goes outermost so both TrustConnect and
// the eip155 hooks can use it.
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TrustConnectProvider config={trustConfig}>
        <App />
      </TrustConnectProvider>
    </QueryClientProvider>
  </StrictMode>,
)
