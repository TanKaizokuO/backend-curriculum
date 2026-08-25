// A DNS query, built on the wire, with no library that hides the packet.
//
// The Python twin is dns_query.py — read it first; this is recognition,
// not new material. Same header, same length-prefixed labels, same
// compression pointers, over Node's `dgram` socket instead of Python's.
//
//   node dnsQuery.ts example.com A
//   node dnsQuery.ts example.com AAAA --server 1.1.1.1
//   node dnsQuery.ts www.github.com CNAME
//   node dnsQuery.ts google.com MX
//   node dnsQuery.ts example.com TXT

import dgram from "node:dgram";

const TYPES: Record<string, number> = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };
const TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(TYPES).map(([k, v]) => [v, k]),
);

function encodeName(name: string): Buffer {
  const parts: Buffer[] = [];
  for (const label of name.replace(/\.$/, "").split(".")) {
    parts.push(Buffer.from([label.length]), Buffer.from(label, "ascii"));
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function buildQuery(name: string, qtype: number): Buffer {
  const id = Math.floor(Math.random() * 0xffff);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x0100, 2); // RD = 1
  header.writeUInt16BE(1, 4); // 1 question
  const question = Buffer.concat([encodeName(name), Buffer.alloc(4)]);
  question.writeUInt16BE(qtype, question.length - 4);
  question.writeUInt16BE(1, question.length - 2); // class IN
  return Buffer.concat([header, question]);
}

function readName(packet: Buffer, offset: number): [string, number] {
  const labels: string[] = [];
  let jumped = false;
  let endOffset = offset;
  for (;;) {
    const length = packet[offset];
    if ((length & 0xc0) === 0xc0) {
      const pointer = packet.readUInt16BE(offset) & 0x3fff;
      if (!jumped) {
        endOffset = offset + 2;
        jumped = true;
      }
      offset = pointer;
      continue;
    }
    if (length === 0) {
      offset += 1;
      if (!jumped) endOffset = offset;
      break;
    }
    offset += 1;
    labels.push(packet.subarray(offset, offset + length).toString("ascii"));
    offset += length;
    if (!jumped) endOffset = offset;
  }
  return [labels.join("."), endOffset];
}

function parseResponse(packet: Buffer): void {
  const id = packet.readUInt16BE(0);
  const flags = packet.readUInt16BE(2);
  const qdcount = packet.readUInt16BE(4);
  const ancount = packet.readUInt16BE(6);
  const rcode = flags & 0x000f;
  console.log(`id=0x${id.toString(16).padStart(4, "0")} rcode=${rcode} answers=${ancount}`);

  let offset = 12;
  for (let i = 0; i < qdcount; i++) {
    [, offset] = readName(packet, offset);
    offset += 4;
  }
  for (let i = 0; i < ancount; i++) {
    const [name, afterName] = readName(packet, offset);
    offset = afterName;
    const rtype = packet.readUInt16BE(offset);
    const ttl = packet.readUInt32BE(offset + 4);
    const rdlength = packet.readUInt16BE(offset + 8);
    offset += 10;
    const rdata = packet.subarray(offset, offset + rdlength);
    const typeName = TYPE_NAMES[rtype] ?? String(rtype);
    let value: string;
    if (rtype === 1) value = Array.from(rdata).join(".");
    else if (rtype === 28) {
      const groups: string[] = [];
      for (let g = 0; g < 16; g += 2) groups.push(rdata.readUInt16BE(g).toString(16));
      value = groups.join(":");
    } else if (rtype === 5 || rtype === 2) [value] = readName(packet, offset);
    else if (rtype === 15) {
      const preference = rdata.readUInt16BE(0);
      const [exchange] = readName(packet, offset + 2);
      value = `${preference} ${exchange}`;
    } else if (rtype === 16) {
      const textLen = rdata[0];
      value = rdata.subarray(1, 1 + textLen).toString("ascii");
    } else value = rdata.toString("hex");
    console.log(`${name}.\t${ttl}\tIN\t${typeName}\t${value}`);
    offset += rdlength;
  }
}

async function main(): Promise<void> {
  const [name, type, ...rest] = process.argv.slice(2);
  const serverFlagIndex = rest.indexOf("--server");
  const server = serverFlagIndex >= 0 ? rest[serverFlagIndex + 1] : "1.1.1.1";
  const query = buildQuery(name, TYPES[type]);

  const socket = dgram.createSocket("udp4");
  const response = await new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), 5000);
    socket.once("message", (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    socket.send(query, 53, server);
  });
  socket.close();
  parseResponse(response);
}

main();
