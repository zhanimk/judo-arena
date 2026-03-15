---

# docs/POSTMAN.md

```markdown
# API Testing Without Postman

Postman is optional for this project.

The API can already be tested using:

- Swagger UI
- curl
- automated Jest + Supertest tests

---

## Swagger UI

After starting the backend, open:

/api/docs/

Swagger provides:
- endpoint list
- request/response docs
- JWT authorization
- interactive testing in browser

---

## curl example

Login example:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "123456"
  }'

