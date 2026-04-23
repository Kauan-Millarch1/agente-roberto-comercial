"""Shared environment loader for maintenance scripts.

Copy `.env.example` to `.env` at the project root and fill in the values,
or export them directly in your shell.

Usage:
    from _env import N8N_API_KEY, N8N_BASE_URL   # validates on import
    from _env import require, _load_dotenv       # for custom validation
"""
import os
import sys
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env loader (no external deps). Looks at project root `.env`."""
    root = Path(__file__).resolve().parent.parent
    env_path = root / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv()


def require(name: str) -> str:
    """Return env var value or exit with a clear error."""
    value = os.environ.get(name)
    if not value:
        sys.exit(
            f"ERROR: environment variable {name} is not set.\n"
            f"Copy .env.example to .env and fill it in, or export {name} in your shell."
        )
    return value


def __getattr__(name: str) -> str:
    """Lazy-load required vars so importing _env doesn't crash for scripts
    that only need a subset (e.g. seed_super_admin only needs Supabase vars)."""
    if name == "N8N_API_KEY":
        return require("N8N_API_KEY")
    if name == "N8N_BASE_URL":
        return os.environ.get(
            "N8N_BASE_URL", "https://ecommercepuro.app.n8n.cloud/api/v1"
        )
    raise AttributeError(f"module '_env' has no attribute {name!r}")
