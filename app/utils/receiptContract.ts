export const RECEIPT_CONTRACT_ADDRESS = "0x321Cc74a09Fad266D74fA62C442a0787Fda3c210";

export const RECEIPT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_merchantAddress", "type": "address" },
      { "internalType": "address", "name": "_payer", "type": "address" },
      { "internalType": "uint256", "name": "_timestamp", "type": "uint256" }
    ],
    "name": "mintReceipt",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
