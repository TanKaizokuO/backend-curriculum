// A stub resolver with its own cache, keyed by TTL.
//
// The Python twin is caching_resolver.py — same cache shape, same
// expiry math. Recognition, not new material.
//
//   node cachingResolver.ts bookmarks-api.local

import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_PORT = 5301;
const CACHE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "resolverCache.json",
);

function encodeName(name: string): Buffer {
  const parts: Buffer[] = [];
  for (const label of name.split(".")) {
    parts.push(Buffer.from([label.length]), Buffer.from(label, "ascii"));
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function buildQuery(name: string): Buffer {
  const header = Buffer.from([0x12, 0x34, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0]);
  const question = Buffer.concat([encodeName(name), Buffer.from([0, 1, 0, 1])]);
  return Buffer.concat([header, question]);
}

async function queryAuthoritative(name: string): Promise<{ ip: string; ttl: number }> {
  const socket = dgram.createSocket("udp4");
  const response = await new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), 2000);
    socket.once("message", (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    socket.send(buildQuery(name), SERVER_PORT, "127.0.0.1");
  });
  socket.close();
  const ancount = response.readUInt16BE(6);
  if (ancount === 0) throw new Error(`NXDOMAIN: ${name}`);
  let offset = 12;
  while (response[offset] !== 0) offset += response[offset] + 1;
  offset += 1 + 4; // end of question name + qtype/qclass
  offset += 2; // compression pointer in the answer's name
  const ttl = response.readUInt32BE(offset + 4);
  const rdlength = response.readUInt16BE(offset + 8);
  offset += 10;
  const ip = Array.from(response.subarray(offset, offset + rdlength)).join(".");
  return { ip, ttl };
}

function loadCache(): Record<string, { ip: string; expiresAt: number }> {
  if (fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  return {};
}

function saveCache(cache: Record<string, { ip: string; expiresAt: number }>): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

async function resolve(name: string): Promise<string> {
  const cache = loadCache();
  const now = Date.now() / 1000;
  const entry = cache[name];
  if (entry && entry.expiresAt > now) {
    const remaining = entry.expiresAt - now;
    console.log(`cache hit: ${name} -> ${entry.ip} (${remaining.toFixed(1)}s left on TTL)`);
    return entry.ip;
  }
  const { ip, ttl } = await queryAuthoritative(name);
  cache[name] = { ip, expiresAt: now + ttl };
  saveCache(cache);
  console.log(`cache miss: queried authoritative, ${name} -> ${ip} (ttl=${ttl}s)`);
  return ip;
}

resolve(process.argv[2]);
