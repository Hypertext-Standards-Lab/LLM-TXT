import { Hono } from "hono";
import { cors } from "hono/cors";
import mcp from "./routes/mcp";

const app = new Hono();

// Configure CORS with specific options for Cloudflare Workers
app.use(
  "/*",
  cors({
    origin: [
      "https://llm-fid-txt.hey-ea8.workers.dev",
      "https://llm-fid.fun",
      "http://localhost:3000",
      "http://localhost:5173", // Vite dev server
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token"],
    exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    maxAge: 86400,
    credentials: true,
  })
);

// Add security headers for Cloudflare Workers
app.use("*", async (c, next) => {
  // Add security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Add Cloudflare-specific headers
  c.header("CF-IPCountry", c.req.header("CF-IPCountry") || "");
  c.header("CF-Connecting-IP", c.req.header("CF-Connecting-IP") || "");

  await next();
});

// Mount the MCP route
app.route("/", mcp);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

export type AppType = typeof app;
export default app;
