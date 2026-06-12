// server.mjs — Contoso Contract Intelligence
// Calls Sally's real Foundry agent (vendor-contract-assistant v3) via the Azure
// AI Projects SDK. The agent answers from its own knowledge base (kb-contracts).
// NO injected contracts, NO fabricated citations — we show exactly what it returns.
//
// Browser -> http://localhost:8787 -> this Node server -> Azure AI Projects SDK -> agent.
// (DefaultAzureCredential does not work in a browser, so the SDK call runs here, server-side.)
//
// RUN:    node server.mjs
// PROBE:  node server.mjs --probe "Which contracts auto-renew in the next 90 days?"

import http from "node:http";
import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

const endpoint = "https://contoso-contract-assist-resource.services.ai.azure.com/api/projects/contoso-contract-assist";
const agentName = "vendor-contract-assistant";
const agentVersion = "3";
const PORT = 8787;

const projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());

// Exactly the portal "View code" pattern. Returns the FULL response object so we
// can inspect citations / query plan, not just output_text.
async function runAgent(userQuestion) {
  const openAIClient = projectClient.getOpenAIClient();

  const conversation = await openAIClient.conversations.create({
    items: [{ type: "message", role: "user", content: userQuestion }],
  });

  const response = await openAIClient.responses.create(
    { conversation: conversation.id },
    { body: { agent: { name: agentName, version: agentVersion, type: "agent_reference" } } }
  );

  return response;
}

function describeError(e) {
  return {
    name: e?.name ?? null,
    message: e?.message ?? String(e),
    statusCode: e?.statusCode ?? e?.status ?? null,
    code: e?.code ?? null,
  };
}

// ---- CLI probe: node server.mjs --probe "question" -------------------------
const probeIdx = process.argv.indexOf("--probe");
if (probeIdx !== -1) {
  const q = process.argv[probeIdx + 1] || "Which contracts auto-renew in the next 90 days?";
  console.log("Asking agent:", JSON.stringify(q));
  try {
    const r = await runAgent(q);
    console.log("\n===== output_text =====");
    console.log(r?.output_text ?? "(no output_text field)");
    console.log("\n===== RAW RESPONSE OBJECT =====");
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error("\n===== AGENT CALL FAILED =====");
    console.error(JSON.stringify(describeError(e), null, 2));
    console.error("\n----- full error -----");
    console.error(e);
  }
  process.exit(0);
}

// ---- Web UI ----------------------------------------------------------------
const HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contoso Contract Intelligence</title>
<style>
  :root{--bg:#0F1117;--s2:#181C25;--s3:#1E2332;--s4:#252B3B;--bd:rgba(255,255,255,.1);--tx:#F0F2F8;--t2:#8B91A8;--t3:#555C74;--ac:#0078D4;--ok:#2DBD7E;--err:#E85050}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--tx);font-family:system-ui,sans-serif;height:100vh;display:flex;flex-direction:column}
  header{background:var(--s2);border-bottom:1px solid var(--bd);padding:12px 20px;display:flex;align-items:center;gap:10px}
  .logo{width:26px;height:26px;background:var(--ac);border-radius:6px;display:flex;align-items:center;justify-content:center}
  h1{font-size:14px;font-weight:600}.sub{font-size:11px;color:var(--t3)}
  .badge{margin-left:auto;font-size:11px;color:var(--t2)}
  #log{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px}
  .msg{max-width:820px;display:flex;flex-direction:column;gap:6px}
  .msg.user{align-self:flex-end;align-items:flex-end}
  .role{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}
  .bubble{background:var(--s3);border:1px solid var(--bd);border-radius:12px;padding:12px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap}
  .msg.user .bubble{background:rgba(0,120,212,.15);border-color:rgba(0,120,212,.3)}
  .bubble.err{background:rgba(232,80,80,.1);border-color:rgba(232,80,80,.35);color:#ffb4b4}
  .think{color:var(--t3);font-size:13px}
  details{margin-top:4px}summary{font-size:11px;color:var(--t2);cursor:pointer;font-family:ui-monospace,monospace}
  pre{background:#0a0c12;border:1px solid var(--bd);border-radius:8px;padding:12px;margin-top:6px;overflow:auto;font-family:ui-monospace,monospace;font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:420px}
  .empty{margin:auto;text-align:center;color:var(--t3);max-width:460px}
  .empty h2{font-size:15px;color:var(--t2);font-weight:500;margin-bottom:8px}
  .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:16px}
  .chip{font-size:12px;background:var(--s4);border:1px solid var(--bd);color:var(--t2);border-radius:20px;padding:6px 12px;cursor:pointer}
  .chip:hover{color:var(--tx);border-color:var(--ac)}
  footer{border-top:1px solid var(--bd);background:var(--s2);padding:14px 20px}
  .inrow{display:flex;gap:10px;background:var(--s3);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 14px}
  .inrow:focus-within{border-color:var(--ac)}
  #q{flex:1;background:none;border:none;outline:none;color:var(--tx);font-size:14px;font-family:inherit;resize:none;max-height:120px}
  #send{background:var(--ac);border:none;border-radius:8px;width:36px;height:36px;color:#fff;cursor:pointer;font-size:16px;flex-shrink:0}
  #send:disabled{background:var(--s4);color:var(--t3);cursor:not-allowed}
</style></head><body>
<header>
  <div class="logo">&#9678;</div>
  <div><h1>Contoso Contract Intelligence</h1><div class="sub">Agent: vendor-contract-assistant v3 &middot; knowledge base: kb-contracts</div></div>
  <div class="badge">Foundry Agent Service</div>
</header>
<div id="log">
  <div class="empty" id="empty">
    <h2>Ask Sally's agent about the contracts</h2>
    <div>Your question goes to the real Foundry agent, which answers from its own knowledge base. The full raw response is shown under each answer.</div>
    <div class="chips">
      <div class="chip" onclick="ask(this.textContent)">Which contracts auto-renew in the next 90 days?</div>
      <div class="chip" onclick="ask(this.textContent)">Which vendors have a price escalation clause?</div>
      <div class="chip" onclick="ask(this.textContent)">What are the cancellation terms for Meridian Cloud Hosting?</div>
    </div>
  </div>
</div>
<footer>
  <div class="inrow">
    <textarea id="q" rows="1" placeholder="Ask about renewals, notice periods, escalations, data obligations..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();go()}"></textarea>
    <button id="send" onclick="go()">&#10148;</button>
  </div>
</footer>
<script>
var L=document.getElementById('log');var busy=false;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function ask(t){document.getElementById('q').value=t;go();}
function add(cls,html){var e=document.getElementById('empty');if(e)e.remove();var d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;L.appendChild(d);L.scrollTop=L.scrollHeight;return d;}
async function go(){
  var ipt=document.getElementById('q');var q=ipt.value.trim();if(!q||busy)return;busy=true;
  ipt.value='';document.getElementById('send').disabled=true;
  add('user','<div class="role">You</div><div class="bubble">'+esc(q)+'</div>');
  var t=add('assistant','<div class="role">vendor-contract-assistant v3</div><div class="think">contacting the agent...</div>');
  try{
    var res=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});
    var data=await res.json();
    if(data.error){
      t.innerHTML='<div class="role">agent error</div><div class="bubble err">'+esc(data.error.message||'unknown error')+'</div><details open><summary>raw error</summary><pre>'+esc(JSON.stringify(data.error,null,2))+'</pre></details>';
    }else{
      t.innerHTML='<div class="role">vendor-contract-assistant v3 &middot; kb-contracts</div><div class="bubble">'+esc(data.answer||'(no answer text returned)')+'</div><details><summary>raw response JSON</summary><pre>'+esc(JSON.stringify(data.raw,null,2))+'</pre></details>';
    }
  }catch(e){t.innerHTML='<div class="bubble err">request failed: '+esc(e)+'</div>';}
  L.scrollTop=L.scrollHeight;busy=false;document.getElementById('send').disabled=false;
}
</script></body></html>`;

// ---- HTTP server -----------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML);
      return;
    }
    if (req.method === "POST" && req.url === "/api/ask") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const question = (JSON.parse(body || "{}").question || "").trim();
      if (!question) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "no question" } }));
        return;
      }
      try {
        const r = await runAgent(question);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ answer: r?.output_text ?? "(no output_text field)", raw: r }));
        console.log(`[ok]  ${question}`);
      } catch (e) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
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
  console.log(`#  Contoso Contract Intelligence  ->  http://localhost:${PORT}`);
  console.log(`#  Agent: ${agentName} v${agentVersion}  (answers from kb-contracts)`);
  console.log("#  Stop: Ctrl+C");
  console.log("################################################################");
});
