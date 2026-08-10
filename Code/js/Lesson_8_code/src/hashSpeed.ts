/**
 * The TypeScript twin of `Code/Lesson_8_code/hash_speed.py`.
 *
 *     node src/hashSpeed.ts
 *
 * Same four steps, same word list, same conclusion. Compare the guess rates
 * with the Python run. The language does not change the answer, because
 * bcrypt is the same C code in both.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { config } from './config.ts';

const WORDLIST = path.join(import.meta.dirname, '..', 'wordlist.txt');

const ACCOUNTS: ReadonlyArray<readonly [string, string]> = [
  ['ada@example.com', 'hunter2'],
  ['alan@example.com', 'letmein'],
  ['grace@example.com', 'hunter2'],
  ['edsger@example.com', 'correcthorse'],
  ['barbara@example.com', 'trustno1'],
];

function rule(title: string): void {
  console.log(`\n=== ${title} ${'='.repeat(Math.max(0, 62 - title.length))}`);
}

const words = fs.readFileSync(WORDLIST, 'utf8').split('\n').filter(Boolean);
console.log(`word list: ${words.length} passwords`);
console.log(`bcrypt rounds: ${config.bcryptRounds}`);

// ------------------------------------------------------------------ 1 ---
rule('The leak, as SHA-256');
const shaTable = ACCOUNTS.map(
  ([email, password]) =>
    [email, crypto.createHash('sha256').update(password).digest('hex')] as const,
);
for (const [email, digest] of shaTable) console.log(email.padEnd(22), digest);
console.log('\nAda and Grace never told each other their password.');
console.log('The table tells you they share one.');

rule('The same leak, as bcrypt');
const bcryptTable = ACCOUNTS.map(
  ([email, password]) => [email, bcrypt.hashSync(password, config.bcryptRounds)] as const,
);
for (const [email, digest] of bcryptTable) console.log(email.padEnd(22), digest);
console.log('\nThe same two passwords now look unrelated. The salt did that.');

// ------------------------------------------------------------------ 2 ---
rule('Crack the SHA-256 table');
let start = performance.now();
const index = new Map(
  words.map((word) => [crypto.createHash('sha256').update(word).digest('hex'), word]),
);
const cracked = shaTable
  .map(([email, digest]) => [email, index.get(digest)] as const)
  .filter((pair): pair is readonly [string, string] => pair[1] !== undefined);
const shaMs = performance.now() - start;
for (const [email, password] of cracked) console.log(email.padEnd(22), password);
console.log(`\n${cracked.length} of ${ACCOUNTS.length} accounts in ${shaMs.toFixed(2)} ms`);

// ------------------------------------------------------------------ 3 ---
rule('Attack the bcrypt table with the same word list');
start = performance.now();
const found: Array<readonly [string, string]> = [];
for (const [email, digest] of bcryptTable) {
  for (const word of words) {
    if (bcrypt.compareSync(word, digest)) {
      found.push([email, word]);
      break;
    }
  }
}
const bcryptSeconds = (performance.now() - start) / 1000;
for (const [email, password] of found) console.log(email.padEnd(22), password);
console.log(`\n${found.length} of ${ACCOUNTS.length} accounts in ${bcryptSeconds.toFixed(1)} s`);
console.log(
  `slower by ${Math.round((bcryptSeconds * 1000) / shaMs).toLocaleString('en-US')}x for the same result`,
);
console.log('Note the result. bcrypt does not save a password that is on the list.');

// ------------------------------------------------------------------ 4 ---
rule('Guess rate of each function');
const sample = 'correct horse battery staple';

start = performance.now();
for (let i = 0; i < 200_000; i += 1) crypto.createHash('sha256').update(sample).digest('hex');
const shaRate = 200_000 / ((performance.now() - start) / 1000);

const salt = bcrypt.genSaltSync(config.bcryptRounds);
start = performance.now();
for (let i = 0; i < 10; i += 1) bcrypt.hashSync(sample, salt);
const bcryptRate = 10 / ((performance.now() - start) / 1000);

const space = 26 ** 8; // every lower-case password of eight letters
const fixed0 = { maximumFractionDigits: 0 };
console.log(`SHA-256 : ${shaRate.toLocaleString('en-US', fixed0).padStart(15)} guesses/second, one CPU core`);
console.log(`bcrypt  : ${bcryptRate.toLocaleString('en-US', fixed0).padStart(15)} guesses/second, one CPU core`);
console.log(`ratio   : ${(shaRate / bcryptRate).toLocaleString('en-US', fixed0).padStart(15)}x`);
console.log(`\nA password of eight lower-case letters: ${space.toLocaleString('en-US')} possibilities.`);
console.log(`SHA-256 : ${(space / shaRate / 3600).toFixed(1)} hours on this one core`);
console.log(`bcrypt  : ${(space / bcryptRate / 31_557_600).toLocaleString('en-US', fixed0)} years on this one core`);
console.log('\nA real attacker owns a GPU farm, not one core of a laptop.');
console.log('The ratio is what matters, and the ratio does not change.');
