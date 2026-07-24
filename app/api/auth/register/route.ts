import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createUser, getUserByEmail } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email.toLowerCase().trim());
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const passwordHash = hashPassword(password);

    // Create user in DB
    await createUser(userId, email.toLowerCase().trim(), passwordHash, name.trim());

    // Generate JWT
    const token = signToken({ userId, email: email.toLowerCase().trim(), name: name.trim() });

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: { id: userId, email, name }
    });

    response.cookies.set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('[Register API] Error:', error);
    return NextResponse.json({ error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}
