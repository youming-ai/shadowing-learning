import Groq from "groq-sdk";

let _groqClient: Groq | null = null;

function getOrCreateClient(): Groq {
  if (!_groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured. Set the GROQ_API_KEY environment variable.");
    }
    _groqClient = new Groq({ apiKey });
  }
  return _groqClient;
}

/**
 * Lazy-initialized Groq client.
 *
 * The underlying `new Groq()` call is deferred until the first runtime access,
 * so the module can safely be imported during `next build` without requiring
 * GROQ_API_KEY to be present in the build environment.
 */
export const groqClient = new Proxy({} as Groq, {
  get(_target, prop, receiver) {
    const client = getOrCreateClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
