"""Four attacks on a token. Two succeed, and two fail.

    python forge_token.py

Read the output from the top. The first attack takes three lines of Python
and it makes the attacker an administrator. The rest of the program shows
which single step stops it, and which two mistakes give the attack back.
"""

import base64
import json
import time

from security import (
    TokenError,
    b64url_decode,
    b64url_encode,
    issue_token,
    verify_token,
)


def rule(title: str) -> None:
    print(f"\n=== {title} " + "=" * max(0, 62 - len(title)))


# --------------------------------------------------------------------------
# The naive server. It encodes the claims and calls the result a token.
# --------------------------------------------------------------------------

def naive_issue(claims: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(claims).encode()).decode()


def naive_verify(token: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(token))


# --------------------------------------------------------------------------
# A verifier that reads the algorithm out of the token it is checking.
# --------------------------------------------------------------------------

def verify_trusting_the_header(token: str) -> dict:
    part1, part2, part3 = token.split(".")
    header = json.loads(b64url_decode(part1))
    if header.get("alg") == "none":       # the token says no signature is used
        return json.loads(b64url_decode(part2))
    raise TokenError("this demonstration only handles alg none")


def main() -> None:
    # ------------------------------------------------------------ 1 ------
    rule("Attack 1 · edit an unsigned token")
    honest = naive_issue({"sub": "2", "email": "mallory@example.com", "admin": False})
    print("the server gave Mallory:", honest)
    print("the server reads       :", naive_verify(honest))

    stolen = json.loads(base64.urlsafe_b64decode(honest))
    stolen["sub"] = "1"
    stolen["email"] = "ada@example.com"
    stolen["admin"] = True
    forged = naive_issue(stolen)

    print("\nMallory sends back    :", forged)
    print("the server reads      :", naive_verify(forged))
    print("\nThe server believes it. Mallory is now Ada, and Ada is an admin.")
    print("Nothing crashed. No log line looks wrong.")

    # ------------------------------------------------------------ 2 ------
    rule("Attack 2 · edit a signed token")
    real = issue_token(user_id=2, email="mallory@example.com")
    print("the server gave Mallory:", real)
    print("the server reads       :", verify_token(real))

    part1, part2, part3 = real.split(".")
    payload = json.loads(b64url_decode(part2))
    payload["sub"] = "1"
    payload["email"] = "ada@example.com"
    tampered = f"{part1}.{b64url_encode(json.dumps(payload).encode())}.{part3}"

    print("\nMallory sends back    :", tampered)
    try:
        verify_token(tampered)
    except TokenError as exc:
        print("the server answers    : TokenError:", exc)
    print("\nThe payload changed. The signature did not, and it cannot,")
    print("because Mallory does not hold SECRET_KEY.")

    # ------------------------------------------------------------ 3 ------
    rule("Attack 3 · tell the server that there is no algorithm")
    header = b64url_encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    claims = b64url_encode(json.dumps({"sub": "1", "email": "ada@example.com"}).encode())
    alg_none = f"{header}.{claims}."
    print("Mallory sends         :", alg_none)
    print("a verifier that trusts the header reads:", verify_trusting_the_header(alg_none))
    try:
        verify_token(alg_none)
    except TokenError as exc:
        print("our verifier answers  : TokenError:", exc)
    print("\nThe rule: the list of accepted algorithms belongs to the server.")
    print("Never read it out of the token that you are checking.")

    # ------------------------------------------------------------ 4 ------
    rule("Attack 4 · use a token after it expires")
    short = issue_token(user_id=2, email="mallory@example.com", ttl_seconds=1)
    print("issued with a life of one second")
    print("now                   :", verify_token(short)["email"])
    time.sleep(1.1)
    try:
        verify_token(short)
    except TokenError as exc:
        print("1.1 seconds later     : TokenError:", exc)

    # ------------------------------------------------------------ 5 ------
    rule("A token is not a secret box")
    print("Anybody can read the claims. No key is needed:")
    print(" ", json.loads(b64url_decode(real.split(".")[1])))
    print("\nA signature proves who wrote the claims.")
    print("It does not hide them. Never put a secret in a token.")


if __name__ == "__main__":
    main()
