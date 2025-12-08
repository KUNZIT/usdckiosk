import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  
  const rpcUrl = process.env.INFURA_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json({ error: 'RPC URL not configured' }, { status: 500 });
  }

  try {
    
    const body = await request.json();

    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Error fetching from RPC provider' }, { status: 500 });
  }
}
