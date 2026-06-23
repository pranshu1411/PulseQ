<p align="center">
  <img src="https://img.shields.io/badge/PulseQ-Distributed_Job_Queue-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwb2x5bGluZSBwb2ludHM9IjIyIDEyIDE4IDEyIDE1IDE5IDkgNSA2IDEyIDIgMTIiLz48L3N2Zz4=" alt="PulseQ" />
</p>

<h1 align="center">PulseQ</h1>

<p align="center">
  A production-grade distributed asynchronous job queue and worker orchestration system with real-time monitoring.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/BullMQ-FF6B35?style=flat-square" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Prometheus-E6522C?style=flat-square&logo=prometheus&logoColor=white" alt="Prometheus" />
  <img src="https://img.shields.io/badge/Grafana-F46800?style=flat-square&logo=grafana&logoColor=white" alt="Grafana" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

---

## Overview

PulseQ is a scalable distributed job queue system supporting asynchronous task execution, automatic retries with exponential backoff, delayed scheduling, worker orchestration, and real-time monitoring. It replaces synchronous processing bottlenecks with a fault-tolerant, horizontally scalable architecture.

## Architecture

```mermaid
flowchart TD
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff
    classDef worker fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff
    classDef storage fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff
    classDef queue fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff
    classDef metrics fill:#ec4899,stroke:#be185d,stroke-width:2px,color:#fff
    classDef proxy fill:#475569,stroke:#334155,stroke-width:2px,color:#fff
    
    UI["React UI (Vite + TS + Framer Motion)"]:::frontend
    Nginx["Nginx Reverse Proxy"]:::proxy
    Gateway["API Gateway (NestJS)"]:::backend
    SocketIO["WebSocket Server (Socket.IO)"]:::backend
    
    Queue["Redis / BullMQ"]:::queue
    Worker["Worker Nodes (NestJS)"]:::worker
    
    DB["PostgreSQL (Prisma ORM)"]:::storage
    MinIO["MinIO (S3 Storage)"]:::storage
    
    Prometheus["Prometheus"]:::metrics
    Grafana["Grafana"]:::metrics
    
    UI -- "HTTP/WS Requests" --> Nginx
    Nginx -- "REST Requests" --> Gateway
    Nginx <== "Live Job Updates" ==> SocketIO
    Nginx -- "File Requests" --> MinIO
    
    Gateway -- "Produces Jobs" --> Queue
    Queue -- "Consumes Jobs" --> Worker
    
    Worker -- "Writes Final State" --> DB
    Gateway -- "Reads/Writes State" --> DB
    
    Worker -- "Reads/Writes Files" --> MinIO
    Gateway -- "Uploads Files" --> MinIO
    
    Queue -. "BullMQ QueueEvents" .-> SocketIO
    
    Gateway -. "/metrics" .-> Prometheus
    Worker -. "/metrics" .-> Prometheus
    Prometheus -. "Data Source" .-> Grafana
```

## Features

### Core Job Queue
- **Asynchronous task execution** — submit jobs and let workers handle them in the background
- **Priority-based queues** — control job ordering with configurable priorities
- **Delayed & scheduled jobs** — execute tasks at a specific time or after a delay
- **Retry handling** — automatic retries with exponential backoff on failure
- **Dead-letter queue (DLQ)** — permanently failed jobs are captured, inspectable, retryable, and purgeable
- **Job deduplication** — prevent duplicate job submissions
- **Concurrent processing** — workers process multiple jobs in parallel

### Job Types
- **Image Processing** — upload images for resizing, format conversion, and watermarking via Sharp, stored in MinIO (S3-compatible)
- **CSV Processing** — upload CSV files for bulk parsing and database ingestion

### Worker Orchestration
- **Distributed workers** — horizontally scalable worker nodes
- **Heartbeat monitoring** — live worker health tracking with active/offline status
- **Graceful shutdown** — workers finish in-progress jobs before exiting
- **Load balancing** — BullMQ distributes work evenly across available workers

### Real-Time Monitoring
- **WebSocket live feed** — job events stream to the dashboard in real time via Socket.IO
- **Queue stats** — active, completed, failed, and waiting job counts
- **Throughput analytics** — completion/failure rate charts over time
- **Worker node health** — per-worker heartbeat status with last-ping timestamps
- **Job history** — searchable, filterable log of all processed jobs with timeline details
- **Retry & failure analytics** — retry rate, average wait time, processing time metrics

### Observability
- **Prometheus metrics** — custom counters and histograms exposed at `/metrics`
- **Grafana dashboards** — pre-provisioned visualization dashboards

### Authentication
- **Google OAuth 2.0** — sign in with Google, session managed via JWT cookies
- **Protected routes** — dashboard is behind authentication, landing page is public

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Recharts, Socket.IO Client |
| **Reverse Proxy** | Nginx |
| **Backend API** | NestJS, Prisma ORM, Passport (Google OAuth), BullMQ |
| **Worker Service** | NestJS, Sharp (image processing), csv-parser |
| **Queue Broker** | Redis 7 + BullMQ |
| **Database** | PostgreSQL 15 |
| **Object Storage** | MinIO (S3-compatible) |
| **Monitoring** | Prometheus, Grafana |
| **Infrastructure** | Docker, Docker Compose |
| **Real-Time** | WebSockets (Socket.IO) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Docker](https://www.docker.com/) & Docker Compose
- A [Google OAuth](https://console.cloud.google.com/) client ID & secret

### 1. Clone the repository

```bash
git clone https://github.com/pranshu1411/PulseQ
cd PulseQ
```

### 2. Start infrastructure services

```bash
docker-compose up -d
```

This spins up **PostgreSQL**, **Redis**, **MinIO**, **Prometheus**, and **Grafana**.

| Service | URL |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO Console | [localhost:9001](http://localhost:9001) |
| Prometheus | [localhost:9090](http://localhost:9090) |
| Grafana | [localhost:3000](http://localhost:3000) (admin/admin) |

### 3. Configure environment

Create `backend/.env`:

```env
PG_DATABASE_URL="postgresql://user:password@localhost:5432/job_queue?schema=public"
JWT_SECRET="your_jwt_secret"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

### 4. Install dependencies & set up database

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push

# Frontend
cd ../frontend
npm install
```

### 5. Run the application

Open three terminals:

```bash
# Terminal 1 — Backend API (port 4000)
cd backend
npm run start:dev backend

# Terminal 2 — Worker Service
cd backend
npm run start:dev worker

# Terminal 3 — Frontend (port 5173)
cd frontend
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) to see the landing page. Sign in with Google to access the dashboard.



## Project Structure

```
PulseQ/
├── backend/
│   ├── apps/
│   │   ├── backend/          # API gateway (NestJS)
│   │   │   └── src/
│   │   │       ├── auth/     # Google OAuth, JWT, guards
│   │   │       ├── jobs/     # Job CRUD, queue submission, stats
│   │   │       ├── dlq/      # Dead-letter queue management
│   │   │       ├── health/   # Worker heartbeat tracking
│   │   │       └── metrics/  # Prometheus metrics endpoint
│   │   └── worker/           # Worker service (NestJS)
│   │       └── src/
│   │           ├── worker.service.ts    # BullMQ worker registration
│   │           └── image.processor.ts   # Sharp image processing
│   ├── libs/
│   │   └── shared/           # Shared DTOs, types, Prisma client
│   └── prisma/
│       └── schema.prisma     # Database schema
├── frontend/
│   └── src/
│       ├── pages/            # Dashboard, Analytics, DLQ, Job History, etc.
│       ├── layouts/          # DashboardLayout (sidebar, WebSocket, stats)
│       ├── components/       # Modals, shared UI components
│       └── context/          # AuthContext (Google OAuth state)
├── prometheus/               # Prometheus scrape config
├── grafana/                  # Grafana provisioning & dashboards
└── docker-compose.yml        # Infrastructure services
```

## Screenshots

<div align="center">
  <img src="frontend/public/slide1.png" width="48%" alt="Screenshot 1" />
  <img src="frontend/public/slide2.png" width="48%" alt="Screenshot 2" />
  <br/>
  <img src="frontend/public/slide3.png" width="48%" alt="Screenshot 3" />
  <img src="frontend/public/slide4.png" width="48%" alt="Screenshot 4" />
</div>

## License

This project is licensed under the [MIT License](LICENSE).
