"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CreditCard, Zap, RefreshCw, Activity, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; // <--- NEW LIBRARY
import { useAccount, usePublicClient } from 'wagmi'; 
import { parseEther, formatEther } from 'viem';
import { sepolia } from 'wagmi/chains';

const CONFIG = {
    // Ensure this address is lowercase for comparison logic
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0".toLowerCase(),
    REQUIRED_AMOUNT: 0.001,
    INACTIVITY_LIMIT: 60000,
    AUDIO_SRC: "/sounds/success.mp3"
};

export default function PaymentApp() {
    const [view, setView] = useState('landing'); 
    const [status, setStatus] = useState('Idle');
    const [txHash, setTxHash] = useState('');
    
    // We track the block number when the user started the payment flow
    // So we only look for transactions that happened AFTER they clicked "Pay"
    const [startBlock, setStartBlock] = useState<bigint>(0n);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Wagmi hook to read from blockchain
    const publicClient = usePublicClient();
    const { isConnected: isAppConnected } = useAccount(); // Only used for status check, not payment

    // Create the Standard Payment URI (EIP-681)
    // Format: ethereum:ADDRESS@CHAIN_ID?value=AMOUNT_IN_WEI
    const paymentURI = `ethereum:${CONFIG.MERCHANT_ADDRESS}@${sepolia.id}?value=${parseEther(CONFIG.REQUIRED_AMOUNT.toString()).toString()}`;

    // --- Utility Functions ---

    const resetInactivityTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            console.log("User inactive. Resetting...");
            setView('landing');
            setStatus('Idle');
            setTxHash('');
        }, CONFIG.INACTIVITY_LIMIT);
    }, []);

    const playSuccessSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(error => console.error("Failed to play audio:", error));
        }
    }, []);

    const handlePaymentSuccess = (hash: string) => {
        setTxHash(hash);
        setView('success');
        playSuccessSound();
    };

    // --- The Watcher Logic (The Core "One Step" Magic) ---
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkRecentBlocks = async () => {
            if (view !== 'payment' || !publicClient || startBlock === 0n) return;

            try {
                // 1. Get the latest block number
                const currentBlock = await publicClient.getBlockNumber();

                // 2. Only check if a new block has been mined since we started
                if (currentBlock >= startBlock) {
                    setStatus("Scanning blockchain for payment...");

                    // 3. Get the full block with transactions
                    const block = await publicClient.getBlock({ 
                        blockNumber: currentBlock, 
                        includeTransactions: true 
                    });

                    // 4. Look for our transaction in this block
                    const foundTx = block.transactions.find((tx: any) => {
                        // Check: Is it to our merchant?
                        const isToMerchant = tx.to?.toLowerCase() === CONFIG.MERCHANT_ADDRESS;
                        // Check: Is it the right amount? (Allow exact match or slightly higher)
                        const isCorrectAmount = tx.value >= parseEther(CONFIG.REQUIRED_AMOUNT.toString());
                        
                        return isToMerchant && isCorrectAmount;
                    });

                    if (foundTx) {
                        setStatus("Payment Detected! Verifying...");
                        handlePaymentSuccess(foundTx.hash);
                    }
                }
            } catch (error) {
                console.error("Error polling blockchain:", error);
            }
        };

        // Start polling when in payment view
        if (view === 'payment') {
            // Poll every 3 seconds (average block time varies, 3s is snappy enough)
            intervalId = setInterval(checkRecentBlocks, 3000);
        }

        return () => clearInterval(intervalId);
    }, [view, publicClient, startBlock]);


    // Initialize the Start Block when entering payment view
    useEffect(() => {
        if (view === 'payment' && publicClient) {
            setStatus("Ready to scan");
            publicClient.getBlockNumber().then(blockNum => {
                setStartBlock(blockNum);
            });
            resetInactivityTimer();
        }
    }, [view, publicClient, resetInactivityTimer]);


    // Set up user activity monitoring to reset timer
    useEffect(() => {
        const events = ['mousemove', 'click', 'keydown', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetInactivityTimer));
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
        };
    }, [resetInactivityTimer]);


    // --- Component Rendering ---

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            <audio ref={audioRef} src={CONFIG.AUDIO_SRC} />

            {/* Header / Status Bar */}
            <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-slate-800/50 backdrop-blur-md z-10 border-b border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400">
                    <Activity size={18} />
                    <span className="text-sm font-mono tracking-wider">SYSTEM: {status}</span>
                </div>
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
                        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">FUTURE PAY</h1>
                        <p className="text-slate-400 text-lg max-w-md mx-auto">
                            Secure, instant blockchain payments powered by Sepolia ETH.
                        </p>
                        <button
                            onClick={() => setView('payment')}
                            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <span>Pay {CONFIG.REQUIRED_AMOUNT} ETH</span>
                            <CreditCard size={24} className="group-hover:rotate-12 transition-transform" />
                        </button>
                    </div>
                )}

                {/* VIEW: PAYMENT (Direct QR Mode) */}
                {view === 'payment' && (
                    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 max-w-sm w-full text-center animate-fade-in-up">
                        <div className="mb-6 flex justify-between items-center text-slate-500">
                            <span className="text-xs font-bold tracking-widest uppercase">Scan to Pay</span>
                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Native ETH</span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center mb-6">
                            {/* The Magic QR Code */}
                            <div className="bg-white p-2 border-2 border-emerald-500 rounded-xl shadow-lg">
                                <QRCodeSVG 
                                    value={paymentURI}
                                    size={200}
                                    level={"H"}
                                    includeMargin={true}
                                />
                            </div>
                        </div>

                        <p className="text-slate-600 font-medium mb-2">
                            Send exactly: <span className="text-emerald-600 font-bold text-lg">{CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </p>
                        <p className="text-xs text-slate-400 mb-6">
                            On Sepolia Network
                        </p>

                        <div className="flex justify-center items-center gap-2 text-emerald-600 animate-pulse text-sm font-semibold mb-6">
                            <RefreshCw size={16} className="animate-spin" />
                            Waiting for transaction...
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