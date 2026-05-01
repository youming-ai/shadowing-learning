import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn("[groq-client] GROQ_API_KEY is not configured");
}

export const groqClient = new Groq({
  apiKey,
});
