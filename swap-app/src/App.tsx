import { useTrustModal, useConnections } from '@trustwallet/connect-react'
import './App.css'

export default function App() {
  const modal = useTrustModal()
  const connections = useConnections()

  // eip155 connection (BSC). The connection object carries the
  // connected account address once a wallet is connected.
  const eip155 = (connections as Record<string, unknown> | undefined)?.eip155 as
    | { address?: string; accounts?: { address: string }[] }
    | undefined
  const address = eip155?.address ?? eip155?.accounts?.[0]?.address ?? null

  function short(a: string) {
    return a.slice(0, 6) + '…' + a.slice(-4)
  }

  return (
    <div className="wrap">
      <header className="head">
        <span className="shield">🛡️</span>
        <span className="brand">Trusty Swap</span>
      </header>

      <p className="sub">
        Connect your wallet to swap BNB Chain tokens through the safest route.
      </p>

      {address ? (
        <div className="connected">
          <div className="connected-label">Connected</div>
          <div className="connected-addr">{short(address)}</div>
          <button className="btn ghost" onClick={() => modal.open()}>
            Manage wallet
          </button>
        </div>
      ) : (
        <button className="btn primary" onClick={() => modal.open()}>
          Connect Wallet
        </button>
      )}

      <div className="soon">
        <strong>Coming next:</strong> paste a token, get the safest swap route,
        and confirm in your wallet — all in one place.
      </div>
    </div>
  )
}
