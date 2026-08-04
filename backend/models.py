from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Text
from database import Base


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    username     = Column(String(50), unique=True, nullable=False)
    email        = Column(String(200), unique=True, nullable=True)
    display_name = Column(String(100), default="")
    password_hash= Column(String(200), nullable=False)
    role         = Column(String(20), default="user")    # admin | user
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    last_login   = Column(DateTime, nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(200), nullable=False)
    report_id   = Column(String(50), default="")
    client_name = Column(String(200), default="")
    client_id   = Column(Integer, nullable=True)        # optional link to Client row
    status      = Column(String(20), default="active")  # active | complete | archived
    created_by  = Column(Integer, nullable=True)        # User.id
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    report_data = Column(JSON, default=dict)


class Client(Base):
    __tablename__ = "clients"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(200), nullable=False)
    industry      = Column(String(100), default="")
    contact_name  = Column(String(100), default="")
    contact_title = Column(String(100), default="")
    contact_email = Column(String(200), default="")
    notes         = Column(Text, default="")
    created_at    = Column(DateTime, default=datetime.utcnow)


class Domain(Base):
    __tablename__ = "domains"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    domain        = Column(String(255), nullable=False)
    registrar     = Column(String(100), default="")
    purchase_date = Column(String(20), default="")
    expiry_date   = Column(String(20), default="")
    auto_renew    = Column(Boolean, default=False)
    purpose       = Column(String(50), default="Infrastructure")
    status        = Column(String(20), default="active")   # active | expired | burned | parked
    whois_status  = Column(String(20), default="enabled")  # enabled | disabled
    health_status = Column(String(20), default="healthy")  # healthy | unknown | unhealthy | burned
    reset_dns     = Column(Boolean, default=False)
    dns_provider  = Column(String(100), default="")
    notes         = Column(Text, default="")
    engagement    = Column(String(100), default="")
    project_id    = Column(Integer, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)


class ReportDesign(Base):
    __tablename__ = "report_designs"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(200), nullable=False)
    description = Column(Text, default="")
    report_type = Column(String(50), default="pentest")   # pentest | redteam | webapp | cloud
    is_default  = Column(Boolean, default=False)
    config      = Column(JSON, default=dict)              # section ordering, visibility, etc.
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Server(Base):
    __tablename__ = "servers"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    ip_address      = Column(String(45), default="")
    hostname        = Column(String(255), default="")
    status          = Column(String(20), default="available")  # available | reserved | active | burned | retired
    server_provider = Column(String(100), default="")
    tags            = Column(Text, default="")
    purpose         = Column(String(50), default="C2")   # C2 | Phishing | Redirector | Listener | Other
    engagement      = Column(String(100), default="")
    project_id      = Column(Integer, nullable=True)
    notes           = Column(Text, default="")
    purchase_date   = Column(String(20), default="")
    expiry_date     = Column(String(20), default="")
    health_status   = Column(String(20), default="healthy")  # healthy | unknown | unhealthy | burned
    created_at      = Column(DateTime, default=datetime.utcnow)


class Observation(Base):
    __tablename__ = "observations"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    title       = Column(String(300), nullable=False)
    severity    = Column(String(20), default="informational")
    description = Column(Text, default="")
    remediation = Column(Text, default="")
    tags        = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OpLog(Base):
    __tablename__ = "oplogs"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    name                   = Column(String(300), nullable=False)
    project_id             = Column(Integer, nullable=True)
    notifications_enabled  = Column(Boolean, default=True)
    created_by             = Column(Integer, nullable=True)
    created_at             = Column(DateTime, default=datetime.utcnow)


class OpLogEntry(Base):
    __tablename__ = "oplog_entries"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    oplog_id      = Column(Integer, nullable=False)
    start_date    = Column(String(50), default="")
    end_date      = Column(String(50), default="")
    source_ip     = Column(String(100), default="")
    dest_ip       = Column(String(100), default="")
    tool          = Column(String(100), default="")
    user_context  = Column(String(100), default="")
    command       = Column(Text, default="")
    description   = Column(Text, default="")
    output        = Column(Text, default="")
    comments      = Column(Text, default="")
    operator_name = Column(String(100), default="")
    tags          = Column(String(300), default="")
    created_at    = Column(DateTime, default=datetime.utcnow)


class OpLogEvidence(Base):
    __tablename__ = "oplog_evidence"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    oplog_id      = Column(Integer, nullable=False)
    entry_id      = Column(Integer, nullable=True)
    friendly_name = Column(String(200), default="")
    caption       = Column(String(500), default="")
    description   = Column(Text, default="")
    tags          = Column(String(300), default="")
    evidence_type = Column(String(20), default="image")   # image | cast | file
    file_path     = Column(String(500), default="")
    filename      = Column(String(200), default="")
    created_at    = Column(DateTime, default=datetime.utcnow)


class FindingTemplate(Base):
    __tablename__ = "finding_templates"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    title           = Column(String(300), nullable=False)
    severity        = Column(String(20), default="medium")
    category        = Column(String(100), default="")
    description     = Column(Text, default="")
    recommendations = Column(Text, default="")
    tags            = Column(JSON, default=list)
    cvss_score      = Column(String(10), nullable=True)  # stored as string to preserve "0.0" vs null
    cvss_vector     = Column(Text, default="")
    impact          = Column(Text, default="")
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
