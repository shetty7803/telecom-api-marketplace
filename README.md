# Telecom API Marketplace — WSO2 APIM 4.6

> Complete, runnable WSO2-based Telecom API Marketplace for MVNO partners.
> Node.js + Express backends · WSO2 APIM · WSO2 MI · WSO2 IS · MySQL · Docker

---

## Quick start (single command)

```bash
git clone <repo> && cd telecom-api-marketplace
cp .env.example .env
docker-compose up -d
```

Wait ~3 minutes for all services to start, then open:

| Portal | URL | Credentials |
|---|---|---|
| Admin Portal | https://localhost:9443/admin | admin / admin |
| Publisher Portal | https://localhost:9443/publisher | admin / admin |
| Developer Portal | https://localhost:9443/devportal | admin / admin |
| WSO2 IS Console | https://localhost:9444/console | admin / admin |
| MI Dashboard | https://localhost:9264/dashboard | admin / admin |
| Grafana | http://localhost:3000 | admin / admin |

---

## Architecture

```
MVNO App
   │
   ▼ HTTPS :8243
WSO2 APIM Gateway
   │ token introspection
   ▼
WSO2 Identity Server :9444
   │ validated
   ▼
Throttle + Scope check (in-memory)
   │ allowed
   ▼
WSO2 Micro Integrator :8290
   │ XML→JSON transform
   ▼
Node.js Services
   ├── plan-service    :9091  (REST + SOAP)
   ├── network-service :9092  (REST)
   └── usage-service   :9093  (REST)
   │
   ▼
Analytics → Admin Portal Dashboard
```

---

## Project structure

```
telecom-api-marketplace/
├── README.md
├── .env.example
├── docker-compose.yml
├── backends/
│   ├── plan-service/
│   │   ├── index.js
│   │   ├── soap-service.js
│   │   ├── data/plans.json
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── network-service/
│   │   ├── index.js
│   │   ├── data/network.json
│   │   ├── package.json
│   │   └── Dockerfile
│   └── usage-service/
│       ├── index.js
│       ├── data/usage.json
│       ├── package.json
│       └── Dockerfile
├── integration/
│   ├── sequences/
│   │   ├── xml-to-json-seq.xml
│   │   ├── error-handler-seq.xml
│   │   └── aggregate-usage-seq.xml
│   ├── endpoints/
│   │   ├── PlanServiceEndpoint.xml
│   │   └── UsageServiceEndpoint.xml
│   └── apis/
│       └── PlanTransformAPI.xml
├── apim/
│   ├── repository/conf/deployment.toml
│   └── throttle-policies/
│       ├── BasicTier.xml
│       ├── BusinessTier.xml
│       └── PremiumTier.xml
├── identity/
│   └── repository/conf/deployment.toml
├── cicd/
│   ├── jenkins/Jenkinsfile
│   └── apictl/
│       ├── apis/
│       │   ├── plan-api/
│       │   ├── network-status-api/
│       │   └── usage-api/
│       ├── api-products/
│       └── environments/
├── k8s/
├── monitoring/
│   └── grafana/dashboards/
├── scripts/
│   ├── setup.sh
│   ├── import-apis.sh
│   └── test-flow.sh
├── tests/
│   └── postman/
│       └── Telecom-API-Marketplace.postman_collection.json
└── docs/
    └── architecture.md
```

---

## Step-by-step execution guide

### 1. Prerequisites

```bash
# Check versions
docker --version          # 24.x+
docker-compose --version  # 2.x+
node --version            # 20.x LTS
apictl version            # 4.x (install below)

# Install apictl
curl -L https://github.com/wso2/product-apim-tooling/releases/download/v4.3.0/apictl-4.3.0-linux-x64.tar.gz | tar xz
sudo mv apictl /usr/local/bin/
apictl version
```

### 2. Start all services

```bash
docker-compose up -d
docker-compose ps          # all should show "healthy"
docker-compose logs -f wso2-apim   # watch startup (~2 min)
```

### 3. Configure APIM — Admin Portal

Open https://localhost:9443/admin

a) **Throttle tiers**: Advanced Policies → Add
   - Basic: 100 req/min
   - Business: 500 req/min
   - Premium: 2000 req/min

b) **Key Manager**: Key Managers → Add
   - Name: WSO2-IS
   - Type: WSO2 Identity Server
   - Token endpoint: https://wso2-is:9443/oauth2/token
   - Introspection: https://wso2-is:9443/oauth2/introspect

c) **User roles**: Users → Roles → Add roles: mvno-partner, internal-dev, api-publisher

### 4. Publish APIs — Publisher Portal

Open https://localhost:9443/publisher

```bash
# Or use the automated script:
./scripts/import-apis.sh
```

### 5. Subscribe — Developer Portal

Open https://localhost:9443/devportal

a) Register → Create application "mvno-app-a"
b) Subscribe to "MVNO Partner Bundle" on Business tier
c) Generate Keys → copy client_id + client_secret

### 6. Test end-to-end

```bash
./scripts/test-flow.sh

# Or manually:
# 1. Get token
TOKEN=$(curl -s -X POST https://localhost:9444/oauth2/token \
  -k \
  -d "grant_type=client_credentials&client_id=CLIENT_ID&client_secret=CLIENT_SECRET" \
  | jq -r '.access_token')

# 2. Call Plan API
curl -H "Authorization: Bearer $TOKEN" \
     https://localhost:8243/telecom/plan/v1/plans -k | jq .
```
