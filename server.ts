import http from "http";
import { parse } from "url";
import next from "next";
import { startJobs } from "./lib/jobs";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  startJobs();
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "/", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[server] error", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });
  server.listen(port, hostname, () => {
    console.log(`> CoreX NexDMARC on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
  });
}).catch((err) => {
  console.error("Failed to start Next.js", err);
  process.exit(1);
});
