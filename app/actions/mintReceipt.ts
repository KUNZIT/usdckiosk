"use server";

import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { RECEIPT_CONTRACT_ADDRESS, RECEIPT_ABI } from '../utils/receiptContract'; // Adjust path if needed

export async function mintReceiptAction(merchantAddress: string, payerAddress: string) {
    // 1. Get Private Key (Server Side Only)
    const privateKey = process.env.HOT_WALLET_PRIVATE_KEY;
    const rpcUrl = process.env.INFURA_RPC_URL; // Use the variable we fixed earlier!

    if (!privateKey || !rpcUrl) {
        console.error("Server Config Error: Missing Key or RPC");
        return { success: false, error: "Server Configuration Error" };
    }

    try {
        const account = privateKeyToAccount(privateKey as `0x${string}`);

        // 2. Setup Wallet Client (Server Side)
        const walletClient = createWalletClient({
            account,
            chain: base,
            transport: http(rpcUrl) // Use Infura directly since we are on the server
        }).extend(publicActions);

        console.log(`[Server Mint] Minting for ${payerAddress}...`);

        const timestamp = Math.floor(Date.now() / 1000);

        // 3. Simulate Transaction (Check for errors before sending)
        const { request } = await walletClient.simulateContract({
            address: RECEIPT_CONTRACT_ADDRESS as `0x${string}`,
            abi: RECEIPT_ABI,
            functionName: 'mintReceipt',
            args: [merchantAddress as `0x${string}`, payerAddress as `0x${string}`, BigInt(timestamp)],
        });

        // 4. Execute Transaction
        const hash = await walletClient.writeContract(request);

        console.log(`[Server Mint] Success: ${hash}`);
        return { success: true, hash };

    } catch (error) {
        console.error("[Server Mint] Failed:", error);
        // Return a clean error object, don't throw, so the UI doesn't crash
        return { success: false, error: "Minting failed" };
    }
}
