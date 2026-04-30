# Dokploy Deployment

This project is ready to deploy on an Oracle VPS through Dokploy using the included `Dockerfile`.

## Runtime

- App port: `3000`
- Start command inside container: `node server.js`
- Next.js output mode: `standalone`

## Environment Variables

Configure these in Dokploy, not in the repository:

```env
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Dokploy Setup

The repository ships with both a `Dockerfile` and a `docker-compose.yml`,
so either deployment mode in Dokploy works:

### Option A — Dockerfile mode (recommended for single container)

1. Create a new application in Dokploy.
2. Select Git repository deployment.
3. Use Dockerfile build mode.
4. Set the app port to `3000`.
5. Add the required environment variables.
6. Attach your domain and enable HTTPS.
7. Deploy.

### Option B — Docker Compose mode

1. Create a new application in Dokploy and choose Compose deployment.
2. Select Git repository deployment; Dokploy reads `docker-compose.yml`
   from the repo root.
3. Add the required environment variables in Dokploy. They are
   injected into the compose build/runtime via the `${VAR}` interpolation
   used in `docker-compose.yml`.
4. Attach your domain to the `app` service on port `3000`.
5. Deploy.

The compose file uses `expose: 3000` rather than `ports: 3000:3000` so the
port is reachable inside the Docker network (where Dokploy's Traefik lives)
without binding to the host. This avoids host-port conflicts when other
containers or previous deployment attempts are using `0.0.0.0:3000`.

For a local smoke test where you want host access, run:

```bash
docker compose up --build
docker compose run --service-ports app  # if you need host:3000 mapped
```

…or use the `docker run -p 3000:3000` snippet in the next section.

## Notes

- Do not upload `.env` or `.env.local` to the server. Dokploy environment variables should be the source of truth.
- The app stores user files and transcripts in browser IndexedDB, so no database is required on the VPS.
- The current rate limiter is in-memory. This is acceptable for a single Dokploy container. If you scale to multiple replicas, move rate limiting to Redis or another shared store.
- Audio transcription and post-processing require outbound network access from the container to Groq.

## Local Docker Smoke Test

```bash
docker build -t shadowing-learning .
docker run --rm -p 3000:3000 \
  -e GROQ_API_KEY=your_groq_api_key \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  shadowing-learning
```

Then open `http://localhost:3000`.
