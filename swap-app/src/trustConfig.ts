import { createEIP155 } from '@trustwallet/connect-eip155-react'
import { SUPPORTED_CHAINS } from './chains'

// TrustConnect configuration. One EVM namespace covering every chain in
// the SUPPORTED_CHAINS registry (BSC, Ethereum, Base, Polygon). rpcUrls
// lets the SDK read chain state without relying solely on the wallet's
// own RPC. To add a chain, edit chains.ts — this picks it up.
export const trustConfig = {
  namespaces: [
    createEIP155({
      chains: SUPPORTED_CHAINS.map((c) => ({ id: c.viem.id })),
      rpcUrls: Object.fromEntries(
        SUPPORTED_CHAINS.map((c) => [c.viem.id, [c.rpc]]),
      ),
    }),
  ],
}
