"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CreditCard, Zap, RefreshCw, Activity, Lock } from 'lucide-react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
// FIX: Replace useWaitForTransaction with useWaitForTransactionReceipt (Wagmi V2 update)
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'; 
import { parseEther } from 'viem';
import { sepolia } from 'wagmi/chains';


const CONFIG = {
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0",
    REQUIRED_AMOUNT: 0.001,
    INACTIVITY_LIMIT: 60000,
    AUDIO_SRC: "/sounds/success.mp3"
};

export default function PaymentApp() {
    const [view, setView] = useState('landing'); 
    const [status, setStatus] = useState('Idle');
    const [txHash, setTxHash] = useState<string>('');
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Wagmi Hooks for Wallet Interaction
    const { open } = useWeb3Modal();
    const { address, isConnected, chainId } = useAccount();

    // Convert ETH amount to Wei (BigInt format required by viem)
    const amountWei = parseEther(CONFIG.REQUIRED_AMOUNT.toString());

    // Wagmi hook to send transaction
    const { data: sendTxData, sendTransaction } = useSendTransaction({
        to: CONFIG.MERCHANT_ADDRESS as `0x${string}`,
        value: amountWei,
        chainId: sepolia.id,
    });

    // Wagmi hook to wait for transaction confirmation
    const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
        hash: sendTxData?.hash,
    });

    // --- Utility Functions ---

    const resetInactivityTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            console.log("User inactive. Resetting...");
            setView('landing');
            setStatus('Idle');
            setTxHash('');
            // TODO: Consider disconnecting wallet here if needed
        }, CONFIG.INACTIVITY_LIMIT);
    }, []);

    const playSuccessSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(error => console.error("Failed to play success audio:", error));
        }
    }, []);

    const handlePaymentSuccess = (hash: string) => {
        setTxHash(hash);
        setView('success');
        playSuccessSound();
    };

    // --- NEW: Handle the "Pay" Button Click ---
    const handlePay = useCallback(() => {
        setView('payment'); // Enter the payment status view
        resetInactivityTimer();

        if (!isConnected) {
            // If disconnected, open the modal for connection (QR code)
            setStatus("Waiting for Wallet Connection...");
            open();
        } else if (chainId !== sepolia.id) {
            // If connected but on wrong network, prompt network switch
            setStatus("Wrong Network. Please switch to Sepolia.");
            open({ view: 'Networks' });
        } else {
            // If connected and on correct network, send transaction immediately
            setStatus(`Wallet connected: ${address?.slice(0, 6)}... Confirming transaction...`);
            sendTransaction();
        }
    }, [isConnected, chainId, address, open, sendTransaction, resetInactivityTimer]);


    // --- Monitor Connection Changes WHILE in the payment view (If modal was just closed) ---
    useEffect(() => {
        if (view === 'payment') {
            resetInactivityTimer();
            
            // This monitors state changes (like user closing modal or connecting successfully)
            if (isConnected && chainId === sepolia.id && !sendTxData) {
                // If user just connected successfully from the modal, initiate transaction.
                setStatus(`Wallet connected: ${address?.slice(0, 6)}... Confirming transaction...`);
                sendTransaction();
            } else if (isConnected && chainId !== sepolia.id) {
                 setStatus("Wrong Network. Please switch to Sepolia.");
            } else if (isConnected && sendTxData) {
                // Transaction initiated, now waiting for confirmation
                setStatus("Transaction pending...");
            } else if (!isConnected) {
                 // If somehow disconnected while in payment view, go back to waiting for connection
                 setStatus("Waiting for Wallet Connection...");
            }
        }
    }, [view, isConnected, chainId, sendTxData, address, resetInactivityTimer, sendTransaction]);

    // --- Handle Confirmation ---
    useEffect(() => {
        if (isTxConfirmed && sendTxData) {
            handlePaymentSuccess(sendTxData.hash);
        }
    }, [isTxConfirmed, sendTxData]);


    // Set up activity monitoring
    useEffect(() => {
        window.addEventListener('mousemove', resetInactivityTimer);
        window.addEventListener('click', resetInactivityTimer);
        window.addEventListener('keydown', resetInactivityTimer);
        window.addEventListener('touchstart', resetInactivityTimer);
        resetInactivityTimer();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            window.removeEventListener('mousemove', resetInactivityTimer);
            window.removeEventListener('click', resetInactivityTimer);
            window.removeEventListener('keydown', resetInactivityTimer);
            window.removeEventListener('touchstart', resetInactivityTimer);
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
                            // FIX: Call the new handler function
                            onClick={handlePay} 
                            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <span>Pay {CONFIG.REQUIRED_AMOUNT} ETH</span>
                            <CreditCard size={24} className="group-hover:rotate-12 transition-transform" />
                        </button>
                    </div>
                )}

                {/* VIEW: PAYMENT (WalletConnect Modal handles QR) */}
                {view === 'payment' && (
                    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 max-w-sm w-full text-center animate-fade-in-up">
                        <div className="mb-6 flex justify-between items-center text-slate-500">
                            <span className="text-xs font-bold tracking-widest uppercase">Connect Wallet</span>
                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Native ETH</span>
                        </div>
                        
                        <div className="h-52 flex flex-col items-center justify-center">
                            {/* WalletConnect QR/Modal will automatically appear or has already appeared */}
                            <p className="text-slate-600 font-medium mb-4">
                                Use the **QR Code** that opens automatically to connect your wallet.
                            </p>
                            
                            {isConnected && chainId === sepolia.id && !sendTxData && (
                                <p className="text-emerald-500 font-semibold">Ready to send. Check your wallet for the transaction prompt!</p>
                            )}
                        </div>

                        <p className="text-slate-600 font-medium mb-2">
                            Awaiting: <span className="text-emerald-600 font-bold">{CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </p>
                        
                        {/* Display Tx Hash if available */}
                        {sendTxData && (
                            <p className="text-xs text-slate-400 font-mono break-all bg-slate-50 p-2 rounded border border-slate-100 mb-6">
                                Tx: {sendTxData.hash.slice(0, 10)}...{sendTxData.hash.slice(-8)}
                            </p>
                        )}


                        <div className="flex justify-center items-center gap-2 text-emerald-600 animate-pulse text-sm font-semibold mb-6">
                            <RefreshCw size={16} className="animate-spin" />
                            {isTxConfirmed ? 'Confirmation received!' : 'Waiting for confirmation...'}
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
                                <div className="text-xs text-slate-500 mb-8">
                                    Payment confirmed on the Sepolia testnet.
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