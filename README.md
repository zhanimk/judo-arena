🥋 Judo Arena

Judo Arena is a backend platform for managing judo tournaments, clubs, athletes, and competition brackets.

The system allows organizers to run tournaments, coaches to register clubs and athletes, and athletes to participate in competitions. It also supports bracket generation, tournament applications, notifications, and real-time updates.
⸻

🚀 Features

Authentication
 • JWT authentication
 • Role-based access control

Roles supported:
 • ADMIN
 • COACH
 • ATHLETE
⸻

Clubs
 • Coaches can create clubs
 • Athletes can request to join clubs
 • Coaches can approve or reject join requests
 • Clubs manage athletes participating in tournaments
⸻

Tournaments

Admins can:
 • Create tournaments
 • Manage tournament status
 • Control registration periods

Tournament statuses:
 • DRAFT
 • REGISTRATION_OPEN
 • REGISTRATION_CLOSED
 • IN_PROGRESS
 • COMPLETED

⸻

Applications

Clubs submit applications to participate in tournaments.

Application workflow:

DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED

Features:
 • Application creation
 • Athlete validation
 • Admin review
 • Notifications

⸻

Bracket Generation

Automatic generation of competition brackets.

Features:
 • Category grouping
 • Match creation
 • Winner progression
 • Bracket match structure

⸻

Real-time Notifications

Implemented using Socket.io.

Examples:
 • Application approved
 • Tournament updates
 • Live notifications

Rooms used:

user:{userId}
tournament:{tournamentId}
tatami:{tatamiNumber}

⸻

Audit Logging

Tracks important system actions.

Examples:
 • application approval
 • application rejection
 • administrative actions
 • tournament changes

Stored fields include:
 • actorId
 • actorRole
 • action
 • entityType
 • entityId
 • before
 • after
 • reason
 • meta

⸻

🏗 Architecture

The project follows a Service Layer Architecture.

Flow:

Routes → Controllers → Services → Models → Database

This structure separates business logic from controllers and improves maintainability.

⸻

📂 Project Structure

server
│
├─ src
│   ├─ config
│   ├─ controllers
│   ├─ middlewares
│   ├─ models
│   ├─ routes
│   ├─ services
│   ├─ sockets
│   ├─ utils
│   ├─ app.js
│   └─ server.js
│
├─ tests
│
└─ package.json

⸻

⚙️ Tech Stack

Backend
 • Node.js
 • Express.js
 • MongoDB
 • Mongoose
 • JWT
 • Socket.io

Security & Middleware
 • Helmet
 • CORS
 • Morgan
 • Joi validation

Testing
 • Jest
 • Supertest

⸻

🔑 Environment Variables

Create a .env file inside the server folder.

Example:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
UPLOAD_DIR=uploads

⸻

▶️ Running the Server

Install dependencies:

npm install

Run development server:

npm run dev

Run production server:

npm start

⸻

🧪 Running Tests

Run all tests:

npm test

Run a specific test:

npm test – tests/application.test.js

Tests cover:
 • authentication
 • clubs
 • tournaments
 • applications
 • bracket generation

⸻

📡 API Base URL

http://localhost:5000/api

Health check endpoint:

GET /api/health

⸻

👩‍💻 Author

Zhanim K.
GitHub: https://github.com/zhanimk