import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_register_and_login(client: AsyncClient):
    res = await client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "correct horse battery staple"
    })
    assert res.status_code == 201
    user = res.json()
    assert user["email"] == "test@example.com"
    assert "id" in user

    res = await client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "correct horse battery staple"
    })
    assert res.status_code == 200
    assert "session" in res.cookies

    res = await client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == "test@example.com"


@pytest.mark.anyio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "correct horse battery staple"
    })
    res = await client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "wrong password"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "wrong email or password"


@pytest.mark.anyio
async def test_login_unknown_email(client: AsyncClient):
    res = await client.post("/auth/login", json={
        "email": "nobody@example.com",
        "password": "correct horse battery staple"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "wrong email or password"
