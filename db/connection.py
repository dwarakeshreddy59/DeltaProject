"""
db/connection.py – psycopg2 connection pool with auto schema initialisation.
"""

import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

_pool: pool.SimpleConnectionPool | None = None


def init_pool(config) -> None:
    """Create the connection pool and ensure schema exists."""
    global _pool
    _pool = pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
    )
    _run_schema()


def _run_schema() -> None:
    """Execute schema.sql to create tables if they don't exist."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        sql = f.read()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    finally:
        release_conn(conn)


def get_conn():
    """Borrow a connection from the pool."""
    if _pool is None:
        raise RuntimeError("DB pool not initialised. Call init_pool() first.")
    return _pool.getconn()


def release_conn(conn) -> None:
    """Return a connection to the pool."""
    if _pool and conn:
        _pool.putconn(conn)


def execute_query(sql: str, params=None, fetch: str = "none"):
    """
    Convenience wrapper.
    fetch: 'one' | 'all' | 'none'
    Returns the fetched rows, or None.
    """
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            conn.commit()
            if fetch == "one":
                return cur.fetchone()
            if fetch == "all":
                return cur.fetchall()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)
    return None
