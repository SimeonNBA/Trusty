import { useState, useEffect, useCallback } from 'react'
import { useTrustModal, useConnections } from '@trustwallet/connect-react'
import { useSendTransaction } from '@trustwallet/connect-eip155-react'
import { parseEther } from 'viem'
import { bsc } from 'viem/chains'
import './App.css'

const API = 'https://api.trustyai.tech'

type Scan = {
  symbol?: string
  name?: string
  score?: number | string
  verdict?: string
  marketData?: { mcap?: string; volume24h?: string }
}

type Quote = {
  ok: boolean
  toAmount?: string | null
  minOut?: string | null
  priceImpactPct?: number
  provider?: string | null
  transactions?: { to: string; value: string; data: string }[]
  error?: string
}

function short(a: string) {
  return a.slice(0, 6) + '…' + a.slice(-4)
}

// Rough display of the token amount out. Most BEP-20 use 18 decimals;
// the wallet shows the exact figure on confirm, this is just indicative.
function fmtOut(raw?: string | null) {
  if (!raw) return '—'
  try {
    const n = Number(BigInt(raw)) / 1e18
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
    if (n >= 1) return n.toFixed(2)
    return n.toPrecision(3)
  } catch {
    return '—'
  }
}

export default function App() {
  const modal = useTrustModal()
  // useConnections() returns { connections }, not the map directly.
  const { connections } = useConnections()
  const { sendTransactionAsync, isConfirming, isConfirmed, hash, error: txError } =
    useSendTransaction()

  // The eip155 connection is a discriminated union on `status`. When
  // 'connected' it carries `address` (may be CAIP-formatted, e.g.
  // "eip155:56:0x..."). Extract the plain 0x address for display + the
  // /api/swap-build `from` param.
  const eip155 = connections?.eip155 as
    | { status?: string; address?: string }
    | undefined
  const rawAddr = eip155?.status === 'connected' ? eip155?.address : undefined
  const address = rawAddr
    ? (String(rawAddr).match(/0x[a-fA-F0-9]{40}/)?.[0] ?? null)
    : null

  // Token from URL: trustyai.tech/swap?ca=0x...&chain=bsc
  const params = new URLSearchParams(window.location.search)
  const ca = (params.get('ca') || '').trim()
  const chain = (params.get('chain') || 'bsc').trim()

  const [scan, setScan] = useState<Scan | null>(null)
  const [amount, setAmount] = useState('0.05')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)

  // Fetch the safety scan for the token in the URL.
  useEffect(() => {
    if (!ca) return
    fetch(`${API}/api/scan?ca=${encodeURIComponent(ca)}&chain=${encodeURIComponent(chain)}`)
      .then((r) => r.json())
      .then((d) => setScan(d))
      .catch(() => setScan(null))
  }, [ca, chain])

  // Build a swap for the given amount. Shared by getQuote (display) and
  // doSwap (fresh fetch at execution time). 2% slippage gives headroom
  // for volatile memecoins so the 0x order doesn't revert on small moves.
  const fetchBuild = useCallback(
    async (wei: bigint): Promise<Quote> => {
      const u = `${API}/api/swap-build?ca=${encodeURIComponent(ca)}&chain=${encodeURIComponent(
        chain,
      )}&amount=${wei.toString()}&slippage=2&from=${encodeURIComponent(address || '')}`
      const r = await fetch(u)
      return r.json()
    },
    [address, ca, chain],
  )

  const parseAmount = useCallback((): bigint | null => {
    try {
      const wei = parseEther(amount as `${number}`)
      return wei > 0n ? wei : null
    } catch {
      return null
    }
  }, [amount])

  const getQuote = useCallback(async () => {
    setErr(null)
    setQuote(null)
    if (!address) {
      setErr('Connect your wallet first.')
      return
    }
    const wei = parseAmount()
    if (!wei) {
      setErr('Enter a valid BNB amount.')
      return
    }
    setLoadingQuote(true)
    try {
      const d = await fetchBuild(wei)
      if (!d.ok) {
        setErr(d.error === 'no route' ? 'No swap route for this token.' : d.error || 'Quote failed.')
      } else {
        setQuote(d)
      }
    } catch (e) {
      setErr(String((e as Error).message || e))
    } finally {
      setLoadingQuote(false)
    }
  }, [address, parseAmount, fetchBuild])

  const doSwap = useCallback(async () => {
    setErr(null)
    const wei = parseAmount()
    if (!wei || !address) return
    setSwapping(true)
    try {
      // Re-build FRESH right before signing — 0x routes expire in ~30-60s,
      // so the calldata captured at "Get quote" time may already be stale.
      // Fetching here guarantees the wallet receives a current, executable
      // transaction and won't revert on an expired order.
      const fresh = await fetchBuild(wei)
      if (!fresh.ok || !fresh.transactions?.length) {
        setErr(fresh.error === 'no route' ? 'Route expired — refresh and retry.' : fresh.error || 'Could not build swap.')
        return
      }
      setQuote(fresh)
      // Send each tx in order (BNB→token is a single swap tx; no approve).
      for (const tx of fresh.transactions) {
        // chain: bsc is required by viem's typed request. autoSwitchChain
        // (default on) makes the wallet switch to BSC if it isn't already.
        await sendTransactionAsync({
          chain: bsc,
          to: tx.to as `0x${string}`,
          value: BigInt(tx.value || '0'),
          data: tx.data as `0x${string}`,
        })
      }
    } catch (e) {
      setErr(String((e as Error).message || e))
    } finally {
      setSwapping(false)
    }
  }, [address, parseAmount, fetchBuild, sendTransactionAsync])

  const verdict = (scan?.verdict || '').toUpperCase()
  const isRisky = verdict === 'RUN'

  return (
    <div className="wrap">
      <header className="head">
        <span className="shield">🛡️</span>
        <span className="brand">Trusty Swap</span>
      </header>

      {!ca && (
        <p className="sub">
          No token specified. Open this page from a Trusty scan, or add{' '}
          <code>?ca=0x…&amp;chain=bsc</code> to the URL.
        </p>
      )}

      {ca && (
        <>
          {/* Token + safety */}
          <div className={'token ' + verdict.toLowerCase()}>
            <div className="token-row">
              <span className="token-sym">{scan?.symbol || '…'}</span>
              {scan?.verdict && (
                <span className={'verdict ' + verdict.toLowerCase()}>
                  {verdict} {scan.score != null ? scan.score + '/100' : ''}
                </span>
              )}
            </div>
            {scan?.marketData && (
              <div className="token-meta">
                MC {scan.marketData.mcap || '—'} · Vol {scan.marketData.volume24h || '—'}
              </div>
            )}
            <div className="token-ca">{short(ca)}</div>
          </div>

          {isRisky && (
            <div className="warn">
              ⚠️ Trusty rated this token <strong>RUN</strong> — high risk. Swap only if you
              understand what you're doing.
            </div>
          )}

          {/* Wallet */}
          {!address ? (
            <button className="btn primary" onClick={() => modal.open()}>
              Connect Wallet
            </button>
          ) : (
            <>
              <div className="connected-mini">
                Connected <strong>{short(address)}</strong>
              </div>

              {/* Amount */}
              <label className="amt-label">You pay (BNB)</label>
              <input
                className="amt-input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              {!quote ? (
                <button className="btn primary" onClick={getQuote} disabled={loadingQuote}>
                  {loadingQuote ? 'Getting quote…' : 'Get quote'}
                </button>
              ) : (
                <>
                  <div className="quote">
                    <div className="quote-row">
                      <span>You receive ~</span>
                      <strong>
                        {fmtOut(quote.toAmount)} {scan?.symbol || ''}
                      </strong>
                    </div>
                    <div className="quote-sub">
                      via {quote.provider || 'best route'} · impact{' '}
                      {(quote.priceImpactPct ?? 0).toFixed(2)}% · slippage 1%
                    </div>
                  </div>

                  {isConfirmed ? (
                    <div className="success">
                      ✅ Swap confirmed!
                      {hash && (
                        <a
                          href={`https://bscscan.com/tx/${hash}`}
                          target="_blank"
                          rel="noopener"
                        >
                          View on BscScan →
                        </a>
                      )}
                    </div>
                  ) : (
                    <button
                      className="btn primary"
                      onClick={doSwap}
                      disabled={swapping || isConfirming}
                    >
                      {swapping || isConfirming ? 'Confirm in wallet…' : 'Swap'}
                    </button>
                  )}

                  <button className="btn ghost" onClick={getQuote} disabled={loadingQuote}>
                    Refresh quote
                  </button>
                </>
              )}
            </>
          )}

          {(err || txError) && <div className="error">{err || txError?.message}</div>}
        </>
      )}

      <div className="soon">
        Routing by Trust Wallet · safety by Trusty AI · you confirm every swap in your wallet.
      </div>
    </div>
  )
}
