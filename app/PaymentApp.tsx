"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Lock, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { sepolia } from 'wagmi/chains';

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
    // Web3 Config
    MERCHANT_ADDRESS: "0x35321cc55704948ee8c79f3c03cd0fcb055a3ac0".toLowerCase(),
    REQUIRED_AMOUNT: 0.0001,
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
    const [relayIsActive, setRelayIsActive] = useState(false); // Track state based on Arduino message

    // Wagmi hooks (We rely on this being fast due to your Vercel config)
    const publicClient = usePublicClient();
    const paymentURI = `ethereum:${CONFIG.MERCHANT_ADDRESS}@${sepolia.id}?value=${parseEther(CONFIG.REQUIRED_AMOUNT.toString()).toString()}`;

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
                setError("Arduino not connected. Please connect the device.");
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const encoder = new TextEncoder();
                const data = encoder.encode(command + "\n");
                await writer.write(data);
                console.log(`[Arduino] Sent command: ${command}`);
            } catch (err) {
                setIsConnected(false);
                setError(err instanceof Error ? err.message : "Failed to send command to Arduino");
            } finally {
                setIsLoading(false);
            }
        },
        [port, writer, isConnected],
    );
    
    // Helper to send the relay command (Simplified to use sendCommand directly)
    // NOTE: This helper is only kept for clarity, though its use is minimal now.
    const operateRelay = useCallback(async () => {
        await sendCommand(CONFIG.RELAY_COMMAND);
    }, [sendCommand]);


    const handlePaymentSuccess = useCallback((hash: string) => { // Added useCallback here for consistency
        setTxHash(hash);
        setView('success');
        setSuccessPhase('timer'); 

        // CRITICAL FIX: Trigger relay directly when audio starts to ensure lowest latency.
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            
            // Define the action to take after audio attempts to play
            const relayAction = () => {
                if (isConnected) {
                    console.log("Payment confirmed. Triggering Arduino relay operation.");
                    sendCommand(CONFIG.RELAY_COMMAND); // Directly call sendCommand
                } else {
                    console.warn("Payment confirmed, but Arduino is not connected. Relay command skipped.");
                }
            };

            if (playPromise !== undefined) {
                playPromise.then(relayAction).catch(error => {
                    console.error("Audio playback failed:", error);
                    // If audio fails to play (common without initial user interaction), still execute the relay action
                    relayAction(); 
                });
            } else {
                // Synchronous playback case
                relayAction();
            }
        }
    }, [isConnected, sendCommand]); // Dependency on sendCommand is correct

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

    // 1. Auto-Connect and Disconnect Listener
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

    // 2. Continuous Serial Data Reader (CRITICAL FIX APPLIED HERE)
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
                            // Only switch if we are on the landing page
                            setView(currentView => currentView === 'landing' ? 'payment' : currentView); 
                        } else if (line === "RELAY_ON_OK") {
                            setRelayIsActive(true);
                        } else if (line === CONFIG.RELAY_OFF_COMMAND) {
                            setRelayIsActive(false);
                        }
                    }
                    
                    // CRITICAL FIX: Yield thread control back to the browser
                    // This allows the browser to process RPC calls and UI updates, 
                    // preventing the Web Serial loop from starving the main thread.
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


    // --- TIMER & WATCHER LOGIC (Proven fast logic) ---

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

    // Initialize the Start Block when entering payment view (Crucial for defining the search window)
    useEffect(() => {
        if (view === 'payment' && publicClient) {
            publicClient.getBlockNumber().then(blockNum => {
                setStartBlock(blockNum);
                console.log(`[Web3] Payment Flow Start Block set to: ${blockNum}`);
            }).catch(e => {
                console.error("Failed to fetch block number on payment start:", e);
                setError("Failed to initialize blockchain connection.");
            });
        }
          if (view !== 'payment') {
              setStartBlock(0n);
        }
    }, [view, publicClient]);


    // The Watcher Logic (Using the publicClient from your fast Vercel config)
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkRecentBlocks = async () => {
            // Only run if we are in payment view AND the startBlock has been initialized
            if (view !== 'payment' || !publicClient || startBlock === 0n) return;

            try {
                const currentBlock = await publicClient.getBlockNumber();
                const requiredValue = parseEther(CONFIG.REQUIRED_AMOUNT.toString());
                
                // Optimized check: Look back 10 blocks or to the start block, whichever is older.
                const maxBlocksToSearch = 10n;
                const minBlockToSearch = currentBlock > maxBlocksToSearch ? currentBlock - maxBlocksToSearch : 0n;

                const searchStartBlock = minBlockToSearch > startBlock ? minBlockToSearch : startBlock;

                for (let i = currentBlock; i >= searchStartBlock; i--) {
                    const block = await publicClient.getBlock({
                        blockNumber: i,
                        includeTransactions: true
                    });

                    const foundTx = block.transactions.find((tx: any) => {
                        const isToMerchant = tx.to?.toLowerCase() === CONFIG.MERCHANT_ADDRESS;
                        const isCorrectAmount = tx.value >= requiredValue; 
                        const isValueTransfer = !tx.input || tx.input === '0x';

                        return isToMerchant && isCorrectAmount && isValueTransfer;
                    });

                    if (foundTx) {
                        console.log(`[Web3 Watcher] Success: Transaction ${foundTx.hash} found in block ${i}`);
                        handlePaymentSuccess(foundTx.hash);
                        return;
                    }
                }

            } catch (error) {
                console.error("Error polling blockchain or fetching blocks:", error);
            }
        };

        if (view === 'payment') {
            // Poll every 3 seconds 
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
                // MODIFICATION: Add 'opacity-0 pointer-events-none' classes when isConnected is true to hide the panel
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
                        {/* Disconnect Button (Hidden by the parent div's class when connected, but keeping original logic for completeness) */}
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
                            ETHEREUM Sepolia
                        </h1>

                        <button
                            onClick={() => setView('payment')}
                            // MODIFICATION: Updated classes for black background, emerald-500 text, emerald-500 border, and no shadow.
                            className="group relative px-8 py-4 bg-black border border-emerald-500 hover:bg-emerald-900 text-emerald-500 rounded-xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95"
                        >
                            <span>Pay {CONFIG.REQUIRED_AMOUNT} ETH</span>
                        </button>
                        
                        {/* Display Serial Trigger Status */}
                        {isConnected && (

 <p className="text-sm text-emerald-400">
                                
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
