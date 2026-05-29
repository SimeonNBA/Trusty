import { bsc, mainnet, base, polygon } from 'viem/chains'
import type { Chain } from 'viem'

// Single source of truth for the EVM chains Trusty Swap supports.
// The worker's /api/swap-build already routes all of these via TWAK;
// this registry maps the ?chain= URL param to the viem chain object
// the wallet needs and feeds trustConfig's namespace list. Native
// symbol + block-explorer come straight off the viem chain, so adding
// a chain is just one line here.
export type ChainEntry = {
  key: string // canonical key sent to the worker as ?chain=
  viem: Chain
  rpc: string
}

const ENTRIES: ChainEntry[] = [
  { key: 'bsc', viem: bsc, rpc: 'https://bsc-dataseed.binance.org' },
  { key: 'ethereum', viem: mainnet, rpc: 'https://ethereum-rpc.publicnode.com' },
  { key: 'base', viem: base, rpc: 'https://mainnet.base.org' },
  { key: 'polygon', viem: polygon, rpc: 'https://polygon-rpc.com' },
]

// URL-param aliases → canonical key (mirrors the worker's
// swapDomainForChain so a link built anywhere resolves the same).
const ALIASES: Record<string, string> = {
  bsc: 'bsc',
  bnb: 'bsc',
  binance: 'bsc',
  smartchain: 'bsc',
  eth: 'ethereum',
  ethereum: 'ethereum',
  mainnet: 'ethereum',
  base: 'base',
  polygon: 'polygon',
  matic: 'polygon',
  pol: 'polygon',
}

export function resolveChain(param: string | null | undefined): ChainEntry | null {
  const key = ALIASES[(param || '').toLowerCase().trim()]
  if (!key) return null
  return ENTRIES.find((e) => e.key === key) ?? null
}

export const SUPPORTED_CHAINS = ENTRIES
