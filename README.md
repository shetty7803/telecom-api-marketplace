# 📡 Telecom API Marketplace

> **Enterprise-grade API management platform** for MVNO (Mobile Virtual Network Operator) partners — built on WSO2 API Manager 4.6, WSO2 Micro Integrator, Docker, and Node.js.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MVNO PARTNER (Client)                        │
│                    Postman / Browser / Mobile App                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  HTTPS :8243 / HTTP :8280
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WSO2 API MANAGER 4.6 (WSL)                       │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Admin Portal│  │  Publisher   │  │    Developer Portal       │  │
│  │  :9443/admin│  │  :9443/pub   │  │    :9443/devportal        │  │
│  └─────────────┘  └──────────────┘  └───────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              API GATEWAY (Token Validation + Rate Limit)     │    │
│  │         Plan API /plan/1.0.0  |  Network /network/1.0.0      │    │
│  │         Usage API /usage/1.0.0                               │    │
│  └──────────────────┬──────────────────────────────────────────┘    │
│                     │                                               │
│         ┌───────────▼────────────┐                                  │
│         │   WSO2 MICRO INTEGRATOR│  (XML↔JSON Transform)            │
│         │         :8290          │  (SOAP→REST conversion)          │
│         └───────────┬────────────┘                                  │
└─────────────────────┼───────────────────────────────────────────────┘
                      │  Backend calls
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DOCKER CONTAINERS (Windows)                      │
│                                                                     │
│  ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────────┐ │
│  │  plan-service   │ │ network-service  │ │   usage-service      │ │
│  │    :9091        │ │     :9092        │ │       :9093          │ │
│  │  REST + SOAP    │ │     REST         │ │       REST           │ │
│  │  Mock Data      │ │    Mock Data     │ │     Mock Data        │ │
│  └─────────────────┘ └──────────────────┘ └──────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              MySQL 8.0    :3307 (standby)                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Concepts Covered

| # | Concept | Implementation |
|---|---------|---------------|
| 1 | **API Gateway** | WSO2 APIM routes and secures all API traffic |
| 2 | **OAuth2 / JWT** | Client credentials flow for MVNO partner authentication |
| 3 | **Rate Limiting** | Bronze (1000/min), Silver (2000/min), Gold (5000/min) tiers |
| 4 | **API Lifecycle** | Created → Published → Deprecated → Retired |
| 5 | **API Versioning** | Context-based versioning (`/plan/1.0.0`) |
| 6 | **REST APIs** | 3 microservices exposing RESTful endpoints |
| 7 | **SOAP/XML** | Plan service exposes legacy SOAP endpoint for MI integration |
| 8 | **Protocol Transformation** | WSO2 MI converts SOAP/XML → REST/JSON |
| 9 | **Containerization** | Docker + docker-compose for all backend services |
| 10 | **API Security** | Token validation, scope enforcement, 401/403 responses |
| 11 | **Multi-tier Subscription** | MVNO partners subscribe with different SLA tiers |
| 12 | **Developer Portal** | Self-service API discovery and key generation |
| 13 | **Embedded Database** | H2 database for WSO2 internal data (zero config) |
| 14 | **Corporate Proxy** | npm mirror registry for restricted network environments |
| 15 | **Health Checks** | Docker healthcheck on all 3 Node.js services |

---

## 🛠️ Tech Stack

### API Management
| Tool | Version | Role |
|------|---------|------|
| WSO2 API Manager | 4.6.0 | API Gateway, Publisher, Developer Portal, Admin Portal |
| WSO2 Micro Integrator | 4.3.0 | Protocol transformation, SOAP→REST, mediation |
| H2 Database | 2.3.232 | WSO2 internal data (embedded, zero config) |

### Backend Services
| Tool | Version | Role |
|------|---------|------|
| Node.js | 20 (Alpine) | Runtime for all 3 microservices |
| Express.js | 4.x | REST API framework |
| node-soap | latest | SOAP server for plan-service legacy BSS simulation |

### Infrastructure
| Tool | Version | Role |
|------|---------|------|
| Docker | 24.x | Container runtime for backend services |
| Docker Compose | v2 | Multi-container orchestration |
| MySQL | 8.0 | Relational database (available, not yet connected) |
| WSL2 | Ubuntu 22.04 | Linux environment on Windows for WSO2 |

### Development
| Tool | Role |
|------|------|
| Postman | API testing and token generation |
| PowerShell | Windows automation and API testing |
| Git | Version control |

---

## 📁 Project Structure

```
telecom-api-marketplace/
│
├── backends/
│   ├── plan-service/           # Telecom plan data — REST + SOAP (:9091)
│   │   ├── index.js
│   │   ├── plan-service.wsdl   # WSDL for legacy BSS simulation
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── network-service/        # Network status by region (:9092)
│   │   ├── index.js
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── usage-service/          # Subscriber usage & billing (:9093)
│       ├── index.js
│       ├── package.json
│       └── Dockerfile
│
├── integration/                # WSO2 Micro Integrator configs
│   ├── apis/
│   │   └── PlanTransformAPI.xml    # SOAP→REST mediation API
│   ├── sequences/
│   │   ├── xml-to-json-seq.xml     # XML to JSON transform
│   │   └── error-handler-seq.xml   # Error handling sequence
│   └── endpoints/
│       └── PlanServiceEndpoint.xml # SOAP backend endpoint
│
├── apis/                       # OpenAPI specifications
│   ├── plan-api/openapi.yaml
│   ├── network-status-api/openapi.yaml
│   └── usage-api/openapi.yaml
│
├── apim/
│   └── repository/conf/
│       └── deployment.toml     # WSO2 APIM H2 config (DO NOT change DB section)
│
├── scripts/
│   ├── mysql-init.sql          # Creates empty apim_db with latin1 charset
│   └── setup.sh                # First-time setup helper
│
├── docker-compose.yml          # MySQL + 3 Node.js services
├── .env.example                # Environment variable template
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| Windows 10/11 | — | WSL2 required |
| WSL2 (Ubuntu) | 22.04 | For running WSO2 |
| Docker Desktop | 24.x | For backend services |
| Java | 11 | Required by WSO2 (in WSL) |
| WSO2 APIM | 4.6.0 | Install at `C:\WSO2\wso2am-4.6.0` |
| WSO2 MI | 4.3.0 | Install at `C:\WSO2\wso2mi-4.3.0` |

---

### Step 1 — Initialize H2 Databases (One-Time Only)

```bash
# Run in WSL
H2JAR=/mnt/c/WSO2/wso2am-4.6.0/repository/components/plugins/h2-engine_2.3.232.wso2v1.jar
DBPATH=/mnt/c/WSO2/wso2am-4.6.0/repository/database
SCRIPTS=/mnt/c/WSO2/wso2am-4.6.0/dbscripts

java -cp $H2JAR org.h2.tools.RunScript -url "jdbc:h2:$DBPATH/WSO2SHARED_DB" \
  -user wso2carbon -password wso2carbon -script $SCRIPTS/h2.sql

java -cp $H2JAR org.h2.tools.RunScript -url "jdbc:h2:$DBPATH/WSO2AM_DB" \
  -user wso2carbon -password wso2carbon -script $SCRIPTS/apimgt/h2.sql

java -cp $H2JAR org.h2.tools.RunScript -url "jdbc:h2:$DBPATH/WSO2CARBON_DB" \
  -user wso2carbon -password wso2carbon -script $SCRIPTS/h2.sql
```

---

### Step 2 — Daily Startup

**PowerShell (run first):**
```powershell
cd C:\telecom-api-marketplace
docker-compose up -d
docker-compose ps
```

**WSL (run second):**
```bash
cd /mnt/c/WSO2/wso2am-4.6.0/bin
./api-manager.sh start
tail -f /mnt/c/WSO2/wso2am-4.6.0/repository/logs/wso2carbon.log
# Wait for: WSO2 API Manager started
```

---

### Step 3 — Verify Services

```bash
# Check Node.js services (WSL or PowerShell)
curl http://localhost:9091/health   # plan-service
curl http://localhost:9092/health   # network-service
curl http://localhost:9093/health   # usage-service
```

---

## 🌐 Portal URLs

| Portal | URL | Credentials |
|--------|-----|-------------|
| Admin Portal | https://localhost:9443/admin | admin / admin |
| Publisher Portal | https://localhost:9443/publisher | admin / admin |
| Developer Portal | https://localhost:9443/devportal | admin / admin |
| Carbon Console | https://localhost:9443/carbon | admin / admin |
| Gateway (HTTP) | http://localhost:8280 | — |
| Gateway (HTTPS) | https://localhost:8243 | — |

> **SSL Note:** Accept the self-signed certificate warning in Chrome → Advanced → Proceed to localhost.

---

## 📡 API Endpoints

### Plan API (`/plan/1.0.0`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | Get all telecom plans |
| GET | `/plans/{planId}` | Get plan by ID |
| GET | `/plans/type/{type}` | Filter plans by type (prepaid/postpaid) |
| GET | `/plans/wholesale` | Get wholesale plans for MVNO |

### Network Status API (`/network/1.0.0`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/network/status` | Get status for all regions |
| GET | `/network/status/{regionId}` | Get status for specific region |
| GET | `/network/incidents` | Get active network incidents |

### Usage API (`/usage/1.0.0`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/usage/{subscriberId}` | Get usage for a subscriber |
| GET | `/usage/export` | Export usage data for billing |

---

## 🔐 Authentication

All gateway APIs require a Bearer token:

```bash
# Get token
curl -X POST https://localhost:9443/oauth2/token \
  -d "grant_type=client_credentials&client_id=YOUR_KEY&client_secret=YOUR_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --insecure

# Call API with token
curl http://localhost:8280/plan/1.0.0/plans \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 API Request Flow

```
Client Request
     │
     ▼
WSO2 Gateway (:8280/:8243)
     │
     ├── Validate Bearer Token (JWT)
     ├── Check Subscription (is app subscribed to this API?)
     ├── Apply Rate Limit (Bronze/Silver/Gold/Unlimited)
     │
     ▼
Backend Service (Node.js)
     │  http://localhost:9091/v1/plans
     ▼
JSON Response
     │
     ▼
Client receives data
```

---

## 📊 Throttling Tiers

| Policy | Request Limit | Target |
|--------|--------------|--------|
| Bronze | 1,000 / min | Basic MVNO partners |
| Silver | 2,000 / min | Standard MVNO partners |
| Gold | 5,000 / min | Premium MVNO partners |
| Unlimited | No limit | Internal testing |

---

## 🔧 Troubleshooting

### H2 Database Tables Missing
```bash
# Re-initialize H2 databases (WSL)
rm -f /mnt/c/WSO2/wso2am-4.6.0/repository/database/*.mv.db
# Then run H2 init scripts from Step 1 above
```

### Node.js Services Won't Build (Corporate Network)
The `.npmrc` in each backend service uses a mirror registry:
```
registry=https://registry.npmmirror.com/
strict-ssl=false
```
This bypasses SSL certificate issues in corporate/restricted networks.

### APIM Won't Start
```bash
# Check logs
tail -50 /mnt/c/WSO2/wso2am-4.6.0/repository/logs/wso2carbon.log

# Check port 9443
ss -tlnp | grep 9443
```

---

## 🗺️ What's Next (Future Enhancements)

- [ ] Connect Node.js services to MySQL for persistent data
- [ ] Fix WSO2 MI SOAP→REST transformation (GraalVM JS compatibility)
- [ ] Add API versioning (v2 with breaking changes)
- [ ] Implement refresh token flow
- [ ] Add Prometheus + Grafana monitoring
- [ ] Create multiple MVNO partner apps with different tiers
- [ ] Add OpenAPI documentation to each API in Publisher Portal
- [ ] Implement CI/CD with Jenkins + apictl

---

## 👨‍💻 Author

**Jeevan** — Telecom API Marketplace on WSO2 APIM 4.6  
Built on Windows 11 + WSL2 (Ubuntu) + Docker Desktop

---

## 📄 License

MIT License — feel free to use this as a learning reference for WSO2 API Manager implementations.
