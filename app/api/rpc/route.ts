import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. Get the private key from server environment
  // Make sure you renamed this in your .env file to remove NEXT_PUBLIC_
  const rpcUrl = process.env.INFURA_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json({ error: 'RPC URL not configured' }, { status: 500 });
  }

  try {
    // 2. Get the body from the Wagmi request
    const body = await request.json();

    // 3. Send the request to Infura
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // 4. Return Infura's response back to Wagmi
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Error fetching from RPC provider' }, { status: 500 });
  }
}
