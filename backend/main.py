"""
Folio — FastAPI Backend
"""
import os
import re
import sys
import uuid
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# ── Path setup ────────────────────────────────────────────────────────────────
_HERE = Path(__file__).parent
_PENTEST_DIR = Path(os.environ.get("PENTEST_DIR", str(_HERE.parent / "pentest-report")))
if str(_PENTEST_DIR) not in sys.path:
    sys.path.insert(0, str(_PENTEST_DIR))

from database import get_db, init_db, DATA_DIR
from models import User, Project, Client, Domain, ReportDesign, Server, Observation, OpLog, OpLogEntry, OpLogEvidence, FindingTemplate
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin, ensure_default_admin,
)
from parsers.nessus import parse_nessus

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Folio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_DIR = DATA_DIR / "media"
OPLOG_MEDIA_DIR = DATA_DIR / "media" / "oplogs"


@app.on_event("startup")
async def startup():
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    OPLOG_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    await init_db()
    # Always sync templates from the bundled source — ensures every rebuild propagates updates
    _TEMPLATE_SRC = _PENTEST_DIR / "templates"
    _TEMPLATE_DST = DATA_DIR / "templates"
    shutil.copytree(str(_TEMPLATE_SRC), str(_TEMPLATE_DST), dirs_exist_ok=True)
    os.environ.setdefault("TEMPLATE_DIR", str(_TEMPLATE_DST))
    async with (await _get_db_session()) as db:
        await ensure_default_admin(db)
        await _seed_report_designs(db)
        await _seed_finding_templates(db)


async def _get_db_session():
    from database import AsyncSessionLocal
    return AsyncSessionLocal()


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════════

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@app.post("/api/auth/login", response_model=LoginResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form.username))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    user.last_login = datetime.utcnow()
    await db.commit()
    token = create_access_token(user.id, user.role)
    return LoginResponse(access_token=token, user=_user_dict(user))


@app.get("/api/auth/me")
async def me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/auth/change-password")
async def change_password(
    body: ChangePasswordBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN — USER MANAGEMENT (admin only)
# ═══════════════════════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    display_name: str = ""
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class ResetPasswordBody(BaseModel):
    new_password: str


@app.get("/api/admin/users")
async def list_users(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at))
    return [_user_dict(u) for u in result.scalars().all()]


@app.post("/api/admin/users", status_code=201)
async def create_user(body: UserCreate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = User(
        username=body.username, email=body.email, display_name=body.display_name,
        password_hash=hash_password(body.password), role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_dict(user)


@app.put("/api/admin/users/{user_id}")
async def update_user(
    user_id: int, body: UserUpdate,
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    user = await _get_user_or_404(db, user_id)
    if body.email is not None:      user.email = body.email
    if body.display_name is not None: user.display_name = body.display_name
    if body.role is not None:       user.role = body.role
    if body.is_active is not None:  user.is_active = body.is_active
    await db.commit()
    await db.refresh(user)
    return _user_dict(user)


@app.post("/api/admin/users/{user_id}/reset-password")
async def reset_password(
    user_id: int, body: ResetPasswordBody,
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = await _get_user_or_404(db, user_id)
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


@app.delete("/api/admin/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    user = await _get_user_or_404(db, user_id)
    if user.role == "admin":
        result = await db.execute(select(User).where(User.role == "admin"))
        if len(result.scalars().all()) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin account")
    await db.delete(user)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECTS (engagements)
# ═══════════════════════════════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    name: str
    report_id: str = ""
    client_name: str = ""
    client_id: Optional[int] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    report_id: Optional[str] = None
    client_name: Optional[str] = None
    status: Optional[str] = None
    report_data: Optional[dict] = None


@app.get("/api/projects")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).order_by(Project.updated_at.desc()))
    return [_project_summary(p) for p in result.scalars().all()]


@app.post("/api/projects", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_name = body.client_name or body.name

    if body.client_id:
        result = await db.execute(select(Client).where(Client.id == body.client_id))
        client = result.scalar_one_or_none()
        if client:
            client_name = client.name

    project = Project(
        name=body.name, report_id=body.report_id,
        client_name=client_name, client_id=body.client_id,
        created_by=current_user.id,
        report_data=_blank_report(body.name, body.report_id, client_name, body.client_id, db),
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    if body.client_id:
        result = await db.execute(select(Client).where(Client.id == body.client_id))
        client = result.scalar_one_or_none()
        if client:
            rd = project.report_data or {}
            rd.setdefault("meta", {}).setdefault("client", {})
            rd["meta"]["client"].update({
                "name": client.name,
                "contact_name": client.contact_name,
                "contact_title": client.contact_title,
                "contact_email": client.contact_email,
            })
            project.report_data = rd
            await db.commit()
            await db.refresh(project)
    return _project_detail(project)


@app.get("/api/projects/{project_id}")
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return _project_detail(await _get_proj_or_404(db, project_id))


@app.put("/api/projects/{project_id}")
async def update_project(
    project_id: int, body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_proj_or_404(db, project_id)
    if body.name is not None:        project.name = body.name
    if body.report_id is not None:   project.report_id = body.report_id
    if body.client_name is not None: project.client_name = body.client_name
    if body.status is not None:      project.status = body.status
    if body.report_data is not None: project.report_data = body.report_data
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return _project_detail(project)


@app.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_proj_or_404(db, project_id)
    await db.delete(project)
    await db.commit()


@app.post("/api/projects/{project_id}/generate")
async def generate_pdf_endpoint(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import asyncio
    import functools
    project = await _get_proj_or_404(db, project_id)
    try:
        import generate as gen
        media_dir = MEDIA_DIR / str(project_id)
        media_dir.mkdir(parents=True, exist_ok=True)
        data = dict(project.report_data or {})
        data.setdefault("remediation_roadmap", {})
        loop = asyncio.get_event_loop()
        pdf_bytes = await loop.run_in_executor(
            None, functools.partial(gen.generate_pdf_from_dict, data, media_dir)
        )
        filename = f"{project.report_id or 'report'}-{_slugify(project.client_name or project.name)}.pdf"
        return StreamingResponse(
            iter([pdf_bytes]), media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/projects/{project_id}/upload")
async def upload_file(
    project_id: int, file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_proj_or_404(db, project_id)
    media_dir = MEDIA_DIR / str(project_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix if file.filename else ".bin"
    filename = f"{uuid.uuid4()}{ext}"
    (media_dir / filename).write_bytes(await file.read())
    return {"path": filename, "url": f"/api/media/{project_id}/{filename}"}


@app.get("/api/media/{project_id}/{filename}")
async def get_media(project_id: int, filename: str):
    path = MEDIA_DIR / str(project_id) / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))


@app.post("/api/projects/{project_id}/import-nessus")
async def import_nessus(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_proj_or_404(db, project_id)

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".nessus", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        nessus_findings = parse_nessus(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        import os as _os
        _os.unlink(tmp_path)

    # Map severity
    sev_map = {
        'Critical': 'critical',
        'High': 'high',
        'Medium': 'medium',
        'Low': 'low',
        'Info': 'informational',
        'Unknown': 'informational',
    }

    rd = dict(project.report_data or {})
    sections = rd.get("sections", [])

    # Find or create "Nessus Import" section
    nessus_section = None
    for sec in sections:
        if sec.get("title") == "Nessus Import":
            nessus_section = sec
            break

    if nessus_section is None:
        nessus_section = {
            "id": "nessus-import",
            "title": "Nessus Import",
            "enabled": True,
            "findings": [],
        }
        sections.append(nessus_section)

    # Convert each nessus finding to a Finding object
    existing_ids = {f.get("id", "") for sec in sections for f in sec.get("findings", [])}
    for i, nf in enumerate(nessus_findings):
        severity = sev_map.get(nf.get("severity", "Info"), "informational")
        finding_id = f"NSS-{len(nessus_section['findings']) + i + 1:03d}"
        # Ensure unique
        while finding_id in existing_ids:
            finding_id = f"NSS-{int(finding_id.split('-')[-1]) + 1:03d}"
        existing_ids.add(finding_id)

        finding = {
            "id": finding_id,
            "title": nf.get("title", "Unknown"),
            "severity": severity,
            "description": nf.get("description", ""),
            "risk_rating_justification": "",
            "impact": {"technical": "", "business": ""},
            "recommendations": {"text": nf.get("remediation", "")},
            "affected_hosts": [nf.get("host", "")] if nf.get("host") else [],
            "references": [],
            "evidence": [],
            "content_blocks": [{"type": "text", "content": nf.get("description", "")}],
            "retest": {"enabled": False},
        }
        nessus_section["findings"].append(finding)

    rd["sections"] = sections
    project.report_data = rd
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return _project_detail(project)


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENTS
# ═══════════════════════════════════════════════════════════════════════════════

class ClientCreate(BaseModel):
    name: str
    industry: str = ""
    contact_name: str = ""
    contact_title: str = ""
    contact_email: str = ""
    notes: str = ""


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None


@app.get("/api/clients")
async def list_clients(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).order_by(Client.name))
    return [_client_dict(c) for c in result.scalars().all()]


@app.post("/api/clients", status_code=201)
async def create_client(body: ClientCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = Client(**body.model_dump())
    db.add(client); await db.commit(); await db.refresh(client)
    return _client_dict(client)


@app.put("/api/clients/{client_id}")
async def update_client(client_id: int, body: ClientUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await _get_client_or_404(db, client_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(client, field, val)
    await db.commit(); await db.refresh(client)
    return _client_dict(client)


@app.delete("/api/clients/{client_id}", status_code=204)
async def delete_client(client_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await _get_client_or_404(db, client_id)
    await db.delete(client); await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# DOMAINS
# ═══════════════════════════════════════════════════════════════════════════════

class DomainCreate(BaseModel):
    domain: str
    registrar: str = ""; purchase_date: str = ""; expiry_date: str = ""
    auto_renew: bool = False; purpose: str = "Infrastructure"; status: str = "active"
    whois_status: str = "enabled"; health_status: str = "healthy"; reset_dns: bool = False
    dns_provider: str = ""; notes: str = ""
    engagement: str = ""; project_id: Optional[int] = None


class DomainUpdate(BaseModel):
    domain: Optional[str] = None; registrar: Optional[str] = None
    purchase_date: Optional[str] = None; expiry_date: Optional[str] = None
    auto_renew: Optional[bool] = None; purpose: Optional[str] = None
    status: Optional[str] = None; whois_status: Optional[str] = None
    health_status: Optional[str] = None; reset_dns: Optional[bool] = None
    dns_provider: Optional[str] = None
    notes: Optional[str] = None; engagement: Optional[str] = None
    project_id: Optional[int] = None


@app.get("/api/domains")
async def list_domains(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Domain).order_by(Domain.domain))
    return [_domain_dict(d) for d in result.scalars().all()]


@app.post("/api/domains", status_code=201)
async def create_domain(body: DomainCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    domain = Domain(**body.model_dump())
    db.add(domain); await db.commit(); await db.refresh(domain)
    return _domain_dict(domain)


@app.put("/api/domains/{domain_id}")
async def update_domain(domain_id: int, body: DomainUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    domain = await _get_domain_or_404(db, domain_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(domain, field, val)
    await db.commit(); await db.refresh(domain)
    return _domain_dict(domain)


@app.delete("/api/domains/{domain_id}", status_code=204)
async def delete_domain(domain_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    domain = await _get_domain_or_404(db, domain_id)
    await db.delete(domain); await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# REPORT DESIGNS
# ═══════════════════════════════════════════════════════════════════════════════

class DesignCreate(BaseModel):
    name: str; description: str = ""; report_type: str = "pentest"
    is_default: bool = False; config: dict = {}


class DesignUpdate(BaseModel):
    name: Optional[str] = None; description: Optional[str] = None
    report_type: Optional[str] = None; is_default: Optional[bool] = None
    config: Optional[dict] = None


@app.get("/api/designs")
async def list_designs(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReportDesign).order_by(ReportDesign.name))
    return [_design_dict(d) for d in result.scalars().all()]


@app.post("/api/designs", status_code=201)
async def create_design(
    body: DesignCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    design = ReportDesign(**body.model_dump())
    db.add(design); await db.commit(); await db.refresh(design)
    return _design_dict(design)


@app.put("/api/designs/{design_id}")
async def update_design(
    design_id: int, body: DesignUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    design = await _get_design_or_404(db, design_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(design, field, val)
    design.updated_at = datetime.utcnow()
    await db.commit(); await db.refresh(design)
    return _design_dict(design)


@app.delete("/api/designs/{design_id}", status_code=204)
async def delete_design(
    design_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    design = await _get_design_or_404(db, design_id)
    await db.delete(design); await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# SERVERS
# ═══════════════════════════════════════════════════════════════════════════════

class ServerCreate(BaseModel):
    ip_address: str = ""; hostname: str = ""
    status: str = "available"; server_provider: str = ""
    tags: str = ""; purpose: str = "C2"
    engagement: str = ""; project_id: Optional[int] = None
    notes: str = ""
    purchase_date: str = ""; expiry_date: str = ""
    health_status: str = "healthy"

class ServerUpdate(BaseModel):
    ip_address: Optional[str] = None; hostname: Optional[str] = None
    status: Optional[str] = None; server_provider: Optional[str] = None
    tags: Optional[str] = None; purpose: Optional[str] = None
    engagement: Optional[str] = None; project_id: Optional[int] = None
    notes: Optional[str] = None
    purchase_date: Optional[str] = None; expiry_date: Optional[str] = None
    health_status: Optional[str] = None

@app.get("/api/servers")
async def list_servers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server).order_by(Server.hostname, Server.ip_address))
    return [_server_dict(s) for s in result.scalars().all()]

@app.post("/api/servers", status_code=201)
async def create_server(body: ServerCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = Server(**body.model_dump())
    db.add(server); await db.commit(); await db.refresh(server)
    return _server_dict(server)

@app.put("/api/servers/{server_id}")
async def update_server(server_id: int, body: ServerUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(db, server_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(server, field, val)
    await db.commit(); await db.refresh(server)
    return _server_dict(server)

@app.delete("/api/servers/{server_id}", status_code=204)
async def delete_server(server_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(db, server_id)
    await db.delete(server); await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# OBSERVATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class ObservationCreate(BaseModel):
    title: str; severity: str = "informational"
    description: str = ""; remediation: str = ""; tags: str = ""

class ObservationUpdate(BaseModel):
    title: Optional[str] = None; severity: Optional[str] = None
    description: Optional[str] = None; remediation: Optional[str] = None
    tags: Optional[str] = None

@app.get("/api/observations")
async def list_observations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Observation).order_by(Observation.title))
    return [_observation_dict(o) for o in result.scalars().all()]

@app.post("/api/observations", status_code=201)
async def create_observation(body: ObservationCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    obs = Observation(**body.model_dump())
    db.add(obs); await db.commit(); await db.refresh(obs)
    return _observation_dict(obs)

@app.put("/api/observations/{obs_id}")
async def update_observation(obs_id: int, body: ObservationUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    obs = await _get_observation_or_404(db, obs_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(obs, field, val)
    obs.updated_at = datetime.utcnow()
    await db.commit(); await db.refresh(obs)
    return _observation_dict(obs)

@app.delete("/api/observations/{obs_id}", status_code=204)
async def delete_observation(obs_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    obs = await _get_observation_or_404(db, obs_id)
    await db.delete(obs); await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# OPERATION LOGS
# ═══════════════════════════════════════════════════════════════════════════════

class OpLogCreate(BaseModel):
    name: str
    project_id: Optional[int] = None
    notifications_enabled: bool = True

class OpLogUpdate(BaseModel):
    name: Optional[str] = None
    project_id: Optional[int] = None
    notifications_enabled: Optional[bool] = None

@app.get("/api/oplogs")
async def list_oplogs(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OpLog).order_by(OpLog.created_at.desc()))
    logs = result.scalars().all()
    # Enrich with project name
    out = []
    for lg in logs:
        d = _oplog_dict(lg)
        if lg.project_id:
            pr = await db.execute(select(Project).where(Project.id == lg.project_id))
            proj = pr.scalar_one_or_none()
            d["project_name"] = (proj.client_name or proj.name) if proj else None
        else:
            d["project_name"] = None
        out.append(d)
    return out

@app.post("/api/oplogs", status_code=201)
async def create_oplog(body: OpLogCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lg = OpLog(**body.model_dump(), created_by=current_user.id)
    db.add(lg); await db.commit(); await db.refresh(lg)
    d = _oplog_dict(lg)
    if lg.project_id:
        pr = await db.execute(select(Project).where(Project.id == lg.project_id))
        proj = pr.scalar_one_or_none()
        d["project_name"] = (proj.client_name or proj.name) if proj else None
    else:
        d["project_name"] = None
    return d

@app.put("/api/oplogs/{oplog_id}")
async def update_oplog(oplog_id: int, body: OpLogUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lg = await _get_oplog_or_404(db, oplog_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(lg, field, val)
    await db.commit(); await db.refresh(lg)
    d = _oplog_dict(lg)
    if lg.project_id:
        pr = await db.execute(select(Project).where(Project.id == lg.project_id))
        proj = pr.scalar_one_or_none()
        d["project_name"] = (proj.client_name or proj.name) if proj else None
    else:
        d["project_name"] = None
    return d

@app.delete("/api/oplogs/{oplog_id}", status_code=204)
async def delete_oplog(oplog_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lg = await _get_oplog_or_404(db, oplog_id)
    await db.delete(lg); await db.commit()


# ── OpLog Entries ─────────────────────────────────────────────────────────────

class OpLogEntryCreate(BaseModel):
    start_date: str = ""
    end_date: str = ""
    source_ip: str = ""
    dest_ip: str = ""
    tool: str = ""
    user_context: str = ""
    command: str = ""
    description: str = ""
    output: str = ""
    comments: str = ""
    operator_name: str = ""
    tags: str = ""

class OpLogEntryUpdate(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    source_ip: Optional[str] = None
    dest_ip: Optional[str] = None
    tool: Optional[str] = None
    user_context: Optional[str] = None
    command: Optional[str] = None
    description: Optional[str] = None
    output: Optional[str] = None
    comments: Optional[str] = None
    operator_name: Optional[str] = None
    tags: Optional[str] = None

@app.get("/api/oplogs/{oplog_id}/entries")
async def list_oplog_entries(oplog_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_oplog_or_404(db, oplog_id)
    result = await db.execute(select(OpLogEntry).where(OpLogEntry.oplog_id == oplog_id).order_by(OpLogEntry.start_date, OpLogEntry.created_at))
    entries = result.scalars().all()
    out = []
    for e in entries:
        d = _entry_dict(e)
        ev = await db.execute(select(OpLogEvidence).where(OpLogEvidence.entry_id == e.id).order_by(OpLogEvidence.created_at))
        d["evidence"] = [_evidence_dict(ev_item) for ev_item in ev.scalars().all()]
        out.append(d)
    return out

@app.post("/api/oplogs/{oplog_id}/entries", status_code=201)
async def create_oplog_entry(oplog_id: int, body: OpLogEntryCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_oplog_or_404(db, oplog_id)
    entry = OpLogEntry(oplog_id=oplog_id, **body.model_dump())
    db.add(entry); await db.commit(); await db.refresh(entry)
    d = _entry_dict(entry)
    d["evidence"] = []
    return d

@app.put("/api/oplogs/{oplog_id}/entries/{entry_id}")
async def update_oplog_entry(oplog_id: int, entry_id: int, body: OpLogEntryUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await _get_entry_or_404(db, entry_id, oplog_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(entry, field, val)
    await db.commit(); await db.refresh(entry)
    d = _entry_dict(entry)
    ev = await db.execute(select(OpLogEvidence).where(OpLogEvidence.entry_id == entry.id).order_by(OpLogEvidence.created_at))
    d["evidence"] = [_evidence_dict(ev_item) for ev_item in ev.scalars().all()]
    return d

@app.delete("/api/oplogs/{oplog_id}/entries/{entry_id}", status_code=204)
async def delete_oplog_entry(oplog_id: int, entry_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await _get_entry_or_404(db, entry_id, oplog_id)
    # Delete associated evidence files
    ev_result = await db.execute(select(OpLogEvidence).where(OpLogEvidence.entry_id == entry.id))
    for ev in ev_result.scalars().all():
        fp = OPLOG_MEDIA_DIR / str(oplog_id) / ev.filename
        if fp.exists(): fp.unlink()
        await db.delete(ev)
    await db.delete(entry); await db.commit()

@app.post("/api/oplogs/{oplog_id}/entries/{entry_id}/evidence", status_code=201)
async def upload_oplog_evidence(
    oplog_id: int,
    entry_id: int,
    file: UploadFile = File(...),
    friendly_name: str = Form(""),
    caption: str = Form(""),
    description: str = Form(""),
    tags: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_entry_or_404(db, entry_id, oplog_id)
    media_dir = OPLOG_MEDIA_DIR / str(oplog_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower() if file.filename else ".bin"
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}:
        evidence_type = "image"
    elif ext == ".cast":
        evidence_type = "cast"
    else:
        evidence_type = "file"
    filename = f"{uuid.uuid4()}{ext}"
    (media_dir / filename).write_bytes(await file.read())
    ev = OpLogEvidence(
        oplog_id=oplog_id, entry_id=entry_id,
        friendly_name=friendly_name or (file.filename or filename),
        caption=caption, description=description, tags=tags,
        evidence_type=evidence_type,
        file_path=str(media_dir / filename),
        filename=filename,
    )
    db.add(ev); await db.commit(); await db.refresh(ev)
    return _evidence_dict(ev)

@app.delete("/api/oplog-evidence/{evidence_id}", status_code=204)
async def delete_oplog_evidence(evidence_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OpLogEvidence).where(OpLogEvidence.id == evidence_id))
    ev = result.scalar_one_or_none()
    if not ev: raise HTTPException(status_code=404, detail="Evidence not found")
    fp = OPLOG_MEDIA_DIR / str(ev.oplog_id) / ev.filename
    if fp.exists(): fp.unlink()
    await db.delete(ev); await db.commit()

@app.get("/api/oplog-media/{oplog_id}/{filename}")
async def get_oplog_media(oplog_id: int, filename: str):
    path = OPLOG_MEDIA_DIR / str(oplog_id) / filename
    if not path.exists(): raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))


# ═══════════════════════════════════════════════════════════════════════════════
# IMPORT / EXPORT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/export/domains")
async def export_domains(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Domain).order_by(Domain.domain))
    return [_domain_dict(d) for d in result.scalars().all()]

@app.get("/api/export/servers")
async def export_servers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server).order_by(Server.hostname))
    return [_server_dict(s) for s in result.scalars().all()]

@app.get("/api/export/observations")
async def export_observations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Observation).order_by(Observation.title))
    return [_observation_dict(o) for o in result.scalars().all()]

@app.post("/api/import/domains")
async def import_domains(data: list, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _DOMAIN_FIELDS = {"domain","registrar","expiry_date","purpose","status","dns_provider","notes","engagement","project_id"}
    count = 0
    for item in data:
        clean = {k: v for k, v in item.items() if k in _DOMAIN_FIELDS}
        if not clean.get("domain"): continue
        db.add(Domain(**clean)); count += 1
    await db.commit()
    return {"imported": count}

@app.post("/api/import/servers")
async def import_servers(data: list, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _SERVER_FIELDS = {"ip_address","hostname","status","server_provider","tags","purpose","engagement","project_id","notes"}
    count = 0
    for item in data:
        clean = {k: v for k, v in item.items() if k in _SERVER_FIELDS}
        db.add(Server(**clean)); count += 1
    await db.commit()
    return {"imported": count}

@app.post("/api/import/observations")
async def import_observations(data: list, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _OBS_FIELDS = {"title","severity","description","remediation","tags"}
    count = 0
    for item in data:
        clean = {k: v for k, v in item.items() if k in _OBS_FIELDS}
        if not clean.get("title"): continue
        db.add(Observation(**clean)); count += 1
    await db.commit()
    return {"imported": count}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_proj_or_404(db, pid): return await _generic_404(db, Project, pid)
async def _get_user_or_404(db, uid): return await _generic_404(db, User, uid)
async def _get_client_or_404(db, cid): return await _generic_404(db, Client, cid)
async def _get_domain_or_404(db, did): return await _generic_404(db, Domain, did)
async def _get_design_or_404(db, did): return await _generic_404(db, ReportDesign, did)
async def _get_server_or_404(db, sid): return await _generic_404(db, Server, sid)
async def _get_observation_or_404(db, oid): return await _generic_404(db, Observation, oid)
async def _get_oplog_or_404(db, oid): return await _generic_404(db, OpLog, oid)
async def _get_entry_or_404(db, eid, oplog_id=None):
    result = await db.execute(select(OpLogEntry).where(OpLogEntry.id == eid))
    obj = result.scalar_one_or_none()
    if not obj or (oplog_id is not None and obj.oplog_id != oplog_id):
        raise HTTPException(status_code=404, detail="OpLogEntry not found")
    return obj

async def _generic_404(db, model, pk):
    result = await db.execute(select(model).where(model.id == pk))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return obj


def _user_dict(u: User) -> dict:
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "display_name": u.display_name, "role": u.role, "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }


def _risk_counts(report_data: dict) -> dict:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}
    for section in (report_data or {}).get("sections", []):
        if not section.get("enabled", True): continue
        for f in section.get("findings", []):
            sev = f.get("severity", "informational").lower()
            if sev == "info": sev = "informational"
            if sev in counts: counts[sev] += 1
    return counts


def _project_summary(p: Project) -> dict:
    rd = p.report_data or {}
    dates = rd.get("meta", {}).get("dates", {})
    return {
        "id": p.id, "name": p.name, "report_id": p.report_id,
        "client_name": p.client_name, "client_id": p.client_id,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "assessment_start": dates.get("assessment_start") or None,
        "assessment_end": dates.get("assessment_end") or None,
        "risk_counts": _risk_counts(p.report_data),
    }


def _project_detail(p: Project) -> dict:
    d = _project_summary(p); d["report_data"] = p.report_data; return d


def _client_dict(c: Client) -> dict:
    return {
        "id": c.id, "name": c.name, "industry": c.industry,
        "contact_name": c.contact_name, "contact_title": c.contact_title,
        "contact_email": c.contact_email, "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _domain_dict(d: Domain) -> dict:
    return {
        "id": d.id, "domain": d.domain, "registrar": d.registrar,
        "purchase_date": d.purchase_date or "", "expiry_date": d.expiry_date or "",
        "auto_renew": bool(d.auto_renew), "purpose": d.purpose,
        "status": d.status, "whois_status": d.whois_status or "enabled",
        "health_status": d.health_status or "healthy",
        "reset_dns": bool(d.reset_dns),
        "dns_provider": d.dns_provider,
        "notes": d.notes, "engagement": d.engagement,
        "project_id": d.project_id,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _server_dict(s: Server) -> dict:
    return {
        "id": s.id, "ip_address": s.ip_address, "hostname": s.hostname,
        "status": s.status, "server_provider": s.server_provider, "tags": s.tags,
        "purpose": s.purpose, "engagement": s.engagement, "project_id": s.project_id,
        "notes": s.notes,
        "purchase_date": s.purchase_date or "", "expiry_date": s.expiry_date or "",
        "health_status": s.health_status or "healthy",
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _observation_dict(o: Observation) -> dict:
    return {
        "id": o.id, "title": o.title, "severity": o.severity,
        "description": o.description, "remediation": o.remediation, "tags": o.tags,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _oplog_dict(lg: OpLog) -> dict:
    return {
        "id": lg.id, "name": lg.name, "project_id": lg.project_id,
        "notifications_enabled": lg.notifications_enabled,
        "created_by": lg.created_by,
        "created_at": lg.created_at.isoformat() if lg.created_at else None,
    }


def _entry_dict(e: OpLogEntry) -> dict:
    return {
        "id": e.id, "oplog_id": e.oplog_id,
        "start_date": e.start_date, "end_date": e.end_date,
        "source_ip": e.source_ip, "dest_ip": e.dest_ip,
        "tool": e.tool, "user_context": e.user_context,
        "command": e.command, "description": e.description,
        "output": e.output, "comments": e.comments,
        "operator_name": e.operator_name, "tags": e.tags,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }

def _evidence_dict(ev: OpLogEvidence) -> dict:
    return {
        "id": ev.id, "oplog_id": ev.oplog_id, "entry_id": ev.entry_id,
        "friendly_name": ev.friendly_name, "caption": ev.caption,
        "description": ev.description, "tags": ev.tags,
        "evidence_type": ev.evidence_type,
        "filename": ev.filename,
        "url": f"/api/oplog-media/{ev.oplog_id}/{ev.filename}",
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }


def _design_dict(d: ReportDesign) -> dict:
    return {
        "id": d.id, "name": d.name, "description": d.description,
        "report_type": d.report_type, "is_default": d.is_default,
        "config": d.config,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _blank_report(name, report_id, client_name, client_id=None, db=None) -> dict:
    return {
        "meta": {
            "report_id": report_id or "RS-2026-001",
            "title": "Penetration Test Report", "subtitle": "",
            "client": {
                "name": client_name or name, "contact_name": "",
                "contact_title": "", "contact_email": "", "logo_path": "",
            },
            "consultant": {
                "firm": "RootSec", "name": "", "title": "", "email": "", "firm_logo_path": "",
            },
            "dates": {
                "assessment_start": "", "assessment_end": "",
                "report_date": "", "report_version": "1.0",
            },
            "classification": "CONFIDENTIAL", "distribution": [],
        },
        "version_history": [],
        "introduction": {
            "preamble": "", "objective": "", "approach": "",
            "testing_team": [],
            "testing_dates": {"start": "", "end": ""},
            "caveats": [], "authorization": "",
        },
        "scope": {"in_scope": [], "out_of_scope": [], "rules_of_engagement": "", "methodology": []},
        "executive_summary": {"overall_risk_rating": "High", "narrative": "", "key_findings": []},
        "technical_summary": {"narrative": ""},
        "risk_summary": {"counts": {}},
        "sections": [],
        "exploitation_scenarios": [],
        "remediation_roadmap": {},
        "appendices": [],
    }


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "report").lower()).strip("-")


async def _seed_report_designs(db: AsyncSession) -> None:
    # Remove stale seeded designs that are no longer wanted
    stale_names = ["Red Team Assessment", "Web Application Assessment", "Cloud Security Review"]
    for name in stale_names:
        r = await db.execute(select(ReportDesign).where(ReportDesign.name == name))
        obj = r.scalars().first()
        if obj:
            await db.delete(obj)
    await db.commit()

    result = await db.execute(select(ReportDesign))
    if result.scalars().first() is not None:
        return
    db.add(ReportDesign(
        name="Penetration Test Report", report_type="pentest", is_default=True,
        description="Standard internal/external penetration test report covering infrastructure, web, and API testing.",
        config={"sections": ["introduction", "exec_summary", "technical_summary", "findings", "appendices"]},
    ))
    await db.commit()


async def _seed_finding_templates(db: AsyncSession) -> None:
    result = await db.execute(select(FindingTemplate))
    if result.scalars().first() is not None:
        return
    seeds = [
        FindingTemplate(title='LLMNR / NBT-NS Poisoning', severity='high', category='Active Directory',
            description='Link-Local Multicast Name Resolution (LLMNR) and NetBIOS Name Service (NBT-NS) are enabled on the network, allowing an attacker to respond to failed DNS lookups and capture NTLMv2 hashes from victim hosts.',
            recommendations='Disable LLMNR and NBT-NS via Group Policy. Enable DNS-only name resolution.',
            tags=['AD', 'credential capture', 'lateral movement']),
        FindingTemplate(title='Kerberoasting', severity='high', category='Active Directory',
            description='Service accounts with SPNs registered in Active Directory can have their TGS tickets requested by any authenticated domain user and cracked offline to recover plaintext passwords.',
            recommendations='Use managed service accounts (gMSA). Enforce strong, regularly rotated passwords (25+ chars) on service accounts.',
            tags=['AD', 'credential cracking', 'privilege escalation']),
        FindingTemplate(title='SQL Injection', severity='critical', category='Web Application',
            description='User-supplied input is incorporated into SQL queries without adequate sanitisation, allowing an attacker to manipulate database queries and potentially extract, modify, or delete data.',
            recommendations='Use parameterised queries / prepared statements. Implement input validation. Apply least-privilege DB accounts.',
            tags=['OWASP', 'injection', 'database']),
        FindingTemplate(title='Broken Access Control', severity='high', category='Web Application',
            description='Access control checks are missing or insufficiently enforced, allowing users to access functionality or data outside their authorised scope.',
            recommendations='Implement server-side access control on every endpoint. Apply deny-by-default policy.',
            tags=['OWASP', 'authorisation', 'IDOR']),
        FindingTemplate(title='Missing HTTP Security Headers', severity='low', category='Web Application',
            description='Key security response headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) are absent, increasing exposure to clickjacking, MIME-sniffing, and XSS attacks.',
            recommendations='Configure web server / application to emit all recommended security headers. Use SecurityHeaders.com to validate.',
            tags=['headers', 'hardening']),
        FindingTemplate(title='Default Credentials', severity='critical', category='Infrastructure',
            description='A network device or application is accessible using vendor-default credentials, allowing immediate unauthorised access without exploitation.',
            recommendations='Change all default credentials immediately. Implement a credential rotation policy. Use a password manager.',
            tags=['credentials', 'initial access']),
    ]
    for s in seeds:
        db.add(s)
    await db.commit()


# ═══ FINDING TEMPLATES ═══


class TemplateCreate(BaseModel):
    title: str
    severity: str = "medium"
    category: str = ""
    description: str = ""
    impact: str = ""
    recommendations: str = ""
    tags: list = []
    cvss_score: Optional[float] = None
    cvss_vector: str = ""


class TemplateUpdate(BaseModel):
    title: Optional[str] = None
    severity: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    recommendations: Optional[str] = None
    tags: Optional[list] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None


def _template_dict(t: FindingTemplate) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "severity": t.severity,
        "category": t.category,
        "description": t.description,
        "impact": t.impact or "",
        "recommendations": t.recommendations,
        "tags": t.tags or [],
        "cvss_score": float(t.cvss_score) if t.cvss_score not in (None, "") else None,
        "cvss_vector": t.cvss_vector or "",
    }


@app.get("/api/templates")
async def list_templates(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(FindingTemplate).order_by(FindingTemplate.id))
    return [_template_dict(t) for t in result.scalars().all()]


@app.post("/api/templates", status_code=201)
async def create_template(body: TemplateCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    data = body.model_dump()
    if data.get("cvss_score") is not None:
        data["cvss_score"] = str(data["cvss_score"])
    t = FindingTemplate(**data)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _template_dict(t)


@app.put("/api/templates/{tid}")
async def update_template(tid: int, body: TemplateUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(FindingTemplate).where(FindingTemplate.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, str(v) if k == "cvss_score" and v is not None else v)
    t.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(t)
    return _template_dict(t)


@app.delete("/api/templates/{tid}", status_code=204)
async def delete_template(tid: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(FindingTemplate).where(FindingTemplate.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    await db.delete(t)
    await db.commit()


@app.post("/api/templates/bulk", status_code=201)
async def bulk_create_templates(items: list[TemplateCreate], db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    created = []
    for item in items:
        t = FindingTemplate(**item.model_dump())
        db.add(t)
        created.append(t)
    await db.commit()
    return {"imported": len(created)}


# ═══ TEMPLATE FILES (admin only) ═══════════════════════════════════════════════

def _get_template_dir() -> Path:
    return Path(os.environ.get("TEMPLATE_DIR", str(_PENTEST_DIR / "templates")))


def _safe_template_path(filename: str) -> Path:
    """Resolve filename relative to template dir; reject path traversal."""
    tdir = _get_template_dir()
    resolved = (tdir / filename).resolve()
    if not str(resolved).startswith(str(tdir.resolve())):
        raise HTTPException(400, "Invalid path")
    return resolved


@app.get("/api/admin/template-files")
async def list_template_files(_=Depends(require_admin)):
    tdir = _get_template_dir()
    files = []
    for p in sorted(tdir.rglob("*")):
        if p.is_file() and p.suffix in (".j2", ".css", ".html"):
            rel = str(p.relative_to(tdir)).replace("\\", "/")
            files.append({"path": rel, "size": p.stat().st_size})
    return files


@app.get("/api/admin/template-files/{file_path:path}")
async def get_template_file(file_path: str, _=Depends(require_admin)):
    p = _safe_template_path(file_path)
    if not p.exists():
        raise HTTPException(404)
    return {"path": file_path, "content": p.read_text(encoding="utf-8")}


@app.put("/api/admin/template-files/{file_path:path}")
async def update_template_file(file_path: str, body: dict, _=Depends(require_admin)):
    p = _safe_template_path(file_path)
    if not p.exists():
        raise HTTPException(404)
    content = body.get("content", "")
    p.write_text(content, encoding="utf-8")
    return {"path": file_path, "saved": True}


@app.post("/api/admin/template-files/reset/{file_path:path}")
async def reset_template_file(file_path: str, _=Depends(require_admin)):
    """Reset a template file to the built-in default."""
    tdir = _get_template_dir()
    default_src = _PENTEST_DIR / "templates" / file_path
    dst = _safe_template_path(file_path)
    if not default_src.exists():
        raise HTTPException(404, "No default for this file")
    shutil.copy2(str(default_src), str(dst))
    return {"path": file_path, "content": dst.read_text(encoding="utf-8")}


# ═══ PER-DESIGN TEMPLATE FILES (admin only) ═══════════════════════════════════

def _get_design_template_dir(design_id: int) -> Path:
    return DATA_DIR / "template-designs" / str(design_id)


def _ensure_design_template_dir(design_id: int) -> Path:
    """Create per-design template directory from built-in defaults on first access."""
    tdir = _get_design_template_dir(design_id)
    if not tdir.exists():
        src = _PENTEST_DIR / "templates"
        shutil.copytree(str(src), str(tdir))
    return tdir


def _safe_design_path(design_id: int, filename: str) -> Path:
    tdir = _ensure_design_template_dir(design_id)
    resolved = (tdir / filename).resolve()
    if not str(resolved).startswith(str(tdir.resolve())):
        raise HTTPException(400, "Invalid path")
    return resolved


@app.get("/api/admin/designs/{design_id}/template-files")
async def list_design_template_files(
    design_id: int, _=Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    await _get_design_or_404(db, design_id)
    tdir = _ensure_design_template_dir(design_id)
    files = []
    for p in sorted(tdir.rglob("*")):
        if p.is_file() and p.suffix in (".j2", ".css", ".html"):
            rel = str(p.relative_to(tdir)).replace("\\", "/")
            files.append({"path": rel, "size": p.stat().st_size})
    return files


@app.get("/api/admin/designs/{design_id}/template-files/{file_path:path}")
async def get_design_template_file(
    design_id: int, file_path: str, _=Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    await _get_design_or_404(db, design_id)
    p = _safe_design_path(design_id, file_path)
    if not p.exists():
        raise HTTPException(404)
    return {"path": file_path, "content": p.read_text(encoding="utf-8")}


@app.put("/api/admin/designs/{design_id}/template-files/{file_path:path}")
async def update_design_template_file(
    design_id: int, file_path: str, body: dict, _=Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    await _get_design_or_404(db, design_id)
    p = _safe_design_path(design_id, file_path)
    if not p.exists():
        raise HTTPException(404)
    p.write_text(body.get("content", ""), encoding="utf-8")
    return {"path": file_path, "saved": True}


@app.post("/api/admin/designs/{design_id}/template-files/reset/{file_path:path}")
async def reset_design_template_file(
    design_id: int, file_path: str, _=Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    await _get_design_or_404(db, design_id)
    default_src = _PENTEST_DIR / "templates" / file_path
    if not default_src.exists():
        raise HTTPException(404, "No default for this file")
    tdir = _ensure_design_template_dir(design_id)
    dst = (tdir / file_path).resolve()
    if not str(dst).startswith(str(tdir.resolve())):
        raise HTTPException(400, "Invalid path")
    shutil.copy2(str(default_src), str(dst))
    return {"path": file_path, "content": dst.read_text(encoding="utf-8")}


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Static files (React SPA) ──────────────────────────────────────────────────
_FRONTEND_DIST = _HERE.parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = _FRONTEND_DIST / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
