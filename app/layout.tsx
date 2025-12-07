import type { Metadata } from "next";
import { headers } from "next/headers"; 
import { cookieToInitialState } from "wagmi"; 
import { config } from "./wagmi"; 
import Web3Provider from "./context/Web3Provider"; 

import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "base USDC",
  description: "Secure Crypto Water Dispenser",
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  
  const headersData = await headers(); 
  const initialState = cookieToInitialState(
    config,
    headersData.get("cookie")
  );

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3Provider initialState={initialState}>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
