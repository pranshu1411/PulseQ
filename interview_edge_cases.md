# Distributed Systems Edge Cases & Interview Talking Points

This document contains a curated list of advanced architectural edge cases encountered while building the **PulseQ Distributed Job Queue System**. These scenarios are excellent talking points for system design interviews, demonstrating deep knowledge of distributed systems, concurrency, state management, and Node.js backend internals.

---

## 1. The Graceful Shutdown Race Condition (State Desynchronization)
**The Scenario:** A worker node is processing a job and receives a termination signal (`SIGTERM` / `Ctrl+C`). It attempts a "graceful shutdown".
**The Problem:** The Node.js application begins shutting down its modules in parallel. BullMQ gracefully waits for the active job to finish, but the Prisma ORM immediately severs its connection to PostgreSQL. When BullMQ finishes the job, it marks it as `completed` in Redis and triggers an asynchronous `completed` event. However, the event listener attempting to update PostgreSQL fails silently because the database connection is already dead. This leaves the system in a state of **Ambiguity**: Redis says `completed`, Postgres says `active`.
**The Solution:**
1. **Synchronous Execution Flow:** Moved the database update (`status = 'completed'`) directly inside the main `process()` function rather than relying on an asynchronous event listener. BullMQ enforces a strict await on `process()`, ensuring the database write is completed before the worker is allowed to exit.
2. **Lifecycle Priority Demotion:** Changed the database disconnection logic from NestJS's high-priority `OnModuleDestroy` hook down to the lowest-priority `OnApplicationShutdown` hook, keeping the DB alive during BullMQ's shutdown process.
3. **Reconciliation Cron Job:** Added a background sweeping script that detects jobs stuck in Postgres as `active` for more than 60 seconds, queries Redis for the true state, and forcefully resolves any ghost jobs.

---

## 2. Idempotency on Mid-Process Failures (Partial Data Duplication)
**The Scenario:** A worker is processing a massive 260,000-row CSV file. Halfway through (at 130,000 rows), the worker crashes or is killed. The job is placed in the Dead Letter Queue (DLQ).
**The Problem:** The first 130,000 rows have already been inserted into the database. If the user clicks **"Retry"** from the DLQ, the worker restarts the file from the beginning and re-inserts the rows, creating 130,000 duplicates.
**The Solution:**
1. **Job Tagging:** Modified the database schema to attach a `jobId` to every single inserted `Product` row.
2. **Pre-Processing Cleanup:** Ensured the worker's processing function is strictly **Idempotent**. The absolute first step the worker takes when picking up a job is to execute a `deleteMany({ where: { jobId: currentJob.id } })` query. This completely wipes out any messy, partial data left over from previous failed attempts before cleanly starting the import from scratch.

---

## 3. Worker Starvation and Stale Queue Timeouts
**The Scenario:** A user submits a high-priority job, but all worker nodes are currently down, disconnected, or completely saturated.
**The Problem:** The job sits in the `queued` state forever. The user is given no feedback, and the UI indefinitely shows a loading spinner. If workers eventually come back online hours later, they might process a job that is no longer relevant.
**The Solution:**
Implemented a **Stale Job Sweeper** cron task on the backend API gateway. It queries the database every 30 seconds for jobs that have been in the `queued` state longer than the defined timeout (`STALE_JOB_TIMEOUT_MS`). It automatically marks these jobs as `failed` with a descriptive error message and emits a WebSocket event to update the user's UI in real-time, preventing indefinite hangs.

---

## 4. Cross-Platform OS Metric Inconsistencies (Worker Load Balancing)
**The Scenario:** Workers need to report their CPU and Memory utilization to the monitoring dashboard so the system can intelligently route heavy jobs to idle workers.
**The Problem:** The standard Node.js method for checking CPU load, `os.loadavg()`, works perfectly on Linux and macOS environments but is completely unsupported on Windows (it always returns `[0, 0, 0]`).
**The Solution:**
Bypassed the high-level `loadavg` implementation and wrote a custom hardware abstraction layer. The worker reads the raw tick data directly from `os.cpus()`, caches it, and calculates the delta in `idle` versus `total` CPU ticks across an interval loop. This guarantees perfectly accurate cross-platform CPU utilization percentages regardless of the deployment OS.

---

## 5. UI State Desynchronization (Zombie Jobs in the Dashboard)
**The Scenario:** A job fails and goes to the Dead Letter Queue (DLQ). The user deletes the job from the DLQ page.
**The Problem:** When the user navigates back to the main Live Dashboard without a hard page reload, the deleted job reappears in the live event stream as "Waiting". This happens because global React state retains historical WebSocket events that conflict with the newly updated Postgres database state.
**The Solution:**
Implemented a strict **State Reconciliation Layer** in the global `DashboardLayout`.
1. Emitted specific `purged` status WebSocket events from the backend upon deletion.
2. Used React `useOutletContext` to trigger forced data refetches across sibling routes.
3. Implemented a deduplication algorithm in the frontend state array that checks `jobId` to prevent duplicate renders and actively filters out any job transitioning to a `purged` state.

---

## 6. OOM (Out of Memory) Protection on Heavy I/O
**The Scenario:** A user uploads a 5GB CSV file containing millions of products.
**The Problem:** Standard approaches like `fs.readFileSync()` attempt to load the entire 5GB file into RAM simultaneously, instantly causing a V8 Engine `heap out of memory` crash and killing the worker node.
**The Solution:**
Designed a highly efficient **Piped Streaming Architecture**. 
1. Fetched the file over a network stream and piped it directly into a `Transform` stream to count rows, then immediately into the local disk via `fs.createWriteStream`.
2. Utilized the `csv-parser` library combined with `for await...of` loops to parse the file line-by-line.
3. Buffered data in memory up to a specific `batchSize` (e.g., 1000 rows) and executed a single `createMany` SQL transaction. This keeps RAM usage completely flat (around ~40MB) regardless of whether the file is 1MB or 100GB.

---

## 7. Architecture Trade-off: Queue Partitioning vs. Native Prioritized Sorted Sets
**The Scenario:** Designing a Quality of Service (QoS) system where "Enterprise" users get High Priority processing over "Free Tier" users.
**The Problem (The Trap):** A common junior mistake is immediately assuming "High Priority" means creating a completely separate `high-priority-queue` and spinning up a second set of worker processes to listen to it. 
**The Reality:** In a Node.js monolithic worker architecture, spinning up a second queue listener in the same process means both the normal worker and the high-priority worker fight for the exact same single-threaded Event Loop and CPU resources. This provides zero actual hardware isolation. Furthermore, if you *do* deploy them on separate hardware, the high-priority servers sit idle and burn money when there are no enterprise jobs in the queue.
**The Solution:**
Utilized **Native Priority Sorted Sets (BullMQ)** instead of Queue Partitioning. 
- All jobs (High, Normal, Low priority) are pushed into the *same* Redis queue.
- Under the hood, BullMQ automatically routes prioritized jobs into a Redis `ZSET` (Sorted Set) rather than a standard `LIST`. 
- When *any* worker across the entire cluster becomes idle, it natively queries the Sorted Set for the highest-scored job before picking up normal traffic.
- **The Result:** Maximum possible resource utilization (no idle workers), mathematically guaranteed line-jumping for enterprise clients, and zero additional infrastructure/DevOps overhead. Separate queues are only utilized when absolute strict hardware isolation (dedicated EC2 instances) is mandated by compliance/SLAs.

---

## 8. Multi-Tenant Fair Share Throttling vs. API Rate Limiting
**The Scenario:** A single user uploads 10 massive CSV files. Another user uploads 1 small image. The worker cluster becomes entirely monopolized by the first user, starving the second user of compute resources.
**The Problem:** Standard API rate limiting (`@nestjs/throttler`) only prevents a user from hitting the endpoint too fast (e.g., 20 requests per minute). It does *not* prevent a user from legally submitting 10 valid, long-running jobs that completely fill up the worker concurrency slots. Enterprise queue systems like BullMQ Pro offer "Group Rate Limiting," but open-source solutions do not.
**The Solution:**
Implemented a highly efficient **Database-Backed Concurrent Tenant Limit**.
1. Before enqueuing a job into Redis, the API gateway runs a highly indexed `COUNT` query in Postgres: `SELECT COUNT(*) FROM jobs WHERE userId = X AND status IN ('queued', 'active', 'delayed')`.
2. If the user already has >= 10 concurrent jobs occupying the system, the API forcefully rejects the new job with an HTTP 429 `Too Many Requests`.
3. This creates a mathematically perfect "Fair Share" system where no single tenant can hold more than 10 global worker slots hostage, forcing them to wait their turn and keeping the system snappy for other users.

---

## 9. Precision Job Scheduling (Delayed Execution)
**The Scenario:** A user wants to submit a batch job now, but delay its actual processing until 3:00 AM during off-peak hours.
**The Problem:** Saving the job in Postgres with a `scheduledFor` date and running a cron job every minute to push them into the queue is inaccurate, delays jobs by up to 60 seconds, and requires a complex polling architecture that hits the database constantly.
**The Solution:**
Utilized BullMQ's native Redis Sorted Sets for millisecond-precision delays.
1. The API calculates the exact millisecond offset: `delay = scheduledFor - Date.now()`.
2. The job is pushed directly to Redis with the `delay` option. BullMQ stores it in a special "Delayed" `ZSET`, scored by the exact unix timestamp it should execute.
3. Redis natively monitors this sorted set without polling the database. At the exact millisecond the delay expires, BullMQ promotes it to the `waiting` list.
4. Our WebSocket `EventsGateway` natively listens to this promotion event and live-updates the UI from a purple `Delayed` state to a yellow `Queued` state in real-time.
