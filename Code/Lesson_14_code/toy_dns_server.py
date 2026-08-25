"""A one-record authoritative DNS server, on UDP, no library.

This plays the part of `hera.ns.cloudflare.com` from Step 2's trace, but
for one made-up zone: bookmarks-api.local. It reads zone.json fresh on
every query, so editing that file changes the answer immediately — exactly
what an operator does in a DNS provider's dashboard. It answers A queries
for the one name in the zone and NXDOMAIN for anything else.

    python toy_dns_server.py
"""

from __future__ import annotations

import json
import socket
import struct
import sys
from pathlib import Path

ZONE_FILE = Path(__file__).parent / "zone.json"
LISTEN = ("127.0.0.1", 5300)


def encode_name(name: str) -> bytes:
    out = bytearray()
    for label in name.rstrip(".").split("."):
        out += bytes([len(label)]) + label.encode("ascii")
    out += b"\x00"
    return bytes(out)


def read_question_name(packet: bytes, offset: int = 12) -> tuple[str, int]:
    labels = []
    while True:
        length = packet[offset]
        if length == 0:
            offset += 1
            break
        offset += 1
        labels.append(packet[offset : offset + length].decode("ascii"))
        offset += length
    return ".".join(labels), offset


def build_answer(query: bytes, name: str, ip: str, ttl: int) -> bytes:
    query_id = query[:2]
    flags = struct.pack(">H", 0x8180)  # response, recursion available, no error
    _, qtype = struct.unpack(">HH", query[-4:])
    counts = struct.pack(">HHHH", 1, 1, 0, 0)  # 1 question, 1 answer
    question = query[12:]
    rdata = socket.inet_aton(ip)
    answer = (
        b"\xc0\x0c"  # pointer back to the name in the question section
        + struct.pack(">HHIH", 1, 1, ttl, len(rdata))  # TYPE A, CLASS IN
        + rdata
    )
    return query_id + flags + counts + question + answer


def build_nxdomain(query: bytes) -> bytes:
    query_id = query[:2]
    flags = struct.pack(">H", 0x8183)  # response, rcode 3 = NXDOMAIN
    counts = struct.pack(">HHHH", 1, 0, 0, 0)
    return query_id + flags + counts + query[12:]


def main() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.bind(LISTEN)
        print(f"toy authoritative server listening on {LISTEN[0]}:{LISTEN[1]}", flush=True)
        while True:
            query, addr = sock.recvfrom(512)
            name, _ = read_question_name(query)
            zone = json.loads(ZONE_FILE.read_text())
            if name.lower() == zone["name"].lower():
                response = build_answer(query, name, zone["ip"], zone["ttl"])
                print(f"answer {name} -> {zone['ip']} ttl={zone['ttl']}", flush=True)
            else:
                response = build_nxdomain(query)
                print(f"NXDOMAIN {name}", flush=True)
            sock.sendto(response, addr)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
