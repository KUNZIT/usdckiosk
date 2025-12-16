
<img width="1077" height="943" alt="waterdispenser" src="https://github.com/user-attachments/assets/ac56b5cf-d87d-47f7-8e46-c44f4f1ab29c" />





💧 Crypto Water Dispenser 

A decentralized vending machine application.

This project bridges the gap between blockchain payments and physical hardware using the Web Serial API.

It detects USDC payments on Base Mainnet Network , triggers an Arduino Leonardo to dispense exactly 250ml of water,
and mints a "Shadow Receipt" NFT to the merchant's vault for on-chain loyalty tracking and future user rewards.

[Launch app](https://usdckiosk.vercel.app/)

Key Features

1. Instantly converts on-chain payments into physical actions (dispensing water).

2. Direct communication between the Chrome Browser and Arduino Leonardo.

3. Real-time monitoring of the Base blockchain for incoming transactions.

4. Mints an NFT receipt to the merchant address containing the payer's data. This creates an on-chain ledger for cashback programs or "Random Rewards" without cluttering the user's wallet.

5. React-based interface with QR code generation, payment timers, and fluid success animations.
   

🛠 Tech Stack

Frontend: React, Tailwind CSS, Lucide React

Blockchain: Wagmi, Viem (Base Chain)

Hardware Interface: Web Serial API (Native Browser Support)

Device: Arduino Leonardo


🔄 Application Workflow

Landing

The app displays a "Pay 0.5 USDC" button. It waits for user interaction via the touchscreen or a physical button connected to the Arduino (sending BUTTON_4_PRESSED).

Payment Phase

A QR Code is generated with the specific USDC transfer URI.

The app begins polling the blockchain for a transfer of 0.5 USDC to the configured MERCHANT_ADDRESS.

Verification

Once a valid transaction hash is detected on Base Network, the payment is confirmed.

Dispense

 The app sends the RELAY_ON command to the Arduino via USB. The Arduino activates the water pump relay.

 The app calls mintReceiptNFT. A "Shadow Receipt" is minted to the Merchant's address, recording the Payer's address for future loyalty rewards.

 A success sound plays (alert.wav) and a "filling cup" animation displays on screen.



 🔌 Hardware Requirements & Setup

Microcontroller: Arduino Leonardo.

5V Relay Module controlling a 12V Water Pump.

Infrared sensor "Flying Fish"

mini USB Cable to the PC.

![hardware](https://github.com/user-attachments/assets/4c17f278-75bf-4c1b-9b99-49140002c894)





# The Arduino Sketch
   
Your Arduino must be programmed to handle the following serial protocol at 9600 Baud:

<img width="658" height="1141" alt="sketch" src="https://github.com/user-attachments/assets/836d0915-797f-4840-8e34-57befbafbf3e" />




Upload via Arduino IDE : 

[sketch](https://github.com/KUNZIT/bkiosk/blob/main/public/sketch.ino)

Browser Setup:

Open the app in Google Chrome or Microsoft Edge.

Important: Web Serial requires a secure context (HTTPS) or localhost.

Click "Connect USB" in the top right corner to pair your Arduino Leonardo.

⚙️ Configuration (CONFIG Object)

You can modify the CONFIG object in PaymentApp.tsx to change pricing or addresses:

const CONFIG = {

    MERCHANT_ADDRESS: "0x...", // Where money goes & where NFTs are stored
    
    USDC_CONTRACT_ADDRESS: "0x...", // USDC on Base Mainnet
    
    REQUIRED_AMOUNT: 0.5, // Cost of water
    
};


⚠️ Troubleshooting

"Web Serial API not supported": Ensure you are using Chrome/Edge. Firefox and Safari do not support this API yet.

Arduino not connecting: Check if another app (like Arduino IDE) is hogging the COM port. The browser needs exclusive access.

Payment not detected: Ensure the user is sending Base USDC, not native ETH, and the amount matches REQUIRED_AMOUNT exactly.


## How to Use our Crypto-enabled Water Dispenser

Dear Customers,

Thank you for choosing our crypto payment method!
Please follow these steps to get your drinking water

1.  Preparation
   
Open your crypto wallet (e.g., MetaMask, Coinbase Wallet) on the Base Mainnet.

Ensure you have the following minimum amounts:
•  0.5 USDC (on Base network)
•  Ethereum (ETH) for gas fees (on Base network)

2. Dispensing Process (Must be completed in 50 seconds)
•  Put your paper cup into the dispenser tray.
•  A QR code will immediately appear on the display.
•  Open the scanning camera in your crypto wallet.
•  Scan the QR code quickly.
•  A transaction request will appear in your wallet.
•  Crucially, confirm that you are transferring EXACTLY 0.5 USDC on the Base Network. (Payments for any other amount will not dispense water.)

3.  Complete & Collect
•  Wait for the on-screen message: "Here you are".
•  Take your cup with water away from the dispenser tray.

⚠️ Important Note on Timing
•  The application session duration is 50 seconds. Please be quick to scan the QR code and confirm the transaction in your wallet.
•  In case the session expires, or if you experience a network delay and the water is not dispensed after your payment is confirmed, please contact us immediately for a refund.

Thank you for using our drinking water dispenser!


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

