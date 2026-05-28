import { createEIP155 } from '@trustwallet/connect-eip155-react'

// TrustConnect configuration. One EVM namespace scoped to BNB Smart
// Chain (chain id 56). rpcUrls lets the SDK read chain state without
// relying solely on the wallet's own RPC. Add more chains here later
// (ETH=1, Base=8453, etc.) when the swap page supports them.
export const trustConfig = {
  namespaces: [
    createEIP155({
      chains: [{ id: 56 }],
      rpcUrls: {
        56: ['https://bsc-dataseed.binance.org'],
      },
    }),
  ],
}
