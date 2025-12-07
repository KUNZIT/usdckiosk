import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { RECEIPT_CONTRACT_ADDRESS, RECEIPT_ABI } from './receiptContract';

// 1. Setup the Hot Wallet Account
const privateKey = process.env.NEXT_PUBLIC_HOT_WALLET_PRIVATE_KEY as `0x${string}`;
const account = privateKey ? privateKeyToAccount(privateKey) : null;

// 2. Setup the Client
const walletClient = account 
  ? createWalletClient({
      account,
      chain: base,
      transport: http()
    }).extend(publicActions)
  : null;

export const mintReceiptNFT = async (
    merchantAddress: string, 
    payerAddress: string
) => {
    if (!walletClient || !account) {
        console.error("Hot Wallet not configured properly.");
        return;
    }

    try {
        console.log(`[Minting] Minting receipt for ${payerAddress} to merchant ${merchantAddress}...`);
        
        const timestamp = Math.floor(Date.now() / 1000);

        const { request } = await walletClient.simulateContract({
            address: RECEIPT_CONTRACT_ADDRESS as `0x${string}`,
            abi: RECEIPT_ABI,
            functionName: 'mintReceipt',
            args: [merchantAddress as `0x${string}`, payerAddress as `0x${string}`, BigInt(timestamp)],
        });

        const hash = await walletClient.writeContract(request);
        
        console.log(`[Minting] Success! Tx Hash: ${hash}`);
        return hash;

    } catch (error) {
        console.error("[Minting] Failed to mint receipt:", error);
        // We do NOT throw here, because we don't want to stop the water dispenser 
        // if the NFT minting fails (e.g., out of gas).
    }
};
