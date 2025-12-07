<img width="1265" height="923" alt="waterDispenser" src="https://github.com/user-attachments/assets/f1592919-1b37-4e09-bb63-1830c6f24d35" />



💧 Crypto Water Dispenser (USDC on Base Sepolia)
A decentralized vending machine application. 
This project bridges the gap between blockchain payments and physical hardware using the Web Serial API.

It detects USDC payments on Base Sepolia, triggers an Arduino Leonardo to dispense exactly 250ml of water,
and mints a "Shadow Receipt" NFT to the merchant's vault for on-chain loyalty tracking and future user rewards.



Key Features

1.Instantly converts on-chain payments into physical actions (dispensing water).

2. Direct communication between the Chrome Browser and Arduino Leonardo without backend servers (Client-side logic).

3. Real-time monitoring of the Base Sepolia blockchain for incoming transactions.

4. Mints an NFT receipt to the merchant containing the payer's data. This creates an on-chain ledger for cashback programs or "Random Rewards" without cluttering the user's wallet.

5. React-based interface with QR code generation, payment timers, and fluid success animations.
   

🛠 Tech Stack

Frontend: React, Tailwind CSS, Lucide React

Blockchain: Wagmi, Viem (Base Sepolia Chain)

Hardware Interface: Web Serial API (Native Browser Support)

Device: Arduino Leonardo


🔄 Application Workflow

Landing

The app displays a "Pay 0.5 USDC" button. It waits for user interaction via the touchscreen or a physical button connected to the Arduino (sending BUTTON_4_PRESSED).

Payment Phase

A QR Code is generated with the specific USDC transfer URI.

The app begins polling the blockchain for a transfer of 0.5 USDC to the configured MERCHANT_ADDRESS.

Verification

Once a valid transaction hash is detected on Base Sepolia, the payment is confirmed.

Dispense

 The app sends the RELAY_ON command to the Arduino via USB. The Arduino activates the water pump relay.

 The app calls mintReceiptNFT. A "Shadow Receipt" is minted to the Merchant's address, recording the Payer's address for future loyalty rewards.

 A success sound plays (alert.wav) and a "filling cup" animation displays on screen.



 🔌 Hardware Requirements & Setup
1. The Hardware
2. 
Microcontroller: Arduino Leonardo .

5V Relay Module controlling a 12V Water Pump.

mini USB Cable to the PC.

![hardware](https://github.com/user-attachments/assets/27e1b076-a87e-4312-bde8-3e9f072e47c1)





2. The Arduino Sketch (Protocol)
Your Arduino must be programmed to handle the following serial protocol at 9600 Baud:

Receiving:

RELAY_ON: Turn on the pump relay.

RELAY_AUTO_OFF: (Optional) Turn off relay if handled via software signal.

Sending:

BUTTON_4_PRESSED: Triggers the UI to move from Landing to Payment view.

RELAY_ON_OK: Confirms relay activation.



<img width="848" height="1203" alt="sketch" src="https://github.com/user-attachments/assets/110735ef-73b0-4300-b677-efffae141826" />



Browser Setup:

Open the app in Google Chrome or Microsoft Edge.

Important: Web Serial requires a secure context (HTTPS) or localhost.

Click "Connect USB" in the top right corner to pair your Arduino Leonardo.

⚙️ Configuration (CONFIG Object)

You can modify the CONFIG object in PaymentApp.tsx to change pricing or addresses:

const CONFIG = {
    MERCHANT_ADDRESS: "0x...", // Where money goes & where NFTs are stored
    USDC_CONTRACT_ADDRESS: "0x...", // USDC on Base Sepolia
    REQUIRED_AMOUNT: 0.5, // Cost of water
    PAYMENT_TIMEOUT: 50, // Seconds before reset
    BAUD_RATE: 9600, // Serial speed
};


⚠️ Troubleshooting

"Web Serial API not supported": Ensure you are using Chrome/Edge. Firefox and Safari do not support this API yet.

Arduino not connecting: Check if another app (like Arduino IDE) is hogging the COM port. The browser needs exclusive access.

Payment not detected: Ensure the user is sending Base Sepolia USDC, not native ETH, and the amount matches REQUIRED_AMOUNT exactly.


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

