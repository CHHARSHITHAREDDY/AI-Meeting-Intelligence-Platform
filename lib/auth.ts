import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-cue-secret-key-18392182-please-change-in-env';

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str: string): string {
  // Add padding back if necessary
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

export function signToken(payload: any): string {
  const header = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64urlEncode(Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiry
  })));
  const signature = base64urlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = base64urlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  if (signature !== expectedSig) return null;
  
  try {
    const decodedBody = base64urlDecode(body);
    const payload = JSON.parse(decodedBody);
    
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.log('[Auth] Token expired');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('[Auth] Token parsing failed:', error);
    return null;
  }
}

export async function getSessionUser(): Promise<{ userId: string; email: string; name: string } | null> {
  try {
    const { cookies } = require('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch (error) {
    console.error('[Auth] getSessionUser failed:', error);
    return null;
  }
}

