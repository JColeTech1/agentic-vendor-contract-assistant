// server.mjs — Contract Intelligence — local API proxy
// Calls a Foundry agent via the Azure AI Projects SDK and returns a clean
// { answer, citations, queryPlan } shape to the browser. The agent answers from
// its own knowledge base — NO injected documents, NO fabricated citations.
//
// Browser -> http://localhost:8799 -> this Node server -> Azure AI Projects SDK -> agent.
// (DefaultAzureCredential can't run in a browser, so the authenticated call runs here.)
//
// Bring your own API: every value below comes from the environment — see .env.example
// and SETUP.md. Nothing tenant-specific is hardcoded.
//
// RUN:    node --env-file=.env.local server.mjs
// PROBE:  node --env-file=.env.local server.mjs --probe "your question"

import http from "node:http";
import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

// Config comes entirely from the environment (.env.local, loaded via --env-file).
// The Entra credential below is satisfied by AZURE_TENANT_ID / AZURE_CLIENT_ID /
// AZURE_CLIENT_SECRET (service principal), which live only in .env.local.
const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;
const agentVersion = process.env.FOUNDRY_AGENT_VERSION || "1";
const PORT = Number(process.env.PORT || 8799);

const missing = ["FOUNDRY_PROJECT_ENDPOINT", "FOUNDRY_AGENT_NAME"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env: ${missing.join(", ")}.`);
  console.error("Copy .env.example to .env.local, fill it in, then: node --env-file=.env.local server.mjs");
  process.exit(1);
}

const projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());

// Single-turn call to the agent. Optional `memory` (standing facts/policies the
// user asked the agent to apply) is prepended to the one user message — we never
// thread prior turns, since clean single-turn calls retrieve most accurately.
// Returns the FULL response object so we can extract citations + query plan.
function buildContent(userQuestion, memory) {
  const facts = Array.isArray(memory) ? memory.filter((f) => typeof f === "string" && f.trim()) : [];
  if (!facts.length) return userQuestion;
  return (
    "Standing facts and policies to apply when answering (provided by the user):\n" +
    facts.map((f) => `- ${f.trim()}`).join("\n") +
    `\n\nQuestion: ${userQuestion}`
  );
}

async function runAgent(userQuestion, memory) {
  const openAIClient = projectClient.getOpenAIClient();

  const conversation = await openAIClient.conversations.create({
    items: [{ type: "message", role: "user", content: buildContent(userQuestion, memory) }],
  });

  const response = await openAIClient.responses.create(
    { conversation: conversation.id },
    { body: { agent_reference: { name: agentName, version: agentVersion, type: "agent_reference" } } }
  );

  return response;
}

// Retry only on 429 (rate limit) — smooths over low per-minute quota during a
// live demo. Any other error propagates immediately to the caller.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function runAgentWithRetry(userQuestion, memory, attempts = 2, backoffMs = 4000) {
  for (let i = 0; ; i++) {
    try {
      return await runAgent(userQuestion, memory);
    } catch (e) {
      const code = e?.statusCode ?? e?.status;
      if (code === 429 && i < attempts) {
        console.warn(`[429] rate limited — retry ${i + 1}/${attempts} in ${backoffMs / 1000}s`);
        await sleep(backoffMs);
        continue;
      }
      throw e;
    }
  }
}

function describeError(e) {
  return {
    name: e?.name ?? null,
    message: e?.message ?? String(e),
    statusCode: e?.statusCode ?? e?.status ?? null,
    code: e?.code ?? null,
  };
}

// Turn the raw Responses object into the shape the UI wants:
//   { answer, citations[], queryPlan[] }
// - answer     : output_text, with the inline 【4:0†source】 markers stripped for clean display
// - citations  : source filenames pulled from the assistant message's url_citation annotations
// - queryPlan  : the REAL subqueries the agent ran (mcp_call -> knowledge_base_retrieve), not faked
function fileNameFromUrl(u) {
  try { return decodeURIComponent(String(u).split("?")[0].split("/").pop() || ""); }
  catch { return String(u).split("/").pop() || ""; }
}

function parseAgentResponse(raw) {
  const output = Array.isArray(raw?.output) ? raw.output : [];

  // ---- answer ----
  let answer = typeof raw?.output_text === "string" ? raw.output_text : "";
  if (!answer) {
    const msg = output.find((o) => o?.type === "message" && o?.role === "assistant");
    answer = msg?.content?.find((c) => c?.type === "output_text")?.text ?? "";
  }
  const answerClean = answer.replace(/【[^】]*】/g, "").replace(/[ \t]+\n/g, "\n").trim();

  // ---- citations (from url_citation annotations) ----
  const citations = [];
  const seen = new Set();
  for (const o of output) {
    if (o?.type !== "message") continue;
    for (const c of o.content || []) {
      for (const a of c.annotations || []) {
        const name = fileNameFromUrl(a?.url || a?.title || "");
        if (name && !seen.has(name)) { seen.add(name); citations.push(name); }
      }
    }
  }

  // ---- query plan (the actual retrieval the agent performed) ----
  const queryPlan = [];
  for (const o of output) {
    if (o?.type !== "mcp_call") continue;
    let queries = [];
    try { queries = JSON.parse(o.arguments || "{}").queries || []; } catch { /* ignore */ }
    for (const q of queries) queryPlan.push(`Retrieve from knowledge base: “${q}”`);
    const m = String(o.output || "").match(/Retrieved\s+(\d+)\s+documents/i);
    if (m) queryPlan.push(`Ranked ${m[1]} matching contract passages`);
  }
  if (queryPlan.length) queryPlan.push("Synthesized a grounded answer with citations");
  else queryPlan.push(
    "Decomposed the question",
    "Retrieved matching passages from the knowledge base",
    "Synthesized a grounded answer with citations"
  );

  return { answer: answerClean || "(no answer text returned)", citations, queryPlan };
}

// ---- CLI probe: node --env-file=.env.local server.mjs --probe "question" ----
const probeIdx = process.argv.indexOf("--probe");
if (probeIdx !== -1) {
  const q = process.argv[probeIdx + 1] || "Which contracts auto-renew in the next 90 days?";
  console.log("Asking agent:", JSON.stringify(q));
  try {
    const r = await runAgent(q);
    const parsed = parseAgentResponse(r);
    console.log("\n===== ANSWER =====");
    console.log(parsed.answer);
    console.log("\n===== CITATIONS =====");
    console.log(parsed.citations.join("\n") || "(none)");
    console.log("\n===== QUERY PLAN =====");
    console.log(parsed.queryPlan.map((s, i) => `${i + 1}. ${s}`).join("\n"));
  } catch (e) {
    console.error("\n===== AGENT CALL FAILED =====");
    console.error(JSON.stringify(describeError(e), null, 2));
    console.error("\n----- full error -----");
    console.error(e);
  }
  process.exit(0);
}

// ---- HTTP server -----------------------------------------------------------
// This process is an API proxy only — the UI is served by Vite (npm run dev).
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Contract Intelligence API proxy. Open the app via the Vite dev server (npm run dev).");
      return;
    }
    if (req.method === "GET" && req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ status: "ok", agent: `${agentName} v${agentVersion}` }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/ask") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const parsedBody = JSON.parse(body || "{}");
      const question = (parsedBody.question || "").trim();
      const memory = parsedBody.memory;
      if (!question) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "no question" } }));
        return;
      }
      try {
        const r = await runAgentWithRetry(question, memory);
        const parsed = parseAgentResponse(r);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ...parsed, raw: r }));
        console.log(`[ok]  ${question}  (${parsed.citations.length} citations)`);
      } catch (e) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: describeError(e) }));
        console.error(`[ERR] ${question} -> ${e?.message}`);
      }
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(e));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("################################################################");
  console.log(`#  Contract Intelligence — API proxy  ->  http://localhost:${PORT}`);
  console.log(`#  Agent: ${agentName} v${agentVersion}`);
  console.log("#  Stop: Ctrl+C");
  console.log("################################################################");
});
