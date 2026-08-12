# 07 — Deployment Guide

## Current state: no deployment tooling exists

Confirmed by direct inspection of the repository root: **there is no `Dockerfile`, no `docker-compose.yml`, no `.dockerignore`, no CI/CD configuration of any kind** (no `.github/workflows/`, no `.gitlab-ci.yml`, no Jenkinsfile, no Azure Pipelines YAML — a repo-wide search for `docker*` and `*.yml`/`*.yaml` files outside `node_modules` returned nothing). The only "deployment" artifact present is `start-dev.bat`, a three-line Windows batch script:

```bat
@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "C:\Users\varsh\Documents\reg-reporting-tool"
call npm run dev
```

This is a **developer convenience script for running the Next.js dev server locally on Windows** — it hardcodes a specific developer's local path and runs `next dev` (development mode, not a production build). It is not a deployment mechanism.

`package.json` does define standard Next.js scripts (`dev`, `build`, `start`, `lint`) that are the building blocks for a real deployment, but no infrastructure to run them repeatably (containers, orchestration, pipelines) exists yet.

## What you actually need to deploy this today, step by step

Because there is no containerization, the most direct path to a working deployment is a VM or on-prem server running Node.js directly, with Oracle DB reachable from it. Three realistic options are described below in increasing order of production-readiness.

### Option A — On-prem/VM, process-manager based (fastest path from current state)

Suitable for: internal pilot, UAT, or a bank's existing on-prem VM estate where Docker isn't yet standard.

1. **Provision a VM/server** (Windows or Linux) with Node.js 20+ installed (matches `@types/node: ^20` in `package.json`) and network access to the Oracle DB host/port.
2. **Install Oracle Instant Client** (required by the `oracledb` driver's default "thick" mode, or configure `oracledb` for thin mode — verify against the installed `oracledb@^7.0.1` driver's requirements before assuming either mode).
3. Copy the repository to the server (via git clone or artifact copy — no build artifact packaging exists today, so this is a manual step).
4. Create a **real** `.env.local` (or equivalent env-var injection) on the server itself, sourced from a secrets manager rather than committed anywhere — see `06-Security-Assessment.md` §5. Required variables: `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING` (see `08-Prototype-vs-Production.md` for the full env-var table).
5. Run `npm install` (installs from `package-lock.json`, present in repo).
6. Run `npm run build` (`next build`, production build with Turbopack).
7. Run `npm run start` (`next start`) under a **process manager** (e.g., `pm2`, Windows Service via `nssm`, or `systemd` on Linux) so it restarts on crash/reboot — none of this exists in the repo today and must be set up.
8. Put a **reverse proxy with TLS termination** in front of it (e.g., IIS with ARR, nginx, or a corporate load balancer) — `next start` alone serves plain HTTP with no TLS handling built in.
9. Point DNS / internal hostname at the proxy.

**Gaps this leaves unaddressed:** no horizontal scaling, no zero-downtime deploys, no automated rollback, no CI validation before deploy, and all the application-layer security gaps in `06-Security-Assessment.md` remain regardless of infrastructure choice.

### Option B — Docker (recommended next step; not present in repo today)

No `Dockerfile` exists, so this section describes what would need to be **created**, not what exists.

A minimal production Dockerfile for this stack would need to:
1. Use a Node 20+ base image.
2. Copy `package.json`/`package-lock.json`, run `npm ci`.
3. Copy source, run `npm run build`.
4. Expose the Next.js port (default 3000) and run `npm run start`.
5. Handle the `oracledb` native dependency — Oracle Instant Client libraries must be present in the image (either the "thin mode" of `oracledb@7.x`, which needs no client libraries, or "thick mode," which does — this must be confirmed against how `src/lib/db.ts`'s `oracledb.createPool()` is actually configured, since no explicit thin/thick mode selection was found in the code, meaning it is likely using the driver's default thin mode, which does not require Instant Client).
6. Inject `ORACLE_USER`/`ORACLE_PASSWORD`/`ORACLE_CONNECT_STRING` as container environment variables from a secret store, never baked into the image.

A `docker-compose.yml` for local/UAT could add an Oracle XE container alongside the app for a self-contained environment, but this does not exist in the repo and would need to be authored.

**This is a recommended near-term investment** — it would make the environment reproducible and be the natural foundation for CI/CD and Kubernetes/ECS-style orchestration later.

### Option C — Private cloud / managed platform

If the bank has an existing private cloud (OpenShift, VMware Tanzu, internal Kubernetes) or approved public cloud landing zone, the Docker image from Option B would deploy there with standard practices: a managed Oracle instance (or existing on-prem Oracle reached via private connectivity/VPN), secrets from the platform's secret manager, and the platform's built-in TLS/ingress handling. Given this is a UAE Central Bank regulatory workload, **data residency requirements likely constrain cloud choice** — this is a compliance/legal decision outside the scope of this technical audit; flag it explicitly to management before choosing a hosting model.

## Environment variables (names only — see `06-Security-Assessment.md` for why no values are reproduced here)

| Variable | Required | Source in code | Purpose |
|---|---|---|---|
| `ORACLE_USER` | Yes | `src/lib/db.ts` | Oracle DB username for the connection pool |
| `ORACLE_PASSWORD` | Yes | `src/lib/db.ts` | Oracle DB password — **must move to a secret manager, never a plaintext file, before production** |
| `ORACLE_CONNECT_STRING` | Yes | `src/lib/db.ts` | Oracle connect string (host:port/service or TNS alias) |

No other environment variables are read anywhere in the codebase (confirmed by searching for `process.env` — only these three appear, all in `src/lib/db.ts`).

## What is explicitly NOT set up and must be built before production

- No CI pipeline to run `npm run lint` / a build / tests on every change (and there are no tests to run yet — see `12-Risks-and-Roadmap.md`).
- No automated deployment (manual `npm run build && npm run start` today).
- No health-check endpoint (no `/api/health` or equivalent was found).
- No graceful shutdown handling for the Oracle connection pool (`src/lib/db.ts` creates a pool but there's no observed `pool.close()` on process termination).
- No log aggregation — the app doesn't appear to use a structured logging library; errors would surface as default Next.js console output only.
- No documented backup/restore or disaster-recovery procedure for the Oracle database (out of scope of this codebase, but essential before go-live).

## Recommended sequencing

1. Containerize (Option B) — biggest leverage for reproducibility and the foundation for everything after it.
2. Stand up CI (lint + build, then tests once they exist) on every push/PR.
3. Add a staging environment separate from production, with its own Oracle schema/credentials.
4. Put TLS and a real identity provider in front of it (see `03-System-Architecture.md`'s recommended architecture) before any real data touches it.
5. Only then consider production go-live — and only for the two report types that are actually built, with an explicit, communicated plan for the rest of the catalog.
