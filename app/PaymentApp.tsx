"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { sepolia } from 'wagmi/chains';

const CONFIG = {
    // Ensure this address is lowercase for comparison logic
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0".toLowerCase(),
    REQUIRED_AMOUNT: 0.001,
    AUDIO_SRC: "/alert.wav",
    PAYMENT_TIMEOUT: 50, // Total seconds
    BLUR_THRESHOLD: 25   // Seconds remaining when blur triggers
};

export default function PaymentApp() {
    const [view, setView] = useState('landing');
    const [txHash, setTxHash] = useState('');
    
    // Timer state
    const [timeLeft, setTimeLeft] = useState(CONFIG.PAYMENT_TIMEOUT);

    // We track the block number when the user started the payment flow
    const [startBlock, setStartBlock] = useState<bigint>(0n);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Wagmi hook to read from blockchain
    const publicClient = usePublicClient();
    const { isConnected: isAppConnected } = useAccount(); 

    // Create the Standard Payment URI (EIP-681)
    const paymentURI = `ethereum:${CONFIG.MERCHANT_ADDRESS}@${sepolia.id}?value=${parseEther(CONFIG.REQUIRED_AMOUNT.toString()).toString()}`;

    // --- Utility Functions ---

    // Centralized cancel function to be used by button AND timer
    const handleCancel = useCallback(() => {
        setView('landing');
        setTxHash('');
        // Reset timer for next time
        setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
    }, []);

    const playSuccessSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Audio playback failed:", error);
                });
            }
        }
    }, []);

    const handlePaymentSuccess = (hash: string) => {
        setTxHash(hash);
        setView('success');
        playSuccessSound();
    };

    // --- Timer Logic ---
    useEffect(() => {
        let timerId: NodeJS.Timeout;

        if (view === 'payment') {
            // Reset timer when entering payment view
            setTimeLeft(CONFIG.PAYMENT_TIMEOUT);

            timerId = setInterval(() => {
                setTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(timerId);
                        handleCancel(); // Auto-cancel when time is up
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }

        return () => clearInterval(timerId);
    }, [view, handleCancel]);

    // --- The Watcher Logic ---
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkRecentBlocks = async () => {
            if (view !== 'payment' || !publicClient || startBlock === 0n) return;

            try {
                const currentBlock = await publicClient.getBlockNumber();

                if (currentBlock >= startBlock) {
                    const block = await publicClient.getBlock({ 
                        blockNumber: currentBlock, 
                        includeTransactions: true 
                    });

                    const foundTx = block.transactions.find((tx: any) => {
                        const isToMerchant = tx.to?.toLowerCase() === CONFIG.MERCHANT_ADDRESS;
                        const isCorrectAmount = tx.value >= parseEther(CONFIG.REQUIRED_AMOUNT.toString());
                        return isToMerchant && isCorrectAmount;
                    });

                    if (foundTx) {
                        handlePaymentSuccess(foundTx.hash);
                    }
                }
            } catch (error) {
                console.error("Error polling blockchain:", error);
            }
        };

        if (view === 'payment') {
            intervalId = setInterval(checkRecentBlocks, 3000);
        }

        return () => clearInterval(intervalId);
    }, [view, publicClient, startBlock]);


    // Initialize the Start Block when entering payment view
    useEffect(() => {
        if (view === 'payment' && publicClient) {
            publicClient.getBlockNumber().then(blockNum => {
                setStartBlock(blockNum);
            });
        }
    }, [view, publicClient]);


    // --- Component Rendering ---

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            
            <audio ref={audioRef} src={CONFIG.AUDIO_SRC} preload="auto" />

            {/* MAIN CONTENT AREA */}
            <main className="flex flex-col items-center justify-center min-h-screen p-6">

                {/* VIEW: LANDING */}
                {view === 'landing' && (
                    <div className="text-center space-y-8 animate-fade-in">
                        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                            FUTURE PAY
                        </h1>

                        <button
                            onClick={() => setView('payment')}
                            className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <span>Pay {CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </button>
                    </div>
                )}

                {/* VIEW: PAYMENT (Direct QR Mode) */}
                {view === 'payment' && (
                    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 max-w-sm w-full text-center animate-fade-in-up">
                        <div className="mb-6 flex justify-between items-center text-slate-500">
                            <span className="text-xs font-bold tracking-widest uppercase">Scan to Pay</span>
                            {/* REPLACED "Native ETH" with Timer */}
                            <span className={`text-xs font-mono px-2 py-1 rounded font-bold transition-colors ${timeLeft <= 10 ? 'bg-red-100 text-red-600' : 'bg-slate-100'}`}>
                                Time left: {timeLeft}s
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center mb-6 relative">
                            {/* The Magic QR Code with Blur Logic */}
                            <div className={`bg-white p-2 border-2 border-emerald-500 rounded-xl shadow-lg transition-all duration-700 ease-in-out ${timeLeft <= CONFIG.BLUR_THRESHOLD ? 'blur-md opacity-20 pointer-events-none select-none' : ''}`}>
                                <QRCodeSVG 
                                    value={paymentURI}
                                    size={200}
                                    level={"H"}
                                    includeMargin={true}
                                />
                            </div>
                            
                            {/* Optional: Message explaining why it is blurred */}
                            {timeLeft <= CONFIG.BLUR_THRESHOLD && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-slate-900 font-bold bg-white/80 px-3 py-1 rounded-full text-sm shadow-sm animate-pulse">
                                        Time Expiring...
                                    </span>
                                </div>
                            )}
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
                            onClick={handleCancel}
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
