## Bun x Zerops

A simple Task Manager API built with Bun.js and Elysia.js. The application uses PostgreSQL for data storage, Redis for caching, and BullMQ for background job processing. Tasks can be created with different priority levels (high, medium, low) and automatically expire after 24 hours. The system includes task status tracking, logging, and automatic task processing through a worker queue. The tech stack includes:

- Runtime: Bun.js
- Framework: Elysia.js
- Database: PostgreSQL
- Cache: Redis
- Queue: BullMQ
- Features: Task prioritization, automatic expiration, status tracking, background processing

### Import Yaml
```yml
project:
  name: bun-zerops

services:
  - hostname: api
    type: bun@1.2
    enableSubdomainAccess: true
    buildFromGit: https://github.com/nermalcat69/bun-zerops
  
  - hostname: db
    type: postgresql@16
    mode: NON_HA

  - hostname: redis
    type: valkey@7.2
    mode: NON_HA
```

### How to test

Make sure to grab your public access url from your service :) because the link below is not live i think

```bash
# View API info and stats
curl https://app-d07-3000.prg1.zerops.app/
```

```bash
# Create a new task
curl -X POST https://app-d07-3000.prg1.zerops.app/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Important Task",
    "description": "Need to do this",
    "priority": "high"
  }'
```
```bash
# List all tasks
curl https://app-d07-3000.prg1.zerops.app/tasks
```
```bash
# List by priority
curl https://app-d07-3000.prg1.zerops.app/tasks/high
curl https://app-d07-3000.prg1.zerops.app/tasks/medium
curl https://app-d07-3000.prg1.zerops.app/tasks/low
```
```bash
# List pending tasks
curl https://app-d07-3000.prg1.zerops.app/tasks/pending
```
```bash
# View task details (replace 1 with task ID)
curl https://app-d07-3000.prg1.zerops.app/tasks/1
```
```bash
# Complete task (replace 1 with task ID)
curl https://app-d07-3000.prg1.zerops.app/tasks/complete/1
```
