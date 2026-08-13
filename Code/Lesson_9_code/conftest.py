import os
import pytest
from fastapi.testclient import TestClient
import runpy

os.environ.setdefault("DATABASE_URL", "postgresql://testuser:testpassword@127.0.0.1:5432/testdb")
os.environ.setdefault("BCRYPT_ROUNDS", "4")
os.environ.setdefault("SECRET_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef")

from config import settings
from main import app

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    import psycopg
    with psycopg.connect(settings.dsn, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
    runpy.run_path("migrate.py")
    yield

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
