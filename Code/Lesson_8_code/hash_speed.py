"""What a leaked password table is worth to the person who steals it.

    python hash_speed.py

The program does four things:

    1. It shows that two users with the same password get the same SHA-256
       row, and different bcrypt rows.
    2. It cracks the SHA-256 table with a word list, and reports the time.
    3. It attacks the bcrypt table with the same word list, and reports the
       time.
    4. It measures both functions and prints the guess rate of each one.

Every number that this program prints comes from your machine. Run it before
you read the lesson section that quotes it.
"""

import hashlib
import pathlib
import time

import bcrypt

from config import settings

WORDLIST = pathlib.Path(__file__).parent / "wordlist.txt"

# Five accounts. Two of them chose the same password, which is normal.
ACCOUNTS = [
    ("ada@example.com", "hunter2"),
    ("alan@example.com", "letmein"),
    ("grace@example.com", "hunter2"),
    ("edsger@example.com", "correcthorse"),
    ("barbara@example.com", "trustno1"),
]


def sha256_hex(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def rule(title: str) -> None:
    print(f"\n=== {title} " + "=" * max(0, 62 - len(title)))


def main() -> None:
    words = WORDLIST.read_text().split()
    print(f"word list: {len(words)} passwords")
    print(f"bcrypt rounds: {settings.bcrypt_rounds}")

    # ---------------------------------------------------------------- 1 ---
    rule("The leak, as SHA-256")
    sha_table = [(email, sha256_hex(pw)) for email, pw in ACCOUNTS]
    for email, digest in sha_table:
        print(f"{email:22} {digest}")
    print("\nAda and Grace never told each other their password.")
    print("The table tells you they share one.")

    rule("The same leak, as bcrypt")
    bcrypt_table = [
        (email, bcrypt.hashpw(pw.encode(), bcrypt.gensalt(settings.bcrypt_rounds)).decode())
        for email, pw in ACCOUNTS
    ]
    for email, digest in bcrypt_table:
        print(f"{email:22} {digest}")
    print("\nThe same two passwords now look unrelated. The salt did that.")

    # ---------------------------------------------------------------- 2 ---
    rule("Crack the SHA-256 table")
    start = time.perf_counter()
    index = {sha256_hex(w): w for w in words}
    cracked = [(email, index[d]) for email, d in sha_table if d in index]
    sha_seconds = time.perf_counter() - start
    for email, password in cracked:
        print(f"{email:22} {password}")
    print(f"\n{len(cracked)} of {len(ACCOUNTS)} accounts in {sha_seconds * 1000:.2f} ms")

    # ---------------------------------------------------------------- 3 ---
    rule("Attack the bcrypt table with the same word list")
    start = time.perf_counter()
    found = []
    for email, digest in bcrypt_table:
        for word in words:
            if bcrypt.checkpw(word.encode(), digest.encode()):
                found.append((email, word))
                break
    bcrypt_seconds = time.perf_counter() - start
    for email, password in found:
        print(f"{email:22} {password}")
    print(f"\n{len(found)} of {len(ACCOUNTS)} accounts in {bcrypt_seconds:.1f} s")
    print(f"slower by {bcrypt_seconds / sha_seconds:,.0f}x for the same result")
    print("Note the result. bcrypt does not save a password that is on the list.")

    # ---------------------------------------------------------------- 4 ---
    rule("Guess rate of each function")
    sample = b"correct horse battery staple"

    start = time.perf_counter()
    for _ in range(200_000):
        hashlib.sha256(sample).hexdigest()
    sha_rate = 200_000 / (time.perf_counter() - start)

    salt = bcrypt.gensalt(settings.bcrypt_rounds)
    start = time.perf_counter()
    for _ in range(10):
        bcrypt.hashpw(sample, salt)
    bcrypt_rate = 10 / (time.perf_counter() - start)

    space = 26 ** 8  # every lower-case password of eight letters
    print(f"SHA-256 : {sha_rate:15,.0f} guesses/second, one CPU core")
    print(f"bcrypt  : {bcrypt_rate:15,.0f} guesses/second, one CPU core")
    print(f"ratio   : {sha_rate / bcrypt_rate:15,.0f}x")
    print(f"\nA password of eight lower-case letters: {space:,} possibilities.")
    print(f"SHA-256 : {space / sha_rate / 3600:,.1f} hours on this one core")
    print(f"bcrypt  : {space / bcrypt_rate / 31_557_600:,.0f} years on this one core")
    print("\nA real attacker owns a GPU farm, not one core of a laptop.")
    print("The ratio is what matters, and the ratio does not change.")


if __name__ == "__main__":
    main()
