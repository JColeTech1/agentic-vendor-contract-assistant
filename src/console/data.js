// Contract corpus for the Contoso Contract Intelligence UI kit.
// Ported from the product codebase (src/data/contracts.js) and enriched with an
// `category` for the Knowledge Base clusters, Graph nodes, and Workbook sheets.
// "Today" for the demo is mid-June 2026 — several notice windows are closing now.

const d = (iso) => new Date(iso + "T00:00:00");

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function noticeDeadline(c) {
  const dl = new Date(c.renewalDate);
  dl.setDate(dl.getDate() - (c.noticeDays || 0));
  return dl;
}

function fmtMoney(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 ? 2 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + n;
}

function fmtDate(date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// status ∈ urgent | warn | ok | muted — keyed off the NOTICE DEADLINE
function contractStatus(c) {
  const toRenewal = daysUntil(c.renewalDate);
  if (c.autoRenew) {
    const toDeadline = daysUntil(noticeDeadline(c));
    if (toDeadline < 0) return { status: "urgent", label: "Notice passed — auto-renews", days: toDeadline };
    if (toDeadline <= 14) return { status: "urgent", label: `Act in ${toDeadline}d`, days: toDeadline };
    if (toDeadline <= 45) return { status: "warn", label: `Window in ${toDeadline}d`, days: toDeadline };
    return { status: "ok", label: "Auto-renew", days: toDeadline };
  }
  if (toRenewal <= 90) return { status: "warn", label: `Expires in ${toRenewal}d`, days: toRenewal };
  return { status: "muted", label: "Manual renewal", days: toRenewal };
}

// Idea-based clusters (Knowledge Base "Organized form" + Graph categories).
const CATEGORIES = {
  cloud:      { id: "cloud",      label: "Cloud & IT",            color: "var(--accent)" },
  comms:      { id: "comms",      label: "Comms & Email",         color: "#6FB1E8" },
  finance:    { id: "finance",    label: "Finance & People",      color: "var(--ok)" },
  work:       { id: "work",       label: "Work & CRM",            color: "#B58BE0" },
  creative:   { id: "creative",   label: "Creative & Media",      color: "var(--warn)" },
  facilities: { id: "facilities", label: "Facilities & Equipment",color: "#8B91A8" },
};

const contracts = [
  { id: "stratus", file: "stratus-cloud-hosting.md", vendor: "Stratus Cloud Hosting", type: "Cloud Infrastructure", category: "cloud", renewalDate: d("2026-07-01"), noticeDays: 90, autoRenew: true, annualValue: 144000, dataPrivacy: true, priceEscalation: true, escalationPct: 3, notes: "Auto-renews 1-yr terms; 90-day non-renewal notice deadline was Apr 2, 2026 — already passed, so it will renew. Fee rises by the greater of 3% or CPI. DPA + 72h breach notice." },
  { id: "sendcrest", file: "sendcrest-email.md", vendor: "Sendcrest Email", type: "Email Service Provider", category: "comms", renewalDate: d("2026-07-31"), noticeDays: 60, autoRenew: true, annualValue: 30000, dataPrivacy: true, priceEscalation: true, escalationPct: null, notes: "Auto-renews Jul 31, 2026; 60-day non-renewal notice deadline was Jun 1, 2026 — already passed. Usage overage $0.50 / 1k emails; tier re-evaluated at renewal. DPA + SCCs." },
  { id: "securehaven", file: "securehaven-it.md", vendor: "SecureHaven IT Partners", type: "Managed IT Services", category: "cloud", renewalDate: d("2026-09-15"), noticeDays: 90, autoRenew: true, annualValue: 156000, dataPrivacy: true, priceEscalation: true, escalationPct: 3, notes: "Auto-renews Sep 15, 2026; 90-day non-renewal notice due Jun 17, 2026 — window closing now. CPI + up to 3% at renewal. DPA + Security Addendum, 24h incident reporting." },
  { id: "ledgerwise", file: "ledgerwise-accounting.md", vendor: "Ledgerwise Accounting & Payroll", type: "Accounting / Payroll", category: "finance", renewalDate: d("2026-08-31"), noticeDays: 60, autoRenew: true, annualValue: 48000, dataPrivacy: true, priceEscalation: true, escalationPct: 3, notes: "Auto-renews Aug 31, 2026; 60-day notice due Jul 2, 2026. Fee +3% each renewal. Processes employee SSNs/bank data under DPA (Exhibit A), 72h breach notice." },
  { id: "cadence", file: "cadence-work-os.md", vendor: "Cadence Work OS", type: "Work Management Platform", category: "work", renewalDate: d("2026-09-01"), noticeDays: 60, autoRenew: true, annualValue: 28800, dataPrivacy: true, priceEscalation: true, escalationPct: 6, notes: "Auto-renews Sep 1, 2026; 60-day notice due Jul 2, 2026. Per-seat fee +6% each renewal (80 seats). DPA (Exhibit A)." },
  { id: "keystone", file: "keystone-benefits-group.md", vendor: "Keystone Benefits Group", type: "Employee Benefits Brokerage", category: "finance", renewalDate: d("2026-09-01"), noticeDays: 60, autoRenew: true, annualValue: 24000, dataPrivacy: true, priceEscalation: false, escalationPct: null, notes: "Auto-renews Sep 1, 2026; 60-day notice due Jul 3, 2026. Handles PHI under a HIPAA Business Associate Agreement + DPA. No fixed escalation." },
  { id: "archivepix", file: "archivepix-media.md", vendor: "ArchivePix Media", type: "Stock Media License", category: "creative", renewalDate: d("2026-08-10"), noticeDays: 30, autoRenew: true, annualValue: 12000, dataPrivacy: false, priceEscalation: false, escalationPct: null, notes: "Stock media / asset license. Auto-renews Aug 10, 2026; 30-day non-renewal notice deadline Jul 11, 2026." },
  { id: "tasklytic", file: "tasklytic-project-management.md", vendor: "Tasklytic Project Management", type: "SaaS License", category: "work", renewalDate: d("2026-08-15"), noticeDays: 30, autoRenew: true, annualValue: 54000, dataPrivacy: false, priceEscalation: true, escalationPct: 7, notes: "Auto-renews Aug 15, 2026; 30-day notice due Jul 15, 2026. Per-seat fee +7% each renewal (150 seats). No signed DPA — Security Overview governs data handling." },
  { id: "pixelforge", file: "pixelforge-creative-suite.md", vendor: "Pixelforge Creative Suite", type: "Creative Software License", category: "creative", renewalDate: d("2026-09-30"), noticeDays: 60, autoRenew: true, annualValue: 68400, dataPrivacy: false, priceEscalation: true, escalationPct: 7, notes: "Auto-renews Sep 30, 2026; 60-day cancel notice due Aug 1, 2026. Renewal fee +7% (120 seats). Not a processor of personal data; no DPA." },
  { id: "veritel", file: "veritel-communications.md", vendor: "Veritel Communications", type: "Telecom / Connectivity", category: "comms", renewalDate: d("2026-10-15"), noticeDays: 60, autoRenew: true, annualValue: 36000, dataPrivacy: false, priceEscalation: true, escalationPct: 8, notes: "Auto-renews Oct 15, 2026; 60-day notice due Aug 16, 2026. Renewal increase capped at 8%. Handles only call-detail records; no DPA in effect." },
  { id: "relayworks", file: "relayworks-crm.md", vendor: "Relayworks CRM", type: "CRM / Marketing Automation", category: "work", renewalDate: d("2027-02-01"), noticeDays: 90, autoRenew: true, annualValue: 96000, dataPrivacy: true, priceEscalation: true, escalationPct: null, notes: "Auto-renews Feb 1, 2027; 90-day notice due Nov 3, 2026. CPI adjustment at renewal. Extensive end-customer personal data under DPA + SCCs." },
  { id: "insightline", file: "insightline-analytics.md", vendor: "Insightline Analytics", type: "Marketing Analytics", category: "creative", renewalDate: d("2026-08-20"), noticeDays: 60, autoRenew: false, annualValue: 54000, dataPrivacy: true, priceEscalation: false, escalationPct: null, notes: "Does NOT auto-renew; expires Aug 20, 2026 unless a written renewal order is signed (intent notice by Jun 21, 2026). Processor under DPA (Schedule 2). No escalation." },
  { id: "pristineworks", file: "pristineworks-cleaning.md", vendor: "PristineWorks Facility Services", type: "Janitorial / Facilities", category: "facilities", renewalDate: d("2026-08-31"), noticeDays: 60, autoRenew: false, annualValue: 28800, dataPrivacy: false, priceEscalation: false, escalationPct: null, notes: "Fixed 1-yr term, expires Aug 31, 2026. No auto-renewal (signed renewal required); 60-day renewal-intent courtesy by Jul 2, 2026. Fixed pricing, no DPA." },
  { id: "lumen", file: "lumen-creative-staffing.md", vendor: "Lumen Creative Staffing", type: "Creative Staffing (MSA)", category: "creative", renewalDate: d("2027-01-15"), noticeDays: 30, autoRenew: false, annualValue: 210000, dataPrivacy: false, priceEscalation: true, escalationPct: 4, notes: "2-yr MSA ending Jan 14, 2027; no auto-renew (extend by signed amendment). Rate card +4%/yr. ~$210k variable spend; 30-day termination notice." },
  { id: "harborline", file: "harborline-properties-office-lease.md", vendor: "Harborline Properties", type: "Commercial Office Lease", category: "facilities", renewalDate: d("2027-07-01"), noticeDays: 120, autoRenew: false, annualValue: 390000, dataPrivacy: false, priceEscalation: true, escalationPct: 3, notes: "5-yr lease ending Jun 30, 2027. Manual renewal option only — exercise by Mar 2, 2027 (120-day notice). Base rent +3% each anniversary; no DPA." },
  { id: "meridian", file: "meridian-office-systems.md", vendor: "Meridian Office Systems", type: "Equipment Lease (Copiers)", category: "facilities", renewalDate: d("2026-12-31"), noticeDays: 90, autoRenew: false, annualValue: 18000, dataPrivacy: false, priceEscalation: false, escalationPct: null, notes: "5-yr copier lease ends Dec 31, 2026. No auto-renew; 90-day end-of-term election by Oct 2, 2026 or it drops to month-to-month holdover. Fixed pricing, no DPA." },
];

// Suggested chat prompts (from product QueryChips).
const QUERY_CHIPS = [
  "Which contracts auto-renew in the next 90 days?",
  "Which vendors have a price escalation clause?",
  "Which contracts carry data-privacy obligations?",
  "What's our largest annual vendor commitment?",
  "Summarize all notice periods by vendor",
];

// Build a review/to-do item from a contract id (+ optional label/priority/source overrides).
function reviewItemFromContract(id, opts = {}) {
  const c = contracts.find((x) => x.id === id);
  if (!c) return null;
  const st = contractStatus(c);
  const deadline = c.autoRenew ? noticeDeadline(c) : c.renewalDate;
  return {
    id: c.id, vendor: c.vendor, type: c.type, category: c.category,
    priority: opts.priority || st.status,
    label: opts.label || st.label,
    deadline, days: daysUntil(deadline),
    source: opts.source || "auto",
    question: `What are the exact cancellation and renewal terms for the ${c.vendor} contract, and what is the deadline to act?`,
  };
}

// The seed review queue: contracts that need attention now (urgent / warn).
function buildReviewItems() {
  return contracts
    .map((c) => reviewItemFromContract(c.id))
    .filter((r) => r.priority === "urgent" || r.priority === "warn")
    .sort((a, b) => a.days - b.days);
}

// Draft a non-renewal / cancellation notice for a contract (Auto-pilot).
function draftNotice(id) {
  const c = contracts.find((x) => x.id === id);
  if (!c) return "";
  const dl = c.autoRenew ? noticeDeadline(c) : c.renewalDate;
  return [
    `Subject: Formal non-renewal notice — ${c.vendor}`,
    ``,
    `To the ${c.vendor} account team,`,
    ``,
    `Per the terms of our agreement (ref: ${c.file}), Contoso Marketing is providing`,
    `formal notice of its intent regarding the term renewing ${fmtDate(c.renewalDate)}.`,
    `This satisfies the contract's ${c.noticeDays}-day notice requirement (deadline`,
    `${fmtDate(dl)}). Please confirm receipt and the effective wind-down date.`,
    ``,
    `— Procurement, Contoso Marketing`,
    `[Auto-drafted by Foundry IQ · pending human approval]`,
  ].join("\n");
}

export { contracts, CATEGORIES, QUERY_CHIPS, daysUntil, noticeDeadline, fmtMoney, fmtDate, contractStatus, reviewItemFromContract, buildReviewItems, draftNotice };
