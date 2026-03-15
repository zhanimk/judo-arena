## Я советую
В README.md вставить короткую версию, а в docs/ARCHITECTURE.md — полную.

## Готовый текст для docs/ARCHITECTURE.md

```markdown
# Architecture

Judo Arena backend follows a layered architecture:

- Routes receive HTTP requests
- Controllers handle request/response flow
- Services contain business logic
- Models work with MongoDB through Mongoose
- Socket.io provides real-time notifications and live updates
- Audit Log Service stores important system actions

## Diagram

```mermaid
flowchart TD
    A[Client / Frontend] --> B[Express API]
    B --> C[Controllers]
    C --> D[Services]
    D --> E[MongoDB Models]
    E --> F[(MongoDB Atlas)]

    B --> G[Auth Middleware]
    B --> H[Validation Middleware]
    B --> I[Role Middleware]

    D --> J[Socket.io]
    J --> K[Real-time Notifications / Live Updates]

    D --> L[Audit Log Service]
    L --> M[(AuditLog Collection)]

    D --> N[Notification Service]
    N --> O[(Notification Collection)]

    D --> P[Bracket Generator]
    P --> Q[(Bracket Collection)]
    P --> R[(Match Collection)]