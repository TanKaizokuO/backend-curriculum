// A one-record authoritative DNS server, on UDP, no library.
//
// The Python twin is toy_dns_server.py — same protocol, same zone.json,
// read fresh on every query. Recognition, not new material.
//
//   node toyDnsServer.ts

import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ZONE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "zone.json");
const LISTEN_PORT = 5301;

function readQuestionName(packet: Buffer): [string, number] {
  const labels: string[] = [];
  let offset = 12;
  for (;;) {
    const length = packet[offset];
    if (length === 0) {
      offset += 1;
      break;
    }
    offset += 1;
    labels.push(packet.subarray(offset, offset + length).toString("ascii"));
    offset += length;
  }
  return [labels.join("."), offset];
}

function buildAnswer(query: Buffer, ip: string, ttl: number): Buffer {
  const id = query.subarray(0, 2);
  const flags = Buffer.from([0x81, 0x80]);
  const counts = Buffer.from([0, 1, 0, 1, 0, 0, 0, 0]);
  const question = query.subarray(12);
  const rdata = Buffer.from(ip.split(".").map(Number));
  const answerHeader = Buffer.alloc(10);
  answerHeader.writeUInt16BE(1, 0); // TYPE A
  answerHeader.writeUInt16BE(1, 2); // CLASS IN
  answerHeader.writeUInt32BE(ttl, 4);
  answerHeader.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([
    id,
    flags,
    counts,
    question,
    Buffer.from([0xc0, 0x0c]), // pointer back to the question's name
    answerHeader,
    rdata,
  ]);
}

function buildNxdomain(query: Buffer): Buffer {
  const id = query.subarray(0, 2);
  const flags = Buffer.from([0x81, 0x83]); // rcode 3
  const counts = Buffer.from([0, 1, 0, 0, 0, 0, 0, 0]);
  return Buffer.concat([id, flags, counts, query.subarray(12)]);
}

const socket = dgram.createSocket("udp4");
socket.on("message", (query, remote) => {
  const [name] = readQuestionName(query);
  const zone = JSON.parse(fs.readFileSync(ZONE_FILE, "utf8"));
  if (name.toLowerCase() === zone.name.toLowerCase()) {
    socket.send(buildAnswer(query, zone.ip, zone.ttl), remote.port, remote.address);
    console.log(`answer ${name} -> ${zone.ip} ttl=${zone.ttl}`);
  } else {
    socket.send(buildNxdomain(query), remote.port, remote.address);
    console.log(`NXDOMAIN ${name}`);
  }
});
socket.bind(LISTEN_PORT, "127.0.0.1", () => {
  console.log(`toy authoritative server listening on 127.0.0.1:${LISTEN_PORT}`);
});
