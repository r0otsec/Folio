# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build

# Install deps separately so this layer is cached unless package files change
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime + Playwright ──────────────────────────────────────
FROM python:3.12-slim

# System packages required by Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Install Playwright + Chromium (cached separately from apt packages)
RUN pip install --no-cache-dir playwright && playwright install chromium

# Application source
COPY pentest-report/ ./pentest-report/
COPY backend/        ./backend/
COPY run.py          ./run.py

# Copy built frontend from Stage 1
COPY --from=frontend-builder /build/dist ./frontend/dist/

# Data directory (overridden by named volume in production)
RUN mkdir -p /app/data

ENV DATA_DIR=/app/data
ENV PENTEST_DIR=/app/pentest-report
ENV BACKEND_DIR=/app/backend
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["python", "run.py"]
