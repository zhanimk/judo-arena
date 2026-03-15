---

# docs/DEPLOYMENT.md

```markdown
# Deployment

This project can be run locally, through Docker, or deployed to a cloud environment.

---

## Local run

From the server directory:

```bash
npm install
npm run dev

PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
UPLOAD_DIR=uploads

docker-compose up --build