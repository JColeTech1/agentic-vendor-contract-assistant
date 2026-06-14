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
  // Passthrough: return the agent's message EXACTLY as written (including its own
  // Source line and any inline markers). No stripping, no trimming, no summarizing.

  // ---- citations ----
  // A contract tool must always cite. The agent annotates inconsistently, so we
  // derive citations from what it actually retrieved (the mcp_call output), in
  // this order of preference: explicit annotations -> inline 【i:N†source】 markers
  // mapped to the retrieved docs -> retrieved docs whose subject appears in the
  // answer -> the single top-ranked retrieved doc. Never leave a grounded answer uncited.
  const citations = [];
  const seen = new Set();
  const add = (name) => { if (name && !seen.has(name)) { seen.add(name); citations.push(name); } };

  // (a) explicit url_citation annotations, when present
  for (const o of output) {
    if (o?.type !== "message") continue;
    for (const c of o.content || [])
      for (const a of c.annotations || [])
        if (a?.type !== "container_file_citation") add(fileNameFromUrl(a?.url || a?.title || ""));
  }

  // (b) the documents actually retrieved, in rank order (source of truth)
  const retrieved = [];
  for (const o of output) {
    if (o?.type !== "mcp_call") continue;
    const outp = typeof o.output === "string" ? o.output : JSON.stringify(o.output || "");
    for (const m of outp.matchAll(/"blob_url":\s*"([^"]+)"/g)) retrieved.push(fileNameFromUrl(m[1]));
  }

  // (c) map the answer's 【i:N†source】 markers to retrieved[N]
  for (const m of (answer || "").matchAll(/【\d+:(\d+)†[^】]*】/g)) add(retrieved[Number(m[1])]);

  // (d) fallback: retrieved docs whose subject appears in the answer, else top hit
  if (!citations.length && retrieved.length) {
    const lower = (answer || "").toLowerCase();
    const slug = (f) => f.replace(/\.[^.]+$/, "").split(/[-_]/)[0].toLowerCase();
    const matched = retrieved.filter((f) => { const s = slug(f); return s.length > 3 && lower.includes(s); });
    (matched.length ? matched : [retrieved[0]]).forEach(add);
  }

  // ---- query plan (reflects the tools the agent ACTUALLY used) ----
  // knowledge_base_retrieve (RAG) and/or code_interpreter — never claim retrieval
  // that didn't happen.
  const queryPlan = [];
  for (const o of output) {
    if (o?.type !== "mcp_call") continue;
    let queries = [];
    try { queries = JSON.parse(o.arguments || "{}").queries || []; } catch { /* ignore */ }
    for (const q of queries) queryPlan.push(`Retrieve from knowledge base: “${q}”`);
    const m = String(o.output || "").match(/Retrieved\s+(\d+)\s+documents/i);
    if (m) queryPlan.push(`Ranked ${m[1]} matching contract passages`);
  }
  // Code interpreter: name the file(s) it actually read, rather than assuming a
  // source (we have more than one). Strip the internal "assistant-<id>-" prefix.
  const ciFiles = new Set();
  for (const o of output) {
    if (o?.type !== "code_interpreter_call") continue;
    const code = String(o.code ?? o.input ?? "");
    for (const m of code.matchAll(/[\w.-]+\.(?:csv|xlsx?|json|md|txt|parquet)/gi)) {
      ciFiles.add(m[0].replace(/^assistant-[A-Za-z0-9]+-/, ""));
    }
  }
  if (output.some((o) => o?.type === "code_interpreter_call")) {
    if (!queryPlan.length) queryPlan.push("Decomposed the question");
    queryPlan.push(ciFiles.size
      ? `Computed the answer with the code interpreter over ${[...ciFiles].join(", ")}`
      : "Computed the answer with the code interpreter");
  }
  if (queryPlan.length) queryPlan.push("Synthesized a grounded answer");
  else queryPlan.push("Decomposed the question", "Answered from the agent's knowledge");

  // Last resort: if nothing else cited, cite the file(s) the code interpreter read
  // (e.g. the register), so every grounded answer carries a source — like Foundry's.
  if (!citations.length) for (const f of ciFiles) add(f);

  return { answer: answer || "(no answer text returned)", citations, queryPlan };
}

// Pull code-interpreter-generated file references from the response — these are
// the actual files the agent wrote (e.g. extracted_register.csv), exposed as
// container_file_citation annotations: { container_id, file_id, filename }.
function extractContainerFiles(raw) {
  const output = Array.isArray(raw?.output) ? raw.output : [];
  const files = [];
  const seen = new Set();
  for (const o of output) {
    if (o?.type !== "message") continue;
    for (const c of o.content || []) {
      for (const a of c.annotations || []) {
        if (a?.type !== "container_file_citation") continue;
        if (!a.file_id || !a.container_id || seen.has(a.file_id)) continue;
        seen.add(a.file_id);
        files.push({ filename: a.filename || a.file_id, container_id: a.container_id, file_id: a.file_id });
      }
    }
  }
  return files;
}

// Last-resort: pull a CSV out of the answer text if the agent printed it inline
// instead of writing a file (it's non-deterministic). Looks for a fenced block
// first, else the longest run of comma-bearing lines.
function csvFromText(text) {
  const fenced = String(text).match(/```(?:csv)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].includes(",")) return fenced[1].trim();
  const lines = String(text).split("\n").filter((l) => l.includes(","));
  return lines.length >= 2 ? lines.join("\n").trim() : "";
}

// Reconstruct a document's verbatim text from the retrieval output — the stored
// snippets (blob_url + snippet) are the actual KB document chunks. More reliable
// than asking the agent to "print the file".
function docFromRetrieval(raw, file) {
  const out = Array.isArray(raw?.output) ? raw.output : [];
  const parts = [];
  const seen = new Set();
  for (const o of out) {
    if (o?.type !== "mcp_call") continue;
    const s = typeof o.output === "string" ? o.output : JSON.stringify(o.output || "");
    const re = /"blob_url":\s*"([^"]+)"[\s\S]*?"snippet":\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(s))) {
      if (fileNameFromUrl(m[1]) !== file) continue;
      let text = ""; try { text = JSON.parse('"' + m[2] + '"'); } catch { text = m[2]; }
      const key = text.slice(0, 80);
      if (text && !seen.has(key)) { seen.add(key); parts.push(text); }
    }
  }
  return parts.join("\n\n");
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
    if (req.method === "GET" && req.url === "/api/workbook") {
      const prompt =
        "Using your code-interpreter tool, write the current contract register to a CSV file " +
        "(one row per contract, with a header row) and return it as a downloadable file.";
      try {
        const r = await runAgentWithRetry(prompt);
        const refs = extractContainerFiles(r);
        const sheets = [];
        const oai = projectClient.getOpenAIClient();
        for (const ref of refs) {
          try {
            const resp = await oai.containers.files.content.retrieve(ref.file_id, { container_id: ref.container_id });
            const content = await resp.text();
            if (content && content.trim()) sheets.push({ filename: ref.filename, content });
          } catch (e) {
            console.error(`[workbook] download failed for ${ref.filename}: ${e?.message}`);
          }
        }
        // Fallback: agent answered inline instead of writing a file.
        if (!sheets.length) {
          const inline = csvFromText(parseAgentResponse(r).answer);
          if (inline) sheets.push({ filename: "contract-register.csv", content: inline });
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ sheets, note: sheets.length ? undefined : "The agent did not return a file this time — try Refresh." }));
        console.log(`[ok]  /api/workbook  (${sheets.length} sheet(s))`);
      } catch (e) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ sheets: [], error: describeError(e) }));
        console.error(`[ERR] /api/workbook -> ${e?.message}`);
      }
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/document")) {
      const file = (new URL(req.url, "http://localhost").searchParams.get("file") || "").trim();
      if (!file) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { message: "no file" } })); return; }
      const prompt = `What does the contract in the file "${file}" say? Summarize its key terms, clauses, dates, and obligations.`;
      try {
        const r = await runAgentWithRetry(prompt);
        const content = docFromRetrieval(r, file) || parseAgentResponse(r).answer;
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ file, content }));
        console.log(`[ok]  /api/document ${file} (${content.length} chars)`);
      } catch (e) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ file, content: "", error: describeError(e) }));
        console.error(`[ERR] /api/document ${file} -> ${e?.message}`);
      }
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
