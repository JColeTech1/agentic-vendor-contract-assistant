// API layer. The browser NEVER calls Azure directly and holds NO credentials.
// It calls the local Node proxy (server.mjs) at /api/ask — Vite forwards that to
// http://localhost:8799, where the Entra-authenticated agent call actually runs.
//
// askContract() always resolves to { answer, citations[], queryPlan[], live }
// and never throws. On any failure it returns { live: false } with empty fields;
// the caller (console chat) supplies its own demo answer in that case.

const API_BASE = import.meta.env.VITE_API_BASE || ""; // "" => same-origin /api (Vite proxy)

const OFFLINE = { answer: "", citations: [], queryPlan: [], live: false };

// Probe the proxy once so the header can show a live/demo badge.
export async function checkConnection() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { status: "live", detail: data.agent || "Foundry agent connected" };
    }
    return { status: "demo", detail: "Demo mode" };
  } catch {
    return { status: "demo", detail: "Demo mode" };
  }
}

// Primary entry point used by the chat.
// opts.memory: string[] of standing facts/policies the agent should apply.
export async function askContract(query, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: query,
        memory: Array.isArray(opts.memory) ? opts.memory : [],
      }),
    });

    if (!res.ok) return { ...OFFLINE };

    const data = await res.json();
    if (data.error) {
      // Agent reachable but returned an error — degrade to demo so the UI stays usable.
      return { ...OFFLINE, error: data.error.message };
    }

    return {
      answer: data.answer || "(no answer returned)",
      citations: Array.isArray(data.citations) ? data.citations : [],
      queryPlan: Array.isArray(data.queryPlan) ? data.queryPlan : [],
      live: true,
    };
  } catch {
    // Proxy not running / network down → caller falls back to its demo engine.
    return { ...OFFLINE };
  }
}

export default askContract;
