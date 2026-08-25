import { Hono } from "hono"
import { cors } from "./middleware/cors"
import { rateLimit } from "./middleware/rate-limit"
import { transcribeRoute } from "./routes/transcribe"
import { postprocessRoute } from "./routes/postprocess"
import { youtubeRoute } from "./routes/youtube"

interface Env {
  RATE_LIMIT_KV?: KVNamespace
  GROQ_API_KEY: string
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Env }>()

app.use("*", cors)
app.use("/api/*", rateLimit)

app.route("/api/transcribe", transcribeRoute)
app.route("/api/postprocess", postprocessRoute)
app.route("/api/youtube", youtubeRoute)

app.get("/api/health", (c) => c.json({ status: "ok" }))

app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>
