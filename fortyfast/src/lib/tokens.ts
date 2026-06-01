import { customAlphabet, nanoid } from 'nanoid';
import { SignJWT, jwtVerify } from 'jose';

// Readable slug: lowercase alphanumeric, no ambiguous chars
const slugAlphabet = '23456789abcdefghjkmnpqrstuvwxyz';
export const newPublicSlug = customAlphabet(slugAlphabet, 10);

// Access codes: human-readable, uppercase letters/numbers, no ambiguous chars
const codeAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const newAccessCode = customAlphabet(codeAlphabet, 8);

// Magic token for participant edit/share link
export const newMagicToken = () => nanoid(32);

// Experience email reply token — stable but unguessable. Stored as part of the signup's magicToken
// or generated separately if you want to rotate. For simplicity, we sign with JWT here.
const SECRET = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'dev-secret');

export async function signExperienceToken(signupId: string): Promise<string> {
  return await new SignJWT({ sid: signupId, kind: 'exp' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(SECRET());
}

export async function verifyExperienceToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET());
    if (payload.kind !== 'exp' || typeof payload.sid !== 'string') return null;
    return payload.sid;
  } catch {
    return null;
  }
}
