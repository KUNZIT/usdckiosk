"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { usePublicClient } from 'wagmi';
import { parseUnits } from 'viem'; 
import { base } from 'wagmi/chains';


import { mintReceiptNFT } from './utils/mintAction'; 

// Define the SerialPort type globally for TypeScript compatibility
declare global {
    interface Navigator {
        serial: {
            requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
            getPorts(): Promise<SerialPort[]>;
            addEventListener(type: "disconnect", listener: (event: Event) => void): void;
            removeEventListener(type: "disconnect", listener: (event: Event) => void): void;
        };
    }
    interface SerialPortRequestOptions {
        filters?: SerialPortFilter[];
    }
    interface SerialPortFilter {
        usbVendorId: number;
        usbProductId: number;
    }
    interface SerialPort {
        getInfo(): SerialPortInfo;
        open(options: SerialOptions): Promise<void>;
        close(): Promise<void>;
        readable?: ReadableStream<Uint8Array>;
        writable?: WritableStream<WritableStreamDefaultWriter<Uint8Array> | Uint8Array>;
    }
    interface SerialPortInfo {
        usbVendorId?: number;
        usbProductId?: number;
    }
    interface SerialOptions {
        baudRate: number;
    }
}

const CONFIG = {
    
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0".toLowerCase(),
    // Official USDC Contract on Base Mainnet
    USDC_CONTRACT_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase(), 
    
    REQUIRED_AMOUNT: 0.5, 
    
    AUDIO_SRC: "/alert.wav",
    PAYMENT_TIMEOUT: 50,
    SUCCESS_TIMEOUT: 10,
    FINAL_MESSAGE_DURATION: 2000,
    BLUR_THRESHOLD: 25,

    // ARDUINO Config (Matching the Leonardo Sketch)
    ARDUINO_LEONARDO_FILTERS: [
        { usbVendorId: 0x2341, usbProductId: 0x8036 },
        { usbVendorId: 0x2341, usbProductId: 0x0036 },
    ],
    BAUD_RATE: 9600,
    // Commands to Arduino
    RELAY_COMMAND: "RELAY_ON",
    // Commands from Arduino (to trigger the app)
    BUTTON_TRIGGER_COMMAND: "BUTTON_4_PRESSED",
    RELAY_OFF_COMMAND: "RELAY_AUTO_OFF",
};

export default function PaymentApp() {
    // Web3 Payment State
    const [view, setView] = useState('landing');
    const [txHash, setTxHash] = useState('');
    const [successPhase, setSuccessPhase] = useState<'timer' | 'message'>('timer');
    const [timeLeft, setTimeLeft] = useState(CONFIG.PAYMENT_TIMEOUT);
    const [successTimeLeft, setSuccessTimeLeft] = useState(CONFIG.SUCCESS_TIMEOUT);
    const [startBlock, setStartBlock] = useState<bigint>(0n);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Arduino/Web Serial State
    const [port, setPort] = useState<SerialPort | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reader, setReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);
    const [writer, setWriter] = useState<WritableStreamDefaultWriter<Uint8Array> | null>(null);
    const [needsPermission, setNeedsPermission] = useState(false);
    const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
    const [relayIsActive, setRelayIsActive] = useState(false); 

    // Wagmi hooks 
    const publicClient = usePublicClient();

    // --- QR CODE GENERATION 
    const usdcAmountInSmallestUnit = parseUnits(CONFIG.REQUIRED_AMOUNT.toString(), 6).toString();
    
    const paymentURI = `ethereum:${CONFIG.USDC_CONTRACT_ADDRESS}@${base.id}/transfer?address=${CONFIG.MERCHANT_ADDRESS}&uint256=${usdcAmountInSmallestUnit}`;

    // --- UTILITY FUNCTIONS ---

    const handleReset = useCallback(() => {
        setView('landing');
        setTxHash('');
        setSuccessPhase('timer');
        setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
        setSuccessTimeLeft(CONFIG.SUCCESS_TIMEOUT);
    }, []);

    // --- ARDUINO/WEB SERIAL LOGIC ---

    const sendCommand = useCallback(
        async (command: string) => {
            if (!port || !writer || !isConnected) {
                // Not throwing error to UI to avoid disrupting flow if relay is secondary
                console.warn("Arduino not connected. Command skipped:", command);
                return;
            }

            try {
                // Don't set global loading state here to avoid re-renders during active flow
                const encoder = new TextEncoder();
                const data = encoder.encode(command + "\n");
                await writer.write(data);
                console.log(`[Arduino] Sent command: ${command}`);
            } catch (err) {
                setIsConnected(false);
                setError(err instanceof Error ? err.message : "Failed to send command to Arduino");
            } 
        },
        [port, writer, isConnected],
    );

    // --- SUCCESS HANDLER WITH MINTING ---
    const handlePaymentSuccess = useCallback(async (hash: string, payerAddress: string) => { 
        setTxHash(hash);
        setView('success');
        setSuccessPhase('timer'); 

        console.log(`[Success] Payment confirmed from ${payerAddress}. Processing actions...`);

        // 1. TRIGGER AUDIO & PHYSICAL RELAY
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            
            const relayAction = () => {
                if (isConnected) {
                    console.log("Payment confirmed. Triggering Arduino relay operation.");
                    sendCommand(CONFIG.RELAY_COMMAND); 
                }
            };

            if (playPromise !== undefined) {
                playPromise.then(relayAction).catch(error => {
                    console.error("Audio playback failed:", error);
                    relayAction(); 
                });
            } else {
                relayAction();
            }
        }

        // 2. MINT NFT (Fire and forget - don't await blocking the UI)
        mintReceiptNFT(CONFIG.MERCHANT_ADDRESS, payerAddress).then(() => {
            console.log("[NFT] Minting process initiated successfully.");
        }).catch(err => {
            console.error("[NFT] Minting failed silently:", err);
        });

    }, [isConnected, sendCommand]);

    const disconnectFromArduino = useCallback(async () => {
        if (port) {
            try {
                if (reader) {
                    await reader.cancel();
                    await reader.releaseLock();
                    setReader(null);
                }
                if (writer) {
                    await writer.close();
                    setWriter(null);
                }
                await port.close();
            } catch (err) {
                console.error("Error disconnecting from Arduino:", err);
            }
            setPort(null);
            setIsConnected(false);
            setAutoConnectAttempted(false);
            setRelayIsActive(false);
            console.log("[Arduino] Arduino disconnected.");
        }
    }, [port, reader, writer]);

    const connectToArduino = useCallback(async (autoConnect = false) => {
        try {
            setIsLoading(true);
            setError(null);
            setNeedsPermission(false);

            if (!navigator.serial) {
                throw new Error("Web Serial API is not supported in this browser.");
            }

            let selectedPort: SerialPort;

            if (autoConnect) {
                const ports = await navigator.serial.getPorts();
                const arduinoPort = ports.find((p) => {
                    const info = p.getInfo();
                    return CONFIG.ARDUINO_LEONARDO_FILTERS.some(
                        (filter) => info.usbVendorId === filter.usbVendorId && info.usbProductId === filter.usbProductId,
                    );
                });

                if (!arduinoPort) {
                    setNeedsPermission(true);
                    return;
                }
                selectedPort = arduinoPort;
            } else {
                selectedPort = await navigator.serial.requestPort({
                    filters: CONFIG.ARDUINO_LEONARDO_FILTERS,
                });
            }

            await selectedPort.open({ baudRate: CONFIG.BAUD_RATE });

            const portReader = selectedPort.readable?.getReader();
            const portWriter = selectedPort.writable?.getWriter();

            if (!portReader || !portWriter) {
                throw new Error("Failed to get serial port reader/writer.");
            }

            setPort(selectedPort);
            setReader(portReader);
            setWriter(portWriter);
            setIsConnected(true);
            console.log("[Arduino] Arduino Leonardo connected via Web Serial API.");

        } catch (err) {
            if (!autoConnect) {
                setError(err instanceof Error ? err.message : "Failed to connect to Arduino.");
            }
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- ARDUINO/WEB SERIAL EFFECTS ---
    useEffect(() => {
        if (typeof navigator === "undefined" || !("serial" in navigator)) return;

        const attemptAutoConnect = async () => {
            if (!autoConnectAttempted) {
                setAutoConnectAttempted(true);
                await connectToArduino(true);
            }
        };

        const handleDisconnect = () => {
            console.log("[Arduino] Serial port disconnected.");
            setPort(null);
            setIsConnected(false);
            setWriter(null);
            setReader(null);
            setAutoConnectAttempted(false);
            setTimeout(() => connectToArduino(true), 1000);
        };

        attemptAutoConnect();
        navigator.serial.addEventListener("disconnect", handleDisconnect);

        return () => {
            navigator.serial.removeEventListener("disconnect", handleDisconnect);
        }
    }, [connectToArduino, autoConnectAttempted]);

    useEffect(() => {
        let loop = true;

        const readSerialData = async () => {
            if (!reader) return;

            const decoder = new TextDecoder();
            try {
                while (loop) {
                    const { value, done } = await reader.read();
                    if (done) { break; }
                    
                    const text = decoder.decode(value);
                    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                    for (const line of lines) {
                        console.log(`[Arduino] Received: ${line}`);

                        if (line === CONFIG.BUTTON_TRIGGER_COMMAND) {
                            console.log("[Arduino] External button pressed! Triggering payment view.");
                            setView(currentView => currentView === 'landing' ? 'payment' : currentView); 
                        } else if (line === "RELAY_ON_OK") {
                            setRelayIsActive(true);
                        } else if (line === CONFIG.RELAY_OFF_COMMAND) {
                            setRelayIsActive(false);
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            } catch (error) {
                console.error("[Arduino] Serial read error:", error);
                disconnectFromArduino(); 
            }
        };

        if (isConnected && reader) {
            readSerialData();
        }

        return () => {
            loop = false; 
            if (reader) reader.cancel().catch(() => {});
        };
    }, [isConnected, reader, disconnectFromArduino]);


    // --- TIMER & WATCHER LOGIC ---

    // Timer Logic (Payment Flow)
    useEffect(() => {
        let timerId: NodeJS.Timeout;

        if (view === 'payment') {
            setTimeLeft(CONFIG.PAYMENT_TIMEOUT);
            timerId = setInterval(() => {
                setTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(timerId);
                        handleReset();
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [view, handleReset]);

    // Timer Logic (Success Flow)
    useEffect(() => {
        let timerId: NodeJS.Timeout;

        if (view === 'success' && successPhase === 'timer') {
            setSuccessTimeLeft(CONFIG.SUCCESS_TIMEOUT);
            timerId = setInterval(() => {
                setSuccessTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(timerId);
                        setSuccessPhase('message');
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [view, successPhase]);

    // Logic (Success Flow - Final Message)
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        if (view === 'success' && successPhase === 'message') {
            timeoutId = setTimeout(() => {
                handleReset();
            }, CONFIG.FINAL_MESSAGE_DURATION);
        }

        return () => clearTimeout(timeoutId);
    }, [view, successPhase, handleReset]);

    // Initialize the Start Block
    useEffect(() => {
        if (view === 'payment' && publicClient) {
            publicClient.getBlockNumber().then(blockNum => {
                setStartBlock(blockNum);
                console.log(`[Web3] Payment Flow Start Block set to: ${blockNum}`);
            }).catch(e => {
                console.error("Failed to fetch block number:", e);
                setError("Failed to initialize blockchain connection.");
            });
        }
          if (view !== 'payment') {
              setStartBlock(0n);
        }
    }, [view, publicClient]);


    // --- BLOCKCHAIN WATCHER TO EXTRACT PAYER ---
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkRecentBlocks = async () => {
            if (view !== 'payment' || !publicClient || startBlock === 0n) return;

            try {
                const currentBlock = await publicClient.getBlockNumber();
                const requiredValue = parseUnits(CONFIG.REQUIRED_AMOUNT.toString(), 6);
                
                const maxBlocksToSearch = 10n;
                const minBlockToSearch = currentBlock > maxBlocksToSearch ? currentBlock - maxBlocksToSearch : 0n;
                const searchStartBlock = minBlockToSearch > startBlock ? minBlockToSearch : startBlock;

                for (let i = currentBlock; i >= searchStartBlock; i--) {
                    const block = await publicClient.getBlock({
                        blockNumber: i,
                        includeTransactions: true
                    });

                    // SEARCH FOR USDC TRANSFER TRANSACTIONS
                    const foundTx = block.transactions.find((tx: any) => {
                        const isToUSDC = tx.to?.toLowerCase() === CONFIG.USDC_CONTRACT_ADDRESS;
                        
                        const input = tx.input?.toLowerCase();
                        const isTransferMethod = input?.startsWith('0xa9059cbb');

                        if (isToUSDC && isTransferMethod && input.length >= 138) {
                            const recipientInInput = "0x" + input.slice(34, 74);
                            
                            const amountHex = "0x" + input.slice(74, 138);
                            const amountVal = BigInt(amountHex);

                            const isToMerchant = recipientInInput === CONFIG.MERCHANT_ADDRESS;
                            const isCorrectAmount = amountVal >= requiredValue;

                            return isToMerchant && isCorrectAmount;
                        }
                        return false;
                    });

                    if (foundTx) {
                        console.log(`[Web3 Watcher] Success: USDC Transfer ${foundTx.hash} found in block ${i}`);
                        
                        // EXTRACT PAYER ADDRESS FROM TRANSACTION
                        // foundTx.from is standard in viem/wagmi transaction objects
                        const payerAddress = foundTx.from;
                        
                        handlePaymentSuccess(foundTx.hash, payerAddress);
                        return;
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
    }, [view, publicClient, startBlock, handlePaymentSuccess]); 

    const isWebSerialSupported = typeof navigator !== "undefined" && "serial" in navigator;

    // --- Component Rendering ---
    
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            
            <audio ref={audioRef} src={CONFIG.AUDIO_SRC} preload="auto" />

            {/* ARDUINO CONNECTION STATUS & BUTTONS */}
            {isWebSerialSupported && (
                
                <div 
                    className={`absolute top-4 right-4 z-10 flex flex-col items-end space-y-2 p-3 rounded-xl bg-slate-900/70 backdrop-blur-sm shadow-xl border border-slate-700 transition-opacity duration-300 ${isConnected ? 'opacity-0 pointer-events-none' : ''}`}
                >
                    <div className='flex items-center space-x-2'>
                        {/* Status Indicator */}
                        <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'}`}></div>
                        
                        {/* Status Text */}
                        <span className="text-xs font-semibold text-slate-300">
                            Arduino: {isConnected ? 'Connected' : isLoading ? 'Connecting...' : 'Disconnected'}
                        </span>

                        {/* Connection Button */}
                        {(!isConnected && needsPermission) && (
                            <button
                                onClick={() => connectToArduino(false)}
                                disabled={isLoading}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading ? "Connecting..." : "Connect USB"}
                            </button>
                        )}
                        {/* Disconnect Button */}
                        {isConnected && (
                            <button
                                onClick={disconnectFromArduino}
                                className="text-xs bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-3 rounded-lg transition-colors"
                            >
                                Disconnect
                            </button>
                        )}
                    </div>
                    {relayIsActive && (
                        <span className="text-xs text-yellow-400 animate-pulse font-mono">
                            Relay Active (Auto-Off in 4s)
                        </span>
                    )}
                    {error && (
                            <span className="text-xs text-red-400 font-mono">
                                Web3 Error
                            </span>
                    )}
                </div>
            )}
            
            {/* WEB SERIAL UNSUPPORTED ALERT */}
            {!isWebSerialSupported && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 p-6 bg-red-900 border border-red-700 rounded-lg shadow-2xl max-w-sm text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <AlertCircle className="h-6 w-6 text-red-300" />
                            <h2 className="text-xl font-semibold text-red-200">Web Serial Required</h2>
                        </div>
                        <p className="text-red-300 text-sm">
                            Relay control requires the **Web Serial API** (Chrome/Edge 89+).
                        </p>
                    </div>
            )}
            
            {/* MAIN CONTENT AREA */}
            <main className="flex flex-col items-center justify-center min-h-screen p-6">

{/* VIEW: LANDING */}
{view === 'landing' && (
    <div className="text-center space-y-8 animate-fade-in">
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
            DRINKING WATER Dispenser
        </h1>

        
        <img
            src="/logo.jpg"
            alt="Water Dispenser Logo"
            className="mx-auto w-64 h-auto rounded-2xl border-2 border-emerald-500/20"
        />

        <p className="text-5xl font-bold text-blue-400 -mt-4">
            250ml of water
        </p>        

        <button
            onClick={() => setView('payment')}
            
            className="group relative px-8 py-4 bg-black border border-emerald-500 hover:bg-emerald-900 text-emerald-500 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mx-auto"
        >
            {/* USDC OFFICIAL ICON (Inline SVG - Classic Version) */}
            <svg
                width="28"
                height="28"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 rounded-full bg-white" /* White bg optional, but keeps edges crisp */
            >
                {/* 1. The Blue Circle Background */}
                <circle cx="16" cy="16" r="16" fill="#2775CA" />

                {/* 2. The White Brackets & Dollar Sign */}
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17.22 21.5H14.78C13.25 21.5 12 20.25 12 18.72V18.5C12 18.22 12.22 18 12.5 18H13C13.28 18 13.5 18.22 13.5 18.5V18.72C13.5 19.7 14.3 20.5 15.28 20.5H17.72C18.7 20.5 19.5 19.7 19.5 18.72C19.5 17.93 18.97 17.23 18.21 17.01L14.52 15.96C12.83 15.61 12 14.51 12 13.28C12 11.75 13.25 10.5 14.78 10.5H17.22C18.75 10.5 20 11.75 20 13.28V13.5C20 13.78 19.78 14 19.5 14H19C18.72 14 18.5 13.78 18.5 13.5V13.28C18.5 12.3 17.7 11.5 16.72 11.5H14.28C13.3 11.5 12.5 12.3 12.5 13.28C12.5 14.07 13.03 14.77 13.79 14.99L17.48 16.04C19.17 16.39 20 17.49 20 18.72C20 20.25 18.75 21.5 17.22 21.5ZM16 23.5C15.72 23.5 15.5 23.28 15.5 23V21C15.5 20.72 15.72 20.5 16 20.5C16.28 20.5 16.5 20.72 16.5 21V23C16.5 23.28 16.28 23.5 16 23.5ZM16 11.5C15.72 11.5 15.5 11.28 15.5 11V9C15.5 8.72 15.72 8.5 16 8.5C16.28 8.5 16.5 8.72 16.5 9V11C16.5 11.28 16.28 11.5 16 11.5ZM12.5 26.39C12.44 26.39 12.39 26.38 12.33 26.36C7.95 24.81 5 20.64 5 16C5 11.36 7.95 7.19 12.33 5.64C12.59 5.55 12.87 5.68 12.97 5.94C13.06 6.2 12.93 6.49 12.67 6.58C8.68 7.99 6 11.78 6 16C6 20.22 8.68 24.01 12.67 25.42C12.93 25.51 13.07 25.8 12.97 26.06C12.9 26.26 12.71 26.39 12.5 26.39ZM19.5 26.39C19.29 26.39 19.1 26.26 19.03 26.06C18.93 25.8 19.07 25.51 19.33 25.42C23.32 24.01 26 20.22 26 16C26 11.78 23.32 7.99 19.33 6.58C19.07 6.49 18.94 6.2 19.03 5.94C19.13 5.68 19.41 5.55 19.67 5.64C24.05 7.19 27 11.36 27 16C27 20.64 24.05 24.81 19.67 26.36C19.61 26.38 19.56 26.39 19.5 26.39Z"
                    fill="white"
                />
            </svg>


            <span>Pay {CONFIG.REQUIRED_AMOUNT} USDC Base Network </span>
        </button>

        {/* Display Serial Trigger Status */}
        {isConnected && (
            <p className="text-sm text-emerald-400">
                {/* Status text goes here */}
            </p>
        )}

        {error && (
            <div className="mt-4 text-sm text-red-400 bg-red-900/50 p-3 rounded-lg flex items-center justify-center gap-2">
                <AlertCircle size={18} />
                <span>{error}</span>
            </div>
        )}
    </div>
)}
                

                {/* VIEW: PAYMENT */}
                {view === 'payment' && (
                    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 max-w-sm w-full text-center animate-fade-in-up">
                        <div className="mb-6 flex justify-between items-center text-slate-500">
                            <span className="text-xs font-bold tracking-widest uppercase">Scan to Pay</span>
                            <span className={`text-xs font-mono px-2 py-1 rounded font-bold transition-colors ${timeLeft <= 10 ? 'bg-red-100 text-red-600' : 'bg-slate-100'}`}>
                                Time left: {timeLeft}s
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center mb-6 relative">
                            {/* The Magic QR Code */}
                            <div className={`bg-white p-2 border-2 border-emerald-500 rounded-xl shadow-lg transition-all duration-700 ease-in-out ${timeLeft <= CONFIG.BLUR_THRESHOLD ? 'blur-md opacity-20 pointer-events-none select-none' : ''}`}>
                                <QRCodeSVG 
                                    value={paymentURI}
                                    size={200}
                                    level={"H"}
                                    includeMargin={true}
                                />
                            </div>
                            
                            {timeLeft <= CONFIG.BLUR_THRESHOLD && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-slate-900 font-bold bg-white/80 px-3 py-1 rounded-full text-sm shadow-sm animate-pulse">
                                        Scanning Time Expired!
                                    </span>
                                </div>
                            )}
                        </div>

                        <p className="text-slate-600 font-medium mb-2">
                            Send exactly: <span className="text-emerald-600 font-bold text-lg">{CONFIG.REQUIRED_AMOUNT} USDC</span>
                        </p>
                        <p className="text-xs text-slate-400 mb-6">
                            On Base Mainnet
                        </p>

                        <div className="flex justify-center items-center gap-2 text-emerald-600 animate-pulse text-sm font-semibold mb-6">
                            <RefreshCw size={16} className="animate-spin" />
                            Waiting for transaction...
                        </div>

                        <button
                            onClick={handleReset}
                            className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            Cancel Transaction
                        </button>
                    </div>
                )}

                {/* VIEW: SUCCESS POPUP */}
                {view === 'success' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in">
                        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-emerald-500/30 max-w-md w-full text-center relative overflow-hidden transition-all duration-500 min-h-[400px] flex flex-col justify-center">
                            
                            {/* PHASE 1: CUP ANIMATION */}
                            {successPhase === 'timer' && (
                                <div className="animate-fade-in flex flex-col items-center">
                                    <h2 className="text-3xl font-bold text-white mb-2">Payment Verified!</h2>
                                    <p className="text-emerald-400 text-lg mb-8">
                                        Access Granted
                                        {isConnected && relayIsActive && <span className="text-sm block text-emerald-300/80">Relay Activated for 4s!</span>}
                                        {isConnected && !relayIsActive && <span className="text-sm block text-yellow-300/80">Relay Command Sent.</span>}
                                        {!isConnected && <span className="text-sm block text-red-300/80">Relay **NOT** activated (Arduino disconnected).</span>}
                                    </p>

                                    {/* THE CUP ANIMATION */}
                                    <div className="relative w-24 h-32 border-4 border-white/20 border-t-0 rounded-b-2xl mb-8 overflow-hidden bg-slate-700/50 backdrop-blur-sm">
                                        {/* Liquid filling up */}
                                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-emerald-600 to-emerald-400 animate-fill-cup shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                                        
                                        {/* Cup Glare/Reflection */}
                                        <div className="absolute top-0 right-2 w-2 h-full bg-white/10 rounded-full blur-[1px]"></div>
                                    </div>

                                    <div className="w-full text-center">
                                        <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-1">
                                            Closing in
                                        </p>
                                        <p className="text-2xl font-bold text-white">
                                            {successTimeLeft}s
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* PHASE 2: THANK YOU MESSAGE */}
                            {successPhase === 'message' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in p-6 bg-slate-800 rounded-3xl z-20">
                                    <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-200 mb-4 animate-scale-in">
                                        Here you are!
                                    </h2>
                                    <p className="text-2xl text-emerald-400 font-medium">
                                        Thank you!
                                    </p>
                                </div>
                            )}

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
                    to { transform: translateY(0); }
                }
                @keyframes scale-in {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fill-cup {
                    from { height: 0%; }
                    to { height: 100%; }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out; }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
                .animate-scale-in { animation: scale-in 0.5s ease-out; }
                .animate-fill-cup { animation: fill-cup 10s linear forwards; }
            `}</style>
        </div>
    );
}
