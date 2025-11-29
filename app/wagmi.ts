import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { sepolia } from 'wagmi/chains';
import { http, cookieStorage, createStorage } from 'wagmi'; // Import http and storage helpers
import { QueryClient } from '@tanstack/react-query';

// 1. Get WalletConnect Project ID
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || '';

if (typeof window !== 'undefined' && !projectId) {
  throw new Error('WalletConnect Project ID is missing. Set NEXT_PUBLIC_WALLETCONNECT_ID environment variable.');
}

// 2. Define our chain
const chains = [sepolia] as const;

// 3. Metadata for Web3Modal
export const metadata = {
  name: 'Future Pay Sepolia',
  description: 'WalletConnect integration for Future Pay',
  url: 'https://future-pay-demo.com', // Ensure this matches your actual domain in production
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// 4. Wagmi Config
// We use 'http' for transports and 'cookieStorage' for SSR support
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
  // Recommended for Next.js to persist connection state without hydration errors
  storage: createStorage({
    storage: cookieStorage
  }), 
  transports: {
    // This uses your env variable if it exists, otherwise falls back to public RPC
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL) 
  },
  // Ensure WalletConnect is enabled (defaultWagmiConfig does this by default)
  enableWalletConnect: true, 
  enableInjected: true, // Needed if you want to test with MetaMask browser extension too
  enableCoinbase: false, // Optional: Disable if you only want WalletConnect
  enableEmail: false // Optional: Disable Email login if you want strictly crypto wallets
});

// 5. Create Web3Modal instance
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  chains,
  themeVariables: {
    '--w3m-accent': '#10b981', // Emerald green
    '--w3m-border-radius-master': '1px'
  },
  enableAnalytics: false,
});

export const queryClient = new QueryClient();