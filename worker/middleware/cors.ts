import { cors as honoCors } from "hono/cors"

export const cors = honoCors({
  origin: (origin) => {
    const allowed = [
      "http://localhost:3000",
      "http://localhost:8787",
    ]
    if (!origin || allowed.includes(origin)) return origin
    return allowed[0]
  },
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
})
