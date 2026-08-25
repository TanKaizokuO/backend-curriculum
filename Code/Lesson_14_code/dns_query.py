"""A DNS query, built on the wire, with no library that hides the packet.

Lesson 1 read raw bytes off a TCP socket before naming the framework that
hides them. This is the same move for DNS: build the twelve-byte header and
the question by hand, send them over UDP to a resolver, and parse whatever
comes back byte by byte. `dig` and `socket.getaddrinfo` both do this; this
script shows what they do not print.

    python dns_query.py example.com A
    python dns_query.py example.com AAAA --server 1.1.1.1
    python dns_query.py github.com CNAME
    python dns_query.py google.com MX
    python dns_query.py example.com TXT
"""

from __future__ import annotations

import argparse
import random
import socket
import struct

TYPES = {"A": 1, "NS": 2, "CNAME": 5, "MX": 15, "TXT": 16, "AAAA": 28}
TYPE_NAMES = {v: k for k, v in TYPES.items()}


def encode_name(name: str) -> bytes:
    """A domain name on the wire is a sequence of length-prefixed labels,
    ending in a zero-length label. "example.com" becomes
    b"\\x07example\\x03com\\x00" — the length before each part is why a
    single label cannot exceed 63 bytes."""
    out = bytearray()
    for label in name.rstrip(".").split("."):
        out += bytes([len(label)]) + label.encode("ascii")
    out += b"\x00"
    return bytes(out)


def build_query(name: str, qtype: int) -> bytes:
    query_id = random.randint(0, 0xFFFF)
    # Header: id, flags (RD=1: "please recurse for me"), 1 question, 0 of
    # the rest.
    flags = 0x0100
    header = struct.pack(">HHHHHH", query_id, flags, 1, 0, 0, 0)
    question = encode_name(name) + struct.pack(">HH", qtype, 1)  # class IN
    return header + question


def read_name(packet: bytes, offset: int) -> tuple[str, int]:
    """A name later in the packet can point back into an earlier one
    instead of repeating it — a compression pointer, marked by the top two
    bits of a length byte both set. Follow it, but keep advancing the
    caller's cursor only past the pointer itself, not into the jump."""
    labels = []
    jumped = False
    end_offset = offset
    while True:
        length = packet[offset]
        if length & 0xC0 == 0xC0:
            pointer = struct.unpack(">H", packet[offset : offset + 2])[0] & 0x3FFF
            if not jumped:
                end_offset = offset + 2
                jumped = True
            offset = pointer
            continue
        if length == 0:
            offset += 1
            if not jumped:
                end_offset = offset
            break
        offset += 1
        labels.append(packet[offset : offset + length].decode("ascii"))
        offset += length
        if not jumped:
            end_offset = offset
    return ".".join(labels), end_offset


def parse_response(packet: bytes) -> None:
    query_id, flags, qdcount, ancount, nscount, arcount = struct.unpack(
        ">HHHHHH", packet[:12]
    )
    rcode = flags & 0x000F
    print(f"id={query_id:#06x} rcode={rcode} answers={ancount}")
    offset = 12
    for _ in range(qdcount):
        _, offset = read_name(packet, offset)
        offset += 4  # qtype + qclass
    for _ in range(ancount):
        name, offset = read_name(packet, offset)
        rtype, rclass, ttl, rdlength = struct.unpack(
            ">HHIH", packet[offset : offset + 10]
        )
        offset += 10
        rdata = packet[offset : offset + rdlength]
        type_name = TYPE_NAMES.get(rtype, str(rtype))
        if rtype == 1:  # A
            value = socket.inet_ntoa(rdata)
        elif rtype == 28:  # AAAA
            value = socket.inet_ntop(socket.AF_INET6, rdata)
        elif rtype in (5, 2):  # CNAME, NS
            value, _ = read_name(packet, offset)
        elif rtype == 15:  # MX
            preference = struct.unpack(">H", rdata[:2])[0]
            exchange, _ = read_name(packet, offset + 2)
            value = f"{preference} {exchange}"
        elif rtype == 16:  # TXT
            text_len = rdata[0]
            value = rdata[1 : 1 + text_len].decode("ascii", errors="replace")
        else:
            value = rdata.hex()
        print(f"{name}.\t{ttl}\tIN\t{type_name}\t{value}")
        offset += rdlength


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("type", choices=TYPES.keys())
    parser.add_argument("--server", default="1.1.1.1")
    parser.add_argument("--port", type=int, default=53)
    args = parser.parse_args()

    query = build_query(args.name, TYPES[args.type])
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(5)
        sock.sendto(query, (args.server, args.port))
        response, _ = sock.recvfrom(4096)
    parse_response(response)


if __name__ == "__main__":
    main()
