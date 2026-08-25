"""A stub resolver with its own cache, keyed by TTL.

A browser, an OS, and every resolver in between each keep this same kind
of cache. This one is small enough to read start to finish: look up a
name; if a cached answer exists and has not expired, return it and send
no packet at all; otherwise query the authoritative server, store the
answer with an expiry computed from the TTL it returned, and return that.

    python caching_resolver.py bookmarks-api.local
    python caching_resolver.py bookmarks-api.local        # second call, same process: cache hit
"""

from __future__ import annotations

import json
import socket
import struct
import sys
import time
from pathlib import Path

SERVER = ("127.0.0.1", 5300)
CACHE_FILE = Path(__file__).parent / "resolver_cache.json"


def encode_name(name: str) -> bytes:
    out = bytearray()
    for label in name.rstrip(".").split("."):
        out += bytes([len(label)]) + label.encode("ascii")
    out += b"\x00"
    return bytes(out)


def build_query(name: str) -> bytes:
    header = struct.pack(">HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0)
    question = encode_name(name) + struct.pack(">HH", 1, 1)  # type A, class IN
    return header + question


def query_authoritative(name: str) -> tuple[str, int]:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(2)
        sock.sendto(build_query(name), SERVER)
        response, _ = sock.recvfrom(512)
    ancount = struct.unpack(">H", response[6:8])[0]
    if ancount == 0:
        raise LookupError(f"NXDOMAIN: {name}")
    # Skip the header (12) and the echoed question (name + 4 bytes of
    # type/class); the answer's name is a compression pointer (2 bytes).
    offset = 12
    while response[offset] != 0:
        offset += response[offset] + 1
    offset += 1 + 4
    offset += 2  # compression pointer
    _, _, ttl, rdlength = struct.unpack(">HHIH", response[offset : offset + 10])
    offset += 10
    ip = socket.inet_ntoa(response[offset : offset + rdlength])
    return ip, ttl


def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache))


def resolve(name: str) -> str:
    cache = load_cache()
    now = time.time()
    entry = cache.get(name)
    if entry and entry["expires_at"] > now:
        remaining = entry["expires_at"] - now
        print(f"cache hit: {name} -> {entry['ip']} ({remaining:.1f}s left on TTL)")
        return entry["ip"]
    ip, ttl = query_authoritative(name)
    cache[name] = {"ip": ip, "expires_at": now + ttl}
    save_cache(cache)
    print(f"cache miss: queried authoritative, {name} -> {ip} (ttl={ttl}s)")
    return ip


if __name__ == "__main__":
    resolve(sys.argv[1])
