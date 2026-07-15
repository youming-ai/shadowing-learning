import Groq from "groq-sdk"

let _client: Groq | null = null

export function getGroqClient(apiKey: string): Groq {
  if (!_client) {
    _client = new Groq({ apiKey })
  }
  return _client
}
