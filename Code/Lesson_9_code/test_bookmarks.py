from fastapi.testclient import TestClient

def test_create_and_delete_bookmark(client: TestClient):
    client.post("/auth/register", json={"email": "user1@example.com", "password": "password"})
    client.post("/auth/login", json={"email": "user1@example.com", "password": "password"})

    res = client.post("/bookmarks", json={"url": "https://example.com/1"})
    assert res.status_code == 201
    bookmark_id = res.json()["id"]

    res = client.delete(f"/bookmarks/{bookmark_id}")
    assert res.status_code == 204

def test_cannot_delete_others_bookmark(client: TestClient):
    client.post("/auth/register", json={"email": "usera@example.com", "password": "password"})
    res_a = client.post("/auth/token", json={"email": "usera@example.com", "password": "password"})
    token_a = res_a.json()["access_token"]
    
    res = client.post("/bookmarks", json={"url": "https://example.com/a"}, headers={"Authorization": f"Bearer {token_a}"})
    bookmark_id = res.json()["id"]

    client.post("/auth/register", json={"email": "userb@example.com", "password": "password"})
    res_b = client.post("/auth/token", json={"email": "userb@example.com", "password": "password"})
    token_b = res_b.json()["access_token"]

    res = client.delete(f"/bookmarks/{bookmark_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res.status_code == 403
    assert res.json()["detail"] == "not your bookmark"
