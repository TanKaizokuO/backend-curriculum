"""The conformance corpus — one flow per key in `FLOWS`.

Each flow runs a scripted sequence of HTTP calls on a fresh client (its own
cookie jar, its own account) and returns one observation per call, in the
same order every time. `conftest.py` runs every flow once against the
Python track and once against the TypeScript track. `test_conformance.py`
asserts the two recordings match, call for call.

An observation compares the parts of an answer a client actually depends
on: the status code, the response body's shape (its keys, not their
values), and any `detail` or `source` string the body carries. It skips a
bookmark id, a session id, and a timestamp, because those differ by design
between an int primary key and a bigint-as-string primary key, and a
conformance test that compared them would fail on a difference no client
of either track can observe as a difference in behaviour.
"""

from typing import Any, Callable

import httpx

EMAIL_PASSWORD = "password123"


def _shape(value: Any) -> Any:
    """The keys of a dict, the shape of one sample element of a list, or
    the type name of anything else. Never the value itself."""
    if isinstance(value, dict):
        return sorted(value.keys())
    if isinstance(value, list):
        return [_shape(value[0])] if value else []
    return type(value).__name__


def observe(response: httpx.Response) -> dict:
    try:
        body = response.json()
    except ValueError:
        body = None
    result: dict = {"status": response.status_code, "shape": _shape(body)}
    if isinstance(body, dict):
        if isinstance(body.get("detail"), str):
            result["detail"] = body["detail"]
        if isinstance(body.get("source"), str):
            result["source"] = body["source"]
    return result


def flow_accounts(client: httpx.Client) -> list[dict]:
    """Register, log in, read the session, log out, read again."""
    email = "conformance-accounts@example.com"
    obs = [
        observe(client.post("/auth/register", json={"email": email, "password": EMAIL_PASSWORD})),
        observe(client.post("/auth/register", json={"email": email, "password": EMAIL_PASSWORD})),  # 409
        observe(client.post("/auth/login", json={"email": email, "password": EMAIL_PASSWORD})),
        observe(client.post("/auth/login", json={"email": email, "password": "wrong password"})),  # 401
        observe(client.post("/auth/login", json={"email": "nobody@example.com", "password": EMAIL_PASSWORD})),  # 401
        observe(client.get("/auth/me")),
        observe(client.post("/auth/token", json={"email": email, "password": EMAIL_PASSWORD})),
        observe(client.post("/auth/logout")),
        observe(client.get("/auth/me")),  # 401 — cookie cleared
    ]
    return obs


def flow_bookmarks_and_ownership(client: httpx.Client) -> list[dict]:
    """Create, read with an ETag, guard against a duplicate URL, guard the
    delete against an owner who is not the owner, then delete for real."""
    obs = []

    obs.append(observe(client.post(
        "/auth/register", json={"email": "conformance-owner-a@example.com", "password": EMAIL_PASSWORD},
    )))
    token_a = client.post(
        "/auth/token", json={"email": "conformance-owner-a@example.com", "password": EMAIL_PASSWORD},
    ).json()["access_token"]

    create = client.post(
        "/bookmarks",
        json={"url": "https://conformance.test/owned", "title": "Owned", "tags": ["a", "b"]},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    obs.append(observe(create))
    bookmark_id = create.json()["id"]

    obs.append(observe(client.post(
        "/bookmarks",
        json={"url": "https://conformance.test/owned"},
        headers={"Authorization": f"Bearer {token_a}"},
    )))  # duplicate url -> 409
    obs.append(observe(client.post("/bookmarks", json={"url": "https://conformance.test/no-auth"})))  # 401

    read = client.get(f"/bookmarks/{bookmark_id}")
    obs.append(observe(read))
    etag = read.headers.get("etag")
    obs.append(observe(client.get(f"/bookmarks/{bookmark_id}", headers={"If-None-Match": etag} if etag else {})))  # 304
    obs.append(observe(client.get("/bookmarks/999999999")))  # 404
    obs.append(observe(client.get("/bookmarks", params={"limit": 5})))

    obs.append(observe(client.post(
        "/auth/register", json={"email": "conformance-owner-b@example.com", "password": EMAIL_PASSWORD},
    )))
    token_b = client.post(
        "/auth/token", json={"email": "conformance-owner-b@example.com", "password": EMAIL_PASSWORD},
    ).json()["access_token"]

    obs.append(observe(client.delete(
        f"/bookmarks/{bookmark_id}", headers={"Authorization": f"Bearer {token_b}"},
    )))  # not the owner -> 403
    obs.append(observe(client.delete(
        f"/bookmarks/{bookmark_id}", headers={"Authorization": f"Bearer {token_a}"},
    )))  # owner -> 204
    obs.append(observe(client.delete(
        f"/bookmarks/{bookmark_id}", headers={"Authorization": f"Bearer {token_a}"},
    )))  # already gone -> 404
    return obs


def flow_search_cache(client: httpx.Client) -> list[dict]:
    """A miss, then a hit, for the same query. The `source` field is the
    one value this corpus checks exactly, because both tracks promise it as
    part of the contract, not as an implementation detail."""
    obs = []
    obs.append(observe(client.post(
        "/auth/register", json={"email": "conformance-search@example.com", "password": EMAIL_PASSWORD},
    )))
    token = client.post(
        "/auth/token", json={"email": "conformance-search@example.com", "password": EMAIL_PASSWORD},
    ).json()["access_token"]
    obs.append(observe(client.post(
        "/bookmarks",
        json={"url": "https://conformance.test/searchable", "title": "Searchable Conformance Target"},
        headers={"Authorization": f"Bearer {token}"},
    )))
    obs.append(observe(client.get("/bookmarks/search", params={"q": "Searchable"})))  # miss
    obs.append(observe(client.get("/bookmarks/search", params={"q": "Searchable"})))  # hit
    obs.append(observe(client.get("/bookmarks/search", params={"q": "no-such-title-ever"})))  # miss, empty
    return obs


def flow_health(client: httpx.Client) -> list[dict]:
    obs = [observe(client.get("/healthz"))]
    metrics = client.get("/metrics")
    obs.append({"status": metrics.status_code, "content_type": metrics.headers.get("content-type", "").split(";")[0]})
    return obs


FLOWS: dict[str, Callable[[httpx.Client], list[dict]]] = {
    "accounts": flow_accounts,
    "bookmarks_and_ownership": flow_bookmarks_and_ownership,
    "search_cache": flow_search_cache,
    "health": flow_health,
}
