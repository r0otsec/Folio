# Folio — Pentest Report Management Platform

Folio is a self-hosted penetration testing report management platform. It provides a browser-based editor for creating and managing pentest engagements, writing findings, and generating professional PDF reports.

## Features

- Full engagement lifecycle management — from scoping through findings to PDF delivery
- 299 pre-built finding templates across Web Application, Active Directory, AWS, Azure, Mobile, WiFi, Source Code Review, and more
- Block-based finding editor with text, code, and screenshot blocks
- Professional PDF report generation via Playwright/Chromium
- Finding template library with import/export
- Multi-user with role-based access control (admin / user)
- Red team tooling — domain tracking, server inventory, operation logs, active assets
- Dark/light theme

## Quick Start (Docker)

```bash
git clone https://github.com/rootsec1/folio.git
cd folio
docker-compose up -d
```

The app will be available at **http://localhost:8080**.

**Default credentials:**
- Username: `admin`
- Password: `admin123`

> Change the default password immediately via **Admin → Users**.

On first boot, all 299 bundled finding templates are automatically seeded into the database.

## Development Setup

### Backend

```bash
cd folio
pip install -r backend/requirements.txt
pip install playwright && playwright install chromium
python run.py
# API available at http://localhost:8080
```

### Frontend

```bash
cd folio/frontend
npm install
npm run dev
# Dev server at http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:8080`.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | hardcoded dev key | JWT signing secret — **must be set in production** |
| `DATA_DIR` | `./data` | Path where the SQLite DB and uploads are stored |

For production, set `SECRET_KEY` to a long random string:

```bash
# Generate a secret key
python -c "import secrets; print(secrets.token_hex(32))"
```

Add it to `docker-compose.yml`:
```yaml
environment:
  - SECRET_KEY=your-generated-key-here
```

## PDF Generation

PDF generation uses Playwright/Chromium. This is pre-installed in the Docker image. For local development, install it manually:

```bash
pip install playwright
playwright install chromium
```

## Data

All user data (engagements, findings, clients, uploaded media) is stored in `data/reports.db` (SQLite) and `data/media/`. These paths are excluded from version control.

To back up your data, use the **Settings → Export** feature in the app, or copy the `data/` directory directly.

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy (async), aiosqlite, Playwright
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **PDF:** Jinja2 HTML templates rendered by Playwright/Chromium
- **Auth:** JWT (python-jose) + bcrypt
- **Database:** SQLite via aiosqlite

## License

© RootSec. All rights reserved.
