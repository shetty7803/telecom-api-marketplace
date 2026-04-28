# 📡 Telecom API Marketplace

> Enterprise API Management Platform built on **WSO2 API Manager 4.6**

A production-grade telecom API gateway that enables MVNO (Mobile Virtual Network Operator) partners to securely access telecom services — Plan data, Network Status, and Usage — through a centralized, secured API gateway with OAuth2 authentication, scope-based access control, and real-time analytics.

---

## 🏗️ Architecture

```
MVNO Partner
    │
    │  POST /oauth2/token → Bearer Token
    ▼
WSO2 API Gateway (WSL :8280 / :9443)
    ├── ✅ Token valid?
    ├── ✅ API subscribed?
    ├── ✅ Scope matches?
    └── ✅ Rate limit OK?
    │
    ▼
Backend Services (Docker)
    ├── plan-service    :9091  (Node.js 18)
    ├── network-service :9092  (Node.js 20)
    └── usage-service   :9093  (Node.js 20)

Analytics Dashboard (Node.js :4000)
    └── Real-time tracking of all test requests
```

---

## 🚀 What's Built

| Component | Technology | Status |
|-----------|-----------|--------|
| API Gateway | WSO2 APIM 4.6 on WSL2 | ✅ Running |
| WSO2 Database | H2 Embedded (auto-managed) | ✅ Running |
| Plan API | Node.js 18 + Express + soap@0.45.0 | ✅ Published |
| Network Status API | Node.js 20 + Express | ✅ Published |
| Usage API | Node.js 20 + Express | ✅ Published |
| MySQL 8.0 | Docker :3307 | ✅ Running (future use) |
| Analytics Dashboard | HTML/CSS/JS + Node.js :4000 | ✅ Running |

---

## 📋 APIs

| API | Context | Version | Scope |
|-----|---------|---------|-------|
| Plan API | `/plan` | 1.0.0 | `plan:read` |
| Network Status API | `/network` | 1.0.0 | `networkread` |
| Usage API | `/usage` | 1.0.0 | `usage:read`, `usage:export` |

---

## 🔐 Security

- **OAuth2 Client Credentials** — every request requires a Bearer token
- **JWT validation** — WSO2 validates token signature and expiry
- **Scope enforcement** — token must include correct scope for the API
- **Rate limiting** — Bronze (10/min), Silver (50/min), Gold (500/min), Unlimited

---

## ⚡ Daily Startup

```powershell
# 1. PowerShell — Start Docker services
cd C:\telecom-api-marketplace
docker-compose up -d
```

```bash
# 2. WSL — Start WSO2 APIM
cd /mnt/c/WSO2/wso2am-4.6.0/bin
./api-manager.sh start
```

```bash
# 3. WSL — Start Analytics Dashboard
cd /mnt/c/telecom-api-marketplace/analytics-dashboard/backend
node src/server.js
```

```
# 4. Open in Browser
http://localhost:4000             # Analytics Dashboard
https://localhost:9443/publisher  # WSO2 Publisher Portal
https://localhost:9443/devportal  # WSO2 Developer Portal
```

---

## 📊 Analytics Dashboard

Custom dashboard at `http://localhost:4000` with 12 pages including Overview, Performance, Partners, Plan Availability, Region Usage, API Tester, Errors, Throttling, Manage APIs, Manage Partners, Scopes, and Health.

**Auto-Token Feature:** Select partner → paste Consumer Key/Secret → Get Token → Send Request (token auto-used)

---

## 🗄️ Database

| Database | Use | Notes |
|----------|-----|-------|
| H2 Embedded | WSO2 internal | Auto-managed, zero config |
| MySQL 8.0 :3307 | Backend services | Running in Docker — future use |

---

## 🔧 MVNO Partner App

```
Consumer Key:    Z5al_ZeA06P1txth5h5_HfaNKisa
Consumer Secret: IBbtJmUNaoVydZXUJW7fmyfuVhka
Token URL:       POST https://localhost:9443/oauth2/token
Scopes:          plan:read networkread usage:read
```

---

## 📦 Tech Stack

WSO2 APIM 4.6 · Node.js 18/20 · Express.js · Docker · H2 Embedded · MySQL 8.0 · WSL2 Ubuntu · Chart.js · OpenJDK 11

---

## 👤 Author

**Jeevan D** · Telecom API Marketplace · WSO2 APIM 4.6 · 2026
