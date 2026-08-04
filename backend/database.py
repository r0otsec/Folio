import os
import json
from datetime import datetime, UTC
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data")))
DB_PATH = DATA_DIR / "reports.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Additive migrations — safe to run every startup
        migrations = [
            "ALTER TABLE projects ADD COLUMN client_id INTEGER",
            "ALTER TABLE projects ADD COLUMN created_by INTEGER",
            # Domain new fields
            "ALTER TABLE domains ADD COLUMN purchase_date TEXT DEFAULT ''",
            "ALTER TABLE domains ADD COLUMN auto_renew INTEGER DEFAULT 0",
            "ALTER TABLE domains ADD COLUMN whois_status TEXT DEFAULT 'enabled'",
            "ALTER TABLE domains ADD COLUMN health_status TEXT DEFAULT 'healthy'",
            "ALTER TABLE domains ADD COLUMN reset_dns INTEGER DEFAULT 0",
            # Server new fields
            "ALTER TABLE servers ADD COLUMN purchase_date TEXT DEFAULT ''",
            "ALTER TABLE servers ADD COLUMN expiry_date TEXT DEFAULT ''",
            "ALTER TABLE servers ADD COLUMN health_status TEXT DEFAULT 'healthy'",
            # FindingTemplate CVSS fields
            "ALTER TABLE finding_templates ADD COLUMN cvss_score TEXT",
            "ALTER TABLE finding_templates ADD COLUMN cvss_vector TEXT DEFAULT ''",
            # FindingTemplate impact field
            "ALTER TABLE finding_templates ADD COLUMN impact TEXT DEFAULT ''",
        ]
        for sql in migrations:
            try:
                await conn.exec_driver_sql(sql)
            except Exception:
                pass  # column already exists

    await _seed_finding_templates()


async def _seed_finding_templates():
    """On first run, populate finding_templates from the bundled seed file."""
    seed_path = Path(__file__).parent / "seeds" / "finding_templates.json"
    if not seed_path.exists():
        return
    async with AsyncSessionLocal() as session:
        result = await session.execute(__import__("sqlalchemy", fromlist=["text"]).text("SELECT COUNT(*) FROM finding_templates"))
        if result.scalar() > 0:
            return  # already seeded — don't overwrite user additions
    templates = json.loads(seed_path.read_text(encoding="utf-8"))
    now = datetime.now(UTC).isoformat()
    async with engine.begin() as conn:
        for t in templates:
            tags = t.get("tags", [])
            tags_json = json.dumps(tags) if isinstance(tags, list) else (tags or "[]")
            await conn.exec_driver_sql(
                "INSERT INTO finding_templates (title, severity, category, description, impact, recommendations, tags, cvss_score, cvss_vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    t.get("title", ""), t.get("severity", "medium"), t.get("category", ""),
                    t.get("description", ""), t.get("impact", ""), t.get("recommendations", ""),
                    tags_json, t.get("cvss_score"), t.get("cvss_vector", ""),
                    now, now,
                ),
            )
