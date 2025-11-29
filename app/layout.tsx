import type { Metadata } from "next";
import { headers } from "next/headers"; // 1. Import headers to read cookies
import { cookieToInitialState } from "wagmi"; // 2. Helper to sync server/client state
import { config } from "./wagmi"; // 3. Import your wagmi config
import Web3Provider from "./context/Web3Provider"; // 4. Import the wrapper we created in Step 1

import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Future Pay",
  description: "Secure Crypto Payment Kiosk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 5. Get the cookie from the headers to persist connection state
  const initialState = cookieToInitialState(
    config,
    headers().get("cookie")
  );

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 6. Wrap children with the Provider, passing the initialState */}
        <Web3Provider initialState={initialState}>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}