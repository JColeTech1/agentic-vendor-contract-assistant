// ───────── Demo answer engine ─────────
// Canned, keyword-matched answers so the grounded-chat UI renders its full
// reasoning trace + citations with no backend. Mirrors the product demo mode.
import * as D from "./data.js";

function demoAnswer(q, memory) {
  const s = q.toLowerCase();
  const facts = Array.isArray(memory) ? memory : [];
  const cite = (...ids) => ids.map((id) => D.contracts.find((c) => c.id === id)?.file).filter(Boolean);

  if (s.includes("auto-renew") || s.includes("90 day")) {
    return {
      answer:
        "Six contracts auto-renew within the next 90 days. The most urgent are Stratus Cloud Hosting (notice deadline already passed — it will renew) and SecureHaven IT Partners (90-day notice due Jun 17, window closing now). Sendcrest Email's 60-day notice deadline also passed on Jun 1. Cadence Work OS, Keystone Benefits and Ledgerwise all renew Aug–Sep with notice due early July.",
      citations: cite("stratus", "securehaven", "sendcrest", "cadence"),
      queryPlan: ['decompose: "auto-renewing within 90 days"', "retrieve top-5 from kb-contracts", "filter autoRenew = true AND renewal ≤ 90d", "rank by notice deadline"],
      recos: [{ id: "securehaven", label: "Give notice on SecureHaven IT — due Jun 17", priority: "urgent" }, { id: "stratus", label: "Confirm Stratus Cloud auto-renewal", priority: "warn" }],
    };
  }
  if (s.includes("escalation") || s.includes("increase") || s.includes("price")) {
    return {
      answer:
        "Nine contracts carry a price-escalation clause. Veritel Communications has the highest cap at 8%, followed by Tasklytic and Pixelforge at 7% and Cadence Work OS at 6%. Stratus, SecureHaven and Ledgerwise rise the greater of 3% or CPI. Lumen's rate card increases 4%/yr and Harborline's lease base rent 3% each anniversary.",
      citations: cite("veritel", "tasklytic", "pixelforge", "cadence"),
      queryPlan: ['decompose: "price escalation clauses"', "retrieve from kb-contracts", "filter priceEscalation = true", "sort by escalation cap"],
      recos: [{ id: "veritel", label: "Challenge Veritel +8% escalation at renewal", priority: "warn" }, { id: "tasklytic", label: "Budget for Tasklytic +7% seat increase", priority: "muted" }],
    };
  }
  if (s.includes("data") || s.includes("dpa") || s.includes("privacy")) {
    return {
      answer:
        "Seven contracts carry data-privacy obligations under a signed DPA: Stratus, Sendcrest, SecureHaven, Ledgerwise, Cadence, Relayworks and Insightline. Keystone Benefits additionally operates under a HIPAA Business Associate Agreement for PHI. Breach-notification windows range from 24h (SecureHaven) to 72h (Stratus, Ledgerwise).",
      citations: cite("stratus", "securehaven", "ledgerwise", "keystone", "relayworks"),
      queryPlan: ['decompose: "data-privacy / DPA obligations"', "retrieve from kb-contracts", "filter dataPrivacy = true", "extract breach-notice terms"],
      recos: [{ id: "keystone", label: "Confirm Keystone HIPAA BAA is current", priority: "warn" }, { id: "securehaven", label: "Verify SecureHaven 24h breach-notice SLA", priority: "muted" }],
    };
  }
  if (s.includes("largest") || s.includes("annual") || s.includes("commitment") || s.includes("value")) {
    const policy = facts.find((f) => /\$?100k|approv/i.test(f));
    return {
      answer:
        "By annual value, the largest commitments are: Harborline Properties office lease ($390k), Lumen Creative Staffing MSA ($210k), SecureHaven IT ($156k) and Stratus Cloud Hosting ($144k). Total annual contracted spend across all 16 vendors is roughly $1.20M." +
        (policy ? `\n\nFrom memory — "${policy}": Harborline, Lumen, SecureHaven and Stratus all exceed that threshold and would need Legal sign-off at renewal.` : ""),
      citations: cite("harborline", "lumen", "securehaven", "stratus"),
      queryPlan: ['decompose: "largest annual commitment"', "retrieve all from kb-contracts", "sort by annualValue desc", "sum total spend"],
      recos: [{ id: "harborline", label: "Open Harborline lease renewal review ($390k)", priority: "muted" }, { id: "lumen", label: "Plan Lumen MSA extension ($210k)", priority: "muted" }],
    };
  }
  if (s.includes("notice") || s.includes("summar") || s.includes("all contract")) {
    return {
      answer:
        "Notice periods by vendor: 120 days — Harborline. 90 days — Stratus, SecureHaven, Relayworks, Meridian. 60 days — Sendcrest, Ledgerwise, Cadence, Keystone, Pixelforge, Veritel, Insightline, PristineWorks. 30 days — ArchivePix, Tasklytic, Lumen. The tightest live deadlines are SecureHaven (Jun 17) and the Insightline renewal-intent date (Jun 21).",
      citations: cite("harborline", "securehaven", "insightline", "sendcrest"),
      queryPlan: ['decompose: "notice periods by vendor"', "retrieve all from kb-contracts", "group by noticeDays", "flag deadlines within 14d"],
      recos: [{ id: "securehaven", label: "SecureHaven notice deadline Jun 17", priority: "urgent" }, { id: "insightline", label: "Insightline renewal-intent by Jun 21", priority: "warn" }],
    };
  }
  // Vendor-specific
  const match = D.contracts.find((c) => s.includes(c.vendor.toLowerCase().split(" ")[0]));
  if (match) {
    const mst = D.contractStatus(match);
    return {
      answer: `${match.vendor} — ${match.type}. ${match.notes} Annual value ${D.fmtMoney(match.annualValue)}; renews ${D.fmtDate(match.renewalDate)} with a ${match.noticeDays}-day notice period.`,
      citations: [match.file],
      queryPlan: [`decompose: "${match.vendor} terms"`, `retrieve ${match.file} from kb-contracts`, "extract cancellation, pricing & data terms"],
      recos: [{ id: match.id, label: `Act on ${match.vendor} renewal`, priority: mst.status === "ok" ? "muted" : mst.status }],
    };
  }
  return {
    answer:
      "I ground every answer in the Contoso contract corpus. Try asking about auto-renewals, notice periods, price escalations, data-privacy obligations, or a specific vendor by name.",
    citations: [],
    queryPlan: ['parse intent', "no matching filter — suggest scoped queries"],
    recos: [],
  };
}

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

export { demoAnswer, recosFromCitations, citationsFromAnswer };
