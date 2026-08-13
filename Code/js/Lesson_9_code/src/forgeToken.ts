/**
 * The TypeScript twin of `Code/Lesson_8_code/forge_token.py`.
 *
 *     node src/forgeToken.ts
 *
 * Four attacks. Two succeed against the naive server, and both fail against
 * the signed one. The TypeScript type system does not stop any of them: a
 * forged token is a well-typed string.
 */

import { setTimeout as sleep } from 'node:timers/promises';

import {
  TokenError,
  b64urlDecode,
  b64urlEncode,
  issueToken,
  verifyToken,
} from './security.ts';

function rule(title: string): void {
  console.log(`\n=== ${title} ${'='.repeat(Math.max(0, 62 - title.length))}`);
}

// The naive server. It encodes the claims and calls the result a token.
const naiveIssue = (claims: unknown): string =>
  Buffer.from(JSON.stringify(claims)).toString('base64url');
const naiveVerify = (token: string): unknown =>
  JSON.parse(Buffer.from(token, 'base64url').toString());

// ------------------------------------------------------------------ 1 ---
rule('Attack 1 · edit an unsigned token');
const honest = naiveIssue({ sub: '2', email: 'mallory@example.com', admin: false });
console.log('the server gave Mallory:', honest);
console.log('the server reads       :', naiveVerify(honest));

const stolen = naiveVerify(honest) as Record<string, unknown>;
stolen.sub = '1';
stolen.email = 'ada@example.com';
stolen.admin = true;
const forged = naiveIssue(stolen);

console.log('\nMallory sends back    :', forged);
console.log('the server reads      :', naiveVerify(forged));
console.log('\nThe server believes it. Mallory is now Ada, and Ada is an admin.');
console.log('Nothing crashed. No log line looks wrong.');

// ------------------------------------------------------------------ 2 ---
rule('Attack 2 · edit a signed token');
const real = issueToken(2, 'mallory@example.com');
console.log('the server gave Mallory:', real);
console.log('the server reads       :', verifyToken(real));

const [header, payload, signature] = real.split('.') as [string, string, string];
const claims = JSON.parse(b64urlDecode(payload).toString()) as Record<string, unknown>;
claims.sub = '1';
claims.email = 'ada@example.com';
const tampered = `${header}.${b64urlEncode(JSON.stringify(claims))}.${signature}`;

console.log('\nMallory sends back    :', tampered);
try {
  verifyToken(tampered);
} catch (error) {
  if (error instanceof TokenError) console.log('the server answers    : TokenError:', error.message);
}
console.log('\nThe payload changed. The signature did not, and it cannot,');
console.log('because Mallory does not hold SECRET_KEY.');

// ------------------------------------------------------------------ 3 ---
rule('Attack 3 · tell the server that there is no algorithm');
const noneHeader = b64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
const noneClaims = b64urlEncode(JSON.stringify({ sub: '1', email: 'ada@example.com' }));
const algNone = `${noneHeader}.${noneClaims}.`;
console.log('Mallory sends         :', algNone);
console.log(
  'a verifier that trusts the header reads:',
  JSON.parse(b64urlDecode(algNone.split('.')[1] as string).toString()),
);
try {
  verifyToken(algNone);
} catch (error) {
  if (error instanceof TokenError) console.log('our verifier answers  : TokenError:', error.message);
}
console.log('\nThe rule: the list of accepted algorithms belongs to the server.');
console.log('Never read it out of the token that you are checking.');

// ------------------------------------------------------------------ 4 ---
rule('Attack 4 · use a token after it expires');
const short = issueToken(2, 'mallory@example.com', 1);
console.log('issued with a life of one second');
console.log('now                   :', verifyToken(short).email);
await sleep(1100);
try {
  verifyToken(short);
} catch (error) {
  if (error instanceof TokenError) console.log('1.1 seconds later     : TokenError:', error.message);
}

// ------------------------------------------------------------------ 5 ---
rule('A token is not a secret box');
console.log('Anybody can read the claims. No key is needed:');
console.log(' ', JSON.parse(b64urlDecode(real.split('.')[1] as string).toString()));
console.log('\nA signature proves who wrote the claims.');
console.log('It does not hide them. Never put a secret in a token.');
