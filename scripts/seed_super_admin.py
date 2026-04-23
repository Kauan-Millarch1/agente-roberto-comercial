"""Seed a super_admin in dashboard_users.

Reads SUPER_ADMIN_EMAIL + Supabase credentials from .env and upserts the
dashboard_users row with role='super_admin' for the matching auth.users entry.

Safe to re-run. Requires the target user to have logged in at least once
(so that a row exists in auth.users).

Usage:
    python scripts/seed_super_admin.py
"""
import os
import sys
import json
import urllib.request
import urllib.error

from _env import _load_dotenv  # reuse the .env loader

_load_dotenv()

EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "").strip()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
DISPLAY_NAME = os.environ.get("SUPER_ADMIN_DISPLAY_NAME", "").strip() or None

missing = [
    name
    for name, value in [
        ("SUPER_ADMIN_EMAIL", EMAIL),
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY),
    ]
    if not value
]
if missing:
    sys.exit(
        "ERROR: missing environment variables: "
        + ", ".join(missing)
        + "\nCopy .env.example to .env and fill them in."
    )


def supabase_request(path: str, method: str = "GET", body: dict | None = None) -> dict:
    """Call PostgREST on the Supabase project with service_role auth."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {path}: {e.read().decode('utf-8', 'ignore')}")


# 1) Find the auth.users.id for the given email via a dedicated RPC or the admin API.
# PostgREST can't read auth.users directly (schema not exposed), so we use
# the Supabase Admin API (GoTrue) instead.
admin_url = f"{SUPABASE_URL}/auth/v1/admin/users?filter=email%3Deq%3A{urllib.parse.quote(EMAIL)}"
admin_req = urllib.request.Request(
    admin_url,
    headers={
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    },
)
try:
    with urllib.request.urlopen(admin_req) as resp:
        auth_payload = json.loads(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code} listing auth.users: {e.read().decode('utf-8', 'ignore')}")

users = auth_payload.get("users") or []
match = next((u for u in users if u.get("email", "").lower() == EMAIL.lower()), None)

if not match:
    sys.exit(
        f"User {EMAIL} not found in auth.users.\n"
        "The user must log in to the dashboard at least once before running this script."
    )

user_id = match["id"]
fallback_name = DISPLAY_NAME or EMAIL.split("@")[0]

# 2) Upsert into dashboard_users with role='super_admin'
result = supabase_request(
    "dashboard_users",
    method="POST",
    body={
        "id": user_id,
        "email": EMAIL,
        "display_name": fallback_name,
        "role": "super_admin",
    },
)

# If the row already exists, POST would 409. In that case, PATCH it.
if not result:
    supabase_request(
        f"dashboard_users?id=eq.{user_id}",
        method="PATCH",
        body={"role": "super_admin", "display_name": fallback_name},
    )

print(f"OK: {EMAIL} is now super_admin ({user_id})")
