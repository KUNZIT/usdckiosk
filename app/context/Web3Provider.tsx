// app/context/Web3Provider.tsx
'use client';

import React, { ReactNode } from 'react';
import { WagmiProvider, State } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { config, queryClient } from '../wagmi'; // Adjust path to your wagmi.ts file

interface Props {
  children: ReactNode;
  initialState?: State;
}

export default function Web3Provider({ children, initialState }: Props) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
