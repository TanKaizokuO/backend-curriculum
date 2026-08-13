from fastapi.testclient import TestClient

def test_register_and_login(client: TestClient):
    res = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "correct horse battery staple"
    })
    assert res.status_code == 201
    user = res.json()
    assert user["email"] == "test@example.com"
    assert "id" in user

    res = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "correct horse battery staple"
    })
    assert res.status_code == 200
    assert "session" in res.cookies

    res = client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == "test@example.com"

def test_login_wrong_password(client: TestClient):
    res = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "wrong password"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "wrong email or password"

def test_login_unknown_email(client: TestClient):
    res = client.post("/auth/login", json={
        "email": "nobody@example.com",
        "password": "correct horse battery staple"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "wrong email or password"
