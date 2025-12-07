import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';

// 1. Define chains
export const chains = [base] as const;

// 2. Create Pure Wagmi Config (No Web3Modal wrapper)
export const config = createConfig({
  chains,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  }),
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL)
  },
});

export const queryClient = new QueryClient();
