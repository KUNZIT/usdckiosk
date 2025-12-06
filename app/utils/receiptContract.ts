export const RECEIPT_CONTRACT_ADDRESS = "0x283e8b9129f60093aEcb16C7B7A596316a18DCbb";

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
