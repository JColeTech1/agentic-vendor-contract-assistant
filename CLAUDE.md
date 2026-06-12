# Contoso Contract Intelligence — Claude Code Instructions

You are building a local React app for the Microsoft Agents League Hackathon (due June 14, 2026).
Read this entire file before touching any code. Follow the TASKS.md checklist in order.

---

## What this app is

A contract intelligence dashboard for "Contoso Marketing" (fictional demo company).
Left panel: contract dashboard with status cards, alert strip, stats, and a to-do list.
Right panel: chat interface grounded on Foundry IQ — answers contract questions with citations and a visible reasoning trace.

The app runs **locally only** (`npm run dev`). No deployment needed. It will be demoed via screen recording.

---

## Stack

- React 18 + Vite
- No UI framework — custom CSS only (dark theme, already designed)
- No backend — all API calls go directly from the browser to Azure
- All credentials come from `.env.local` — never hardcode them

---

## Credentials (from .env.local)

```
VITE_SEARCH_ENDPOINT        → Azure AI Search URL (search.windows.net)
VITE_SEARCH_API_KEY         → Azure AI Search API key
VITE_KNOWLEDGE_BASE_NAME    → Knowledge base name in Foundry portal
VITE_PROJECT_ENDPOINT       → Foundry project endpoint
VITE_OPENAI_ENDPOINT        → Azure OpenAI endpoint
VITE_OPENAI_API_KEY         → Azure OpenAI / Foundry API key (already in .env.local)
VITE_AGENT_ID               → Foundry Agent ID (if agent was created — check .env.local)
VITE_API_VERSION            → 2026-05-01-preview
```

Read all values via `import.meta.env.VITE_*`. Never read them any other way.

---

## File structure to create

```
contoso-contracts/
├── CLAUDE.md                  ← this file
├── TASKS.md                   ← your checklist
├── .env.local                 ← credentials (already exists, do not overwrite)
├── .gitignore                 ← must exclude .env.local and node_modules
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx                ← root layout: header + two-panel grid
    ├── index.css              ← global CSS variables and reset
    ├── data/
    │   └── contracts.js       ← synthetic contract data (see below)
    ├── lib/
    │   └── foundry.js         ← all API calls (search retrieve + agent chat)
    ├── hooks/
    │   └── useChat.js         ← chat state: messages, loading, history
    └── components/
        ├── Header.jsx         ← top bar: logo, powered-by badge, connection status
        ├── Dashboard.jsx      ← left panel shell
        ├── AlertStrip.jsx     ← urgent contracts banner
        ├── StatRow.jsx        ← 3 stat cards: total / urgent / auto-renew
        ├── ContractList.jsx   ← scrollable list of ContractCard components
        ├── ContractCard.jsx   ← individual contract card with status badge
        ├── TodoList.jsx       ← action to-do list (see spec below)
        ├── QueryChips.jsx     ← suggested query buttons
        ├── ChatPanel.jsx      ← right panel shell
        ├── ChatTopbar.jsx     ← reasoning trace / query plan display
        ├── MessageList.jsx    ← scrollable message history
        ├── Message.jsx        ← single message bubble with citations + trace
        └── ChatInput.jsx      ← textarea + send button
```

---

## Synthetic contract data (contracts.js)

Seven fictional vendor contracts for Contoso Marketing.
Each contract object must have these fields:

```js
{
  id: string,
  vendor: string,
  type: string,           // e.g. "Cloud Infrastructure", "SaaS License"
  renewalDate: Date,      // use offsetDate(days) helper
  noticeDays: number,     // 30 | 60 | 90
  autoRenew: boolean,
  annualValue: number,
  dataPrivacy: boolean,   // whether a DPA is attached
  priceEscalation: boolean,
  escalationPct: number | null,  // e.g. 5 for "up to 5%", null if none
  notes: string           // one-line plain-English summary of key fine print
}
```

Vendors to use (vary the terms so demo questions have interesting answers):
1. Meridian Cloud Hosting — auto-renew, 30-day notice, renewal in ~12 days, $84k, DPA, 5% CPI escalation
2. Apex SaaS Suite — auto-renew, 60-day notice, renewal in ~45 days, $36k, DPA, no escalation
3. Brightline Telecom — no auto-renew, 30-day notice, renewal in ~90 days, $18k, no DPA, 3% escalation
4. Northside Staffing — no auto-renew, 60-day notice, renewal in ~120 days, $220k, no DPA, no escalation
5. CleanCo Facilities — auto-renew, 30-day notice, renewal in ~180 days, $9.6k, no DPA, no escalation
6. Vantage Equipment Lease — auto-renew, 90-day notice, renewal in ~270 days, $48k, no DPA, 4% CPI
7. SecureShield Cyber — no auto-renew, 60-day notice, renewal in ~310 days, $28k, no DPA, no escalation

Export both the array and an `offsetDate(days)` helper.

---

## To-do list spec (TodoList.jsx)

This is the feature that makes the app look like a real product, not a demo.

### What it is
A task board in the bottom of the left panel. Tasks are derived automatically from contract data — no manual input required for the demo. Users can also mark tasks done.

### Auto-generated task rules
Run these rules against the contracts array on mount and whenever contracts change:

| Rule | Task generated |
|---|---|
| autoRenew === true AND daysUntil(renewalDate) <= noticeDays | "⚠ Cancel or confirm renewal: {vendor} — {N} days left" → priority: urgent |
| autoRenew === true AND daysUntil(renewalDate) <= noticeDays + 30 | "Review auto-renewal: {vendor} — window opens in {N} days" → priority: warning |
| dataPrivacy === true AND renewalDate within 90 days | "Verify DPA obligations: {vendor}" → priority: normal |
| priceEscalation === true AND renewalDate within 180 days | "Review price escalation clause: {vendor} ({pct}% cap)" → priority: normal |

### Task object shape
```js
{
  id: string,
  contractId: string,
  label: string,
  priority: 'urgent' | 'warning' | 'normal',
  done: boolean,
  source: 'auto' | 'manual'
}
```

### UI behavior
- Tasks sorted: urgent first, then warning, then normal
- Clicking a task card highlights the matching contract in ContractList
- Checkbox marks task done (strikethrough, moves to bottom)
- Small "Ask agent →" button on each task sends a pre-built question to the chat:
  e.g. clicking on the Meridian task fires: "What are the exact cancellation terms for the Meridian Cloud Hosting contract?"
- Badge on panel header shows count of incomplete urgent tasks

---

## API layer (foundry.js)

Export two functions:

### 1. `retrieveFromKnowledgeBase(query, conversationHistory)`
Calls the Azure AI Search knowledge base retrieve endpoint directly.

```
POST {VITE_SEARCH_ENDPOINT}/knowledgebases/{VITE_KNOWLEDGE_BASE_NAME}/retrieve
  ?api-version={VITE_API_VERSION}
Headers:
  Content-Type: application/json
  api-key: {VITE_SEARCH_API_KEY}
Body:
  {
    query: string,
    top: 5,
    messages: conversationHistory (last 6 turns, role/content pairs)
  }
```

Parse response:
- Answer text: `data['@search.answers']?.[0]?.text` OR join `data.value[].content`
- Citations: `data.value[].metadata_storage_name` or `data.value[].sourcefile`
- Query plan subqueries: `data['@search.queryPlan']?.subqueries`

### 2. `chatWithAgent(query, conversationHistory)` — only if VITE_AGENT_ID is set
Calls Foundry Agent Service via the project endpoint.

```
POST {VITE_PROJECT_ENDPOINT}/agents/{VITE_AGENT_ID}/messages
Headers:
  Content-Type: application/json
  api-key: {VITE_OPENAI_API_KEY}
Body:
  { role: 'user', content: query }
```

### Primary function: `askContract(query, conversationHistory)`
- If `VITE_AGENT_ID` is set → use `chatWithAgent`
- Otherwise → use `retrieveFromKnowledgeBase`
- Always return: `{ answer: string, citations: string[], queryPlan: string[] }`
- On any error: return `{ answer: 'Could not retrieve answer. Check connection.', citations: [], queryPlan: [] }`
- Never throw — catch all errors inside this function

---

## Demo mode (when no credentials are set)

If `VITE_SEARCH_API_KEY` is empty or missing, `askContract()` should return canned demo answers.
Import demo answers from `src/data/demoAnswers.js`.

Include canned answers for these five questions (match on keyword):
1. "auto-renew" / "90 days" → multi-contract answer about Meridian + Apex + CleanCo
2. "price escalation" / "increase" → Meridian + Brightline + Vantage
3. "data privacy" / "DPA" → Meridian + Apex only
4. "largest" / "annual" → full ranked list by value
5. "notice" / "summary" / "all contracts" → all seven with notice periods

Each demo answer must include fake citations (vendor filename strings) and fake queryPlan steps (3 steps minimum) so the UI renders the full reasoning trace UI even in demo mode.

---

## Design tokens (index.css)

Use this exact palette — do not deviate:

```css
:root {
  --surface:       #0F1117;
  --surface-2:     #181C25;
  --surface-3:     #1E2332;
  --surface-4:     #252B3B;
  --border:        rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.14);
  --text-primary:  #F0F2F8;
  --text-secondary:#8B91A8;
  --text-muted:    #555C74;
  --accent:        #0078D4;
  --accent-glow:   rgba(0,120,212,0.18);
  --urgent:        #E85050;
  --urgent-bg:     rgba(232,80,80,0.10);
  --warn:          #F0A500;
  --warn-bg:       rgba(240,165,0,0.10);
  --ok:            #2DBD7E;
  --ok-bg:         rgba(45,189,126,0.10);
  --font:          'Inter', system-ui, sans-serif;
  --mono:          'JetBrains Mono', monospace;
  --radius:        8px;
  --radius-lg:     12px;
}
```

Load Inter and JetBrains Mono from Google Fonts in index.html.
All component styles go in their own `.module.css` file alongside the component.

---

## Connection status (Header.jsx)

On app load, attempt a test call:
```
POST {VITE_SEARCH_ENDPOINT}/knowledgebases/{VITE_KNOWLEDGE_BASE_NAME}/retrieve
  body: { query: 'test', top: 1 }
```
- Success (200 or 400) → green dot, "Foundry IQ connected"
- Failure / no credentials → gray dot, "Demo mode"
- Error → red dot, "Connection failed"

---

## Security rules (non-negotiable)

- `.env.local` must be in `.gitignore` — verify this before any commit
- No credentials anywhere in source files
- No console.log of API keys or full response objects
- The public repo gets synthetic data only — `.env.local` stays local

---

## Suggested query chips

Pre-load these five in QueryChips.jsx:
1. "Which contracts auto-renew in the next 90 days?"
2. "Which vendors have a price escalation clause?"
3. "Which contracts carry data-privacy obligations?"
4. "What's our largest annual vendor commitment?"
5. "Summarize all notice periods by vendor"

Clicking a chip populates the chat input and immediately fires sendMessage().

---

## Key demo moment (build this well)

The single most important UI moment for the judges:

User clicks the Meridian Cloud Hosting task ("⚠ Cancel or confirm renewal — 3 days left")
→ Chat input pre-fills: "What are the exact cancellation terms for the Meridian Cloud Hosting contract?"
→ Query plan steps animate in the topbar one by one
→ Answer appears with citation badge: `meridian-cloud-hosting.txt`
→ Alert strip already shows Meridian flagged red

This sequence must work perfectly in demo mode with no credentials.
