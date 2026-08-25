/**
 * The TypeScript twin of `Code/Lesson_8_code/security.py`.
 *
 * Same two jobs: hash a password with bcrypt, sign a token with HMAC-SHA256.
 * Same rule about the algorithm list. One difference matters, and the lesson
 * spends a section on it:
 *
 *     bcrypt.hashSync  runs on the event loop and stops every other request
 *     bcrypt.hash      runs in the libuv thread pool and does not
 *
 * Run `node src/security.ts` to see this file check itself.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import { config } from './config.ts';

// --------------------------------------------------------------------------
// Passwords
// --------------------------------------------------------------------------

/** bcrypt reads at most 72 bytes of the password and ignores the rest. */
export const MAX_PASSWORD_BYTES = 72;

function clamp(password: string): Buffer {
  return Buffer.from(password, 'utf8').subarray(0, MAX_PASSWORD_BYTES);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(clamp(password), config.bcryptRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(clamp(password), hash);
  } catch {
    return false;
  }
}

/**
 * An unknown email must cost the same as a known one. Without this hash the
 * login route answers a missing account in a few milliseconds and a wrong
 * password in about 190 ms, and the difference lists your users.
 */
export const DUMMY_HASH = bcrypt.hashSync(
  'this password belongs to nobody',
  config.bcryptRounds,
);

export async function wasteTimeLikeARealLogin(): Promise<void> {
  await verifyPassword('wrong', DUMMY_HASH);
}

// --------------------------------------------------------------------------
// Sessions
// --------------------------------------------------------------------------

/**
 * 32 bytes from the operating system CSPRNG, hex encoded.
 * Never use Math.random(). It is predictable, and a predictable session id
 * is a login for a stranger.
 */
export function newSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// --------------------------------------------------------------------------
// Tokens, by hand
// --------------------------------------------------------------------------

export class TokenError extends Error {}

export interface Claims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export function b64urlEncode(raw: Buffer | string): string {
  return Buffer.from(raw).toString('base64url');
}

export function b64urlDecode(text: string): Buffer {
  return Buffer.from(text, 'base64url');
}

function sign(message: string): string {
  return crypto.createHmac('sha256', config.secretKey).update(message).digest('base64url');
}

export function issueToken(userId: number, email: string, ttlSeconds?: number): string {
  const ttl = ttlSeconds ?? config.tokenTtlSeconds;
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlEncode(
    JSON.stringify({ sub: String(userId), email, iat: now, exp: now + ttl }),
  );
  const message = `${header}.${payload}`;
  return `${message}.${sign(message)}`;
}

export function verifyToken(token: string): Claims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenError('a token has three parts');
  const [part1, part2, part3] = parts as [string, string, string];

  // timingSafeEqual, not ===. A plain comparison stops at the first wrong
  // byte, and the time it takes leaks the correct prefix.
  const expected = Buffer.from(sign(`${part1}.${part2}`));
  const given = Buffer.from(part3);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    throw new TokenError('bad signature');
  }

  let header: { alg?: string };
  let claims: Claims;
  try {
    header = JSON.parse(b64urlDecode(part1).toString());
    claims = JSON.parse(b64urlDecode(part2).toString());
  } catch {
    throw new TokenError('bad encoding');
  }

  // Read the algorithm from your own list, never from the token.
  if (header.alg !== 'HS256') throw new TokenError('unexpected algorithm');
  if (claims.exp < Date.now() / 1000) throw new TokenError('expired');

  return claims;
}

// --------------------------------------------------------------------------
// The same thing, with the library
// --------------------------------------------------------------------------

export function issueTokenJsonwebtoken(userId: number, email: string): string {
  return jwt.sign({ sub: String(userId), email }, config.secretKey, {
    algorithm: 'HS256',
    expiresIn: config.tokenTtlSeconds,
  });
}

export function verifyTokenJsonwebtoken(token: string): Claims {
  try {
    return jwt.verify(token, config.secretKey, { algorithms: ['HS256'] }) as Claims;
  } catch (error) {
    throw new TokenError(error instanceof Error ? error.message : 'invalid');
  }
}

if (import.meta.filename === process.argv[1]) {
  const mine = issueToken(7, 'ada@example.com');
  const theirs = issueTokenJsonwebtoken(7, 'ada@example.com');
  console.log('hand written:', mine);
  console.log('jsonwebtoken:', theirs);
  console.log('same bytes  :', mine === theirs);
  console.log('my verifier reads the library token:', verifyToken(theirs).email);
  console.log('the library reads my token         :', verifyTokenJsonwebtoken(mine).email);
}
