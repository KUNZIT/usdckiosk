"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CreditCard, Zap, RefreshCw, Activity, Lock } from 'lucide-react';
import { Contract, BigNumberish, Log, AddressLike } from 'ethers';


const CONFIG = {
  // Your receiving wallet address
  MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0",
  // USDT Contract Address (Ethereum Mainnet)
  USDT_CONTRACT_ADDRESS: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  // RPC URL (Get a free key from Infura or Alchemy)
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "",
  // Amount to verify (1 USDT = 1000000 units usually)
  REQUIRED_AMOUNT: 1.0,
  // Inactivity timeout in milliseconds (e.g., 60 seconds)
  INACTIVITY_LIMIT: 60000,
  // Audio file path (In Next.js, put this file in the 'public' folder)
  AUDIO_SRC: "/sounds/success.mp3"
};

// Minimal ABI to listen for Transfer events
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

export default function App() {
  const [view, setView] = useState('landing'); // 'landing', 'payment', 'success'
  const [status, setStatus] = useState('Idle');
  const [txHash, setTxHash] = useState('');
  const [ethersLoaded, setEthersLoaded] = useState(false);

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inactivity Timer Logic
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Auto-refresh / Reset to landing
      console.log("User inactive. Resetting...");
      setView('landing');
      setStatus('Idle');
      setTxHash('');
    }, CONFIG.INACTIVITY_LIMIT);
  }, []);

  // Load Ethers.js from CDN
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.11.1/ethers.umd.min.js";
    script.async = true;
    script.onload = () => {
        console.log("Ethers.js loaded");
        setEthersLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
        if(document.body.contains(script)) {
            document.body.removeChild(script);
        }
    }
  }, []);

  // Activity Listeners
  useEffect(() => {
    // Attach event listeners for activity
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('click', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);

    // Initial start
    resetInactivityTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('click', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer);
    };
  }, [resetInactivityTimer]);

  const playSuccessSound = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.play().catch(error => {
            console.error("Failed to play success audio:", error);
        });
    }
  }, []);


  const handlePaymentSuccess = (hash: string) => {
    setTxHash(hash);
    setView('success');
    // Play Audio
    playSuccessSound();
    // Removed: triggerArduino();
  };

  // --- BLOCKCHAIN LISTENER ---
  useEffect(() => {
    let provider: any;
    let contract: Contract | undefined;

    // Only start listening if we are in payment view and ethers is loaded
    if (view === 'payment' && ethersLoaded && (window as any).ethers) {
      try {
        const ethers = (window as any).ethers;
        // Initialize Provider (Read-only)
        provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        contract = new ethers.Contract(CONFIG.USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);

        console.log("Listening for USDT transfers...");
        setStatus("Monitoring Blockchain...");

        // Create Filter: From ANY, To MERCHANT
        const filter = contract.filters.Transfer(null, CONFIG.MERCHANT_ADDRESS);

        // Listener Callback
        const handleTransfer = async (
          from: AddressLike,
          to: AddressLike,
          value: BigNumberish,
          event: Log
        ) => {
          // value is BigNumber
          const formattedValue = ethers.formatUnits(value, 6); // USDT has 6 decimals
          console.log(`Transfer detected! ${formattedValue} USDT from ${from}`);

          if (parseFloat(formattedValue) >= CONFIG.REQUIRED_AMOUNT) {
            console.log("Payment Confirmed.");
            if (contract) {
                contract.off(filter, handleTransfer); // Stop listening
            }
            handlePaymentSuccess(event.transactionHash);
          }
        };

        contract.on(filter, handleTransfer);
      } catch (error) {
        console.error("Blockchain connection error:", error);
        setStatus("Connection Error");
      }
    } else if (view === 'payment' && !ethersLoaded) {
        setStatus("Loading Blockchain Libs...");
    }

    // Cleanup function
    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
  }, [view, ethersLoaded, handlePaymentSuccess]); // Added handlePaymentSuccess to dependencies

  // --- HELPER FOR QR ---
  const qrData = `ethereum:${CONFIG.MERCHANT_ADDRESS}/transfer?address=${CONFIG.USDT_CONTRACT_ADDRESS}&uint256=1000000`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  // --- RENDER HELPERS ---

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">

      {/* Audio Element */}
      <audio ref={audioRef} src={CONFIG.AUDIO_SRC} />

      {/* Header / Status Bar */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-slate-800/50 backdrop-blur-md z-10 border-b border-slate-700">
        <div className="flex items-center gap-2 text-emerald-400">
          <Activity size={18} />
          <span className="text-sm font-mono tracking-wider">SYSTEM: {status}</span>
        </div>
        {/* Removed: Hardware link button */}
        {/* Removed: <button onClick={connectArduino}>...</button> */}
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex flex-col items-center justify-center min-h-screen p-6">

        {/* VIEW: LANDING */}
        {view === 'landing' && (
          <div className="text-center space-y-8 animate-fade-in">
            <div className="mb-8 relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full blur opacity-25"></div>
              <div className="relative bg-slate-800 p-6 rounded-full inline-block">
                <Zap size={64} className="text-emerald-400" />
              </div>
            </div>

            <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
              FUTURE PAY
            </h1>
            <p className="text-slate-400 text-lg max-w-md mx-auto">
              Secure, instant blockchain payments powered by Ethereum.
            </p>

            <button
              onClick={() => setView('payment')}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              <span>Pay 1.00 USDT</span>
              <CreditCard size={24} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        )}

        {/* VIEW: PAYMENT (QR) */}
        {view === 'payment' && (
          <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 max-w-sm w-full text-center animate-fade-in-up">
            <div className="mb-6 flex justify-between items-center text-slate-500">
              <span className="text-xs font-bold tracking-widest uppercase">Scan to Pay</span>
              <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">ERC-20</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl inline-block mb-6 relative">
                {!ethersLoaded && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-xs">Loading Libs...</div>}
                <img
                src={qrUrl}
                alt="Payment QR Code"
                className="w-[200px] h-[200px] rounded"
              />
            </div>

            <p className="text-slate-600 font-medium mb-2">Send <span className="text-emerald-600 font-bold">1.00 USDT</span></p>
            <p className="text-xs text-slate-400 font-mono break-all bg-slate-50 p-2 rounded border border-slate-100 mb-6">
              {CONFIG.MERCHANT_ADDRESS}
            </p>

            <div className="flex justify-center items-center gap-2 text-emerald-600 animate-pulse text-sm font-semibold mb-6">
              <RefreshCw size={16} className="animate-spin" />
              Waiting for confirmation...
            </div>

            <button
                onClick={() => setView('landing')}
                className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
            >
                Cancel Transaction
            </button>
          </div>
        )}

        {/* VIEW: SUCCESS POPUP */}
        {view === 'success' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-emerald-500/30 max-w-md w-full text-center relative overflow-hidden">

              {/* Confetti / Decoration Background */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent"></div>

              <div className="relative z-10">
                <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/40">
                  <Lock size={40} className="text-white" />
                </div>

                <h2 className="text-3xl font-bold text-white mb-2">Payment Verified!</h2>
                <p className="text-emerald-400 text-lg mb-6">Access Granted</p>

                <div className="bg-slate-900/50 p-4 rounded-xl mb-6 text-left">
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Transaction Hash</p>
                    <p className="text-slate-300 text-xs font-mono break-all">{txHash || "0x..."}</p>
                </div>

                {/* Updated message to reflect hardware removal */}
                <div className="text-xs text-slate-500 mb-8">
                  Payment confirmed on the Ethereum blockchain.
                </div>

                <button
                  onClick={() => setView('landing')}
                  className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Removed: Footer Instructions for Arduino */}
      {/* <div className="absolute bottom-4 w-full text-center text-slate-600 text-xs">...</div> */}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
      `}</style>
    </div>
  );
}
