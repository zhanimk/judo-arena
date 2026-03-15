# API Documentation

Base URL:

http://localhost:5000/api

---

## Authentication

### POST /auth/register
Register a new user.

Roles:
- ATHLETE
- COACH

Example body:

```json
{
  "fullName": "Test Athlete",
  "email": "athlete@example.com",
  "password": "123456",
  "role": "ATHLETE"
}