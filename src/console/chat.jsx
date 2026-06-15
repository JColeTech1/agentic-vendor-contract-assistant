// Helpers for the grounded chat. NO canned answers — the agent is the only source
// of truth. When the agent is unreachable, the UI says so honestly (see app.jsx);
// it never fabricates an answer.
import * as D from "./data.js";

// Build "recommended actions" from a live answer's citations: map each cited
// source file → contract → status → a prioritized action. Keeps the kit's
// review-queue / auto-pilot features working with real (reco-less) agent answers.
function recosFromCitations(citations) {
  const seen = new Set();
  const recos = [];
  for (const file of citations || []) {
    const c = D.contracts.find((x) => x.file === file);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    const st = D.contractStatus(c);
    recos.push({ id: c.id, label: `${c.vendor} — ${st.label}`, priority: st.status === "ok" ? "muted" : st.status });
  }
  const rank = { urgent: 0, warn: 1, muted: 2 };
  return recos.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 4);
}

// Fallback citations for answers the agent computed (no document retrieval, so
// the server returns no citations): map any vendor named in the answer to its
// source file via the corpus. Keeps every contract answer verifiable.
function citationsFromAnswer(answer) {
  const lower = (answer || "").toLowerCase();
  const out = [];
  for (const c of D.contracts) {
    const token = c.vendor.toLowerCase().split(/\s+/)[0];
    if (token.length > 3 && lower.includes(token)) out.push(c.file);
  }
  return out;
}

export { recosFromCitations, citationsFromAnswer };
