"""
Folio — RootSec PDF Report Platform
Startup entry point. Run with: python run.py (or via Docker CMD)
"""
import os
import sys
from pathlib import Path

# ── Resolve paths — env vars take priority (set by Docker ENV directives)
# In dev: run.py lives at RootSec-PDFs/Folio/run.py, so parent = Folio/
# In Docker: PENTEST_DIR and BACKEND_DIR are set explicitly, so file-relative logic is bypassed
_DEV_ROOT = Path(__file__).parent  # Folio/

PENTEST_DIR = Path(os.environ.get("PENTEST_DIR", str(_DEV_ROOT / "pentest-report")))
BACKEND_DIR = Path(os.environ.get("BACKEND_DIR", str(_DEV_ROOT / "backend")))

for p in (str(PENTEST_DIR), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("PENTEST_DIR", str(PENTEST_DIR))
os.environ.setdefault(
    "DATA_DIR",
    str(_DEV_ROOT / "data")
)

# ── Start server ──────────────────────────────────────────────────────────────
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
