---

# docs/TESTING.md

```markdown
# Testing

The project uses:

- Jest
- Supertest

Tests cover the main backend flows:
- authentication
- clubs
- tournaments
- applications
- brackets

---

## Run all tests

From the server folder:

```bash
npm test

npm test -- tests/auth.test.js
npm test -- tests/club.test.js
npm test -- tests/tournament.test.js
npm test -- tests/application.test.js
npm test -- tests/bracket.test.js


npm test --prefix server