import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const room = body.room || body.roomName || 'default-room';
    const username = body.username || body.participantName || `User-${Math.floor(Math.random() * 1000)}`;

    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://demo.livekit.cloud';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
      ttl: '24h',
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token, room, username, wsUrl });
  } catch (error: any) {
    console.error('[LiveKit Token API] Failed to create token:', error);
    return NextResponse.json({ error: error.message || 'Token generation failed' }, { status: 500 });
  }
}
