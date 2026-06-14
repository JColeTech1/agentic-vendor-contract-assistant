# Contoso Contract Intelligence

A grounded **contract-intelligence console** for vendor-contract management — built for the
Microsoft Agents League hackathon. Contract PDFs are an unorganized, non-SQL "database"; this app
**adds order to the chaos**: a multi-tab operator UI over a live Azure AI Foundry agent that answers
questions about a contract portfolio and **shows its work** — every answer comes back with the exact
source documents it used and the retrieval/compute steps it took.

The demo tenant is the fictional **"Contoso Marketing."** All contract data is synthetic.

---

## What it does

- **Assistant** — a grounded chat over the contract corpus. The agent's message is shown **verbatim**
  (including its own source notes); a **reasoning trace** reflects the *actual* tools it used
  (knowledge-base retrieval and/or its code interpreter, with the real source files). Every answer
  **cites a source**. Answers surface **recommended actions** you can approve onto a live **Review &
  Timers** queue (ticking countdowns to each notice deadline). Includes a conversations rail and an
  **auto-pilot** mode that drafts non-renewal notices for your approval.
- **Web graph** — every contract as a draggable bubble map, clustered by domain **and linked by what
  contracts actually share**: same function (redundancy), shared data-privacy (DPA), close renewal
  timing, and matching price-increase rate. Each link states *why* it exists. Toggle each relationship
  on/off, scroll to zoom, drag the canvas to pan, click a contract to isolate its web.
- **Knowledge base** — four lenses over the corpus, each viewable **Flat or Grouped by category**:
  **Workbook status** (status per contract, from the agent's register), **My to-do list** (the review
  queue, with delete + detail drill-down), **Combined** (status ↔ to-do), and **Documents** — the raw
  source files, where **Open** shows the real document text fetched from the knowledge base.
- **Workbooks** — the spreadsheet the **agent actually generated** (its contract register, downloaded
  via the code-interpreter file API) under *From the agent* with a Refresh; plus *Yours* — tables you
  create inline or **upload** (`.csv` / `.xlsx`), persisted across reloads.
- **Settings** — theme (dark / light), colour-blind-safe palette, review workflow, and
  **recommended-actions mode**: Automatic / Manual / Never (default **Manual** — you approve each action).

---

## Architecture

The browser never talks to Azure directly and **holds no credentials**. All authenticated calls run
in a tiny local Node proxy.

```
Browser (React + Vite)
   │  fetch /api/ask · /api/workbook · /api/document   ← no secrets in the client bundle
   ▼
Vite dev server :5173  ──proxy /api──►  Node API proxy  (server.mjs) :8799
                                              │  Azure AI Projects SDK
                                              │  (DefaultAzureCredential / service principal)
                                              ▼
                                   Azure AI Foundry agent  ──grounded on──►  knowledge base
```

- **Frontend** — React 18 + Vite, single entry. The UI lives in [`src/console/`](src/console);
  `src/console/data.js` is the single data layer (the 16-contract corpus + helpers) that every tab
  renders from — generically, so it scales to any corpus. Design tokens (dark / light / colour-blind)
  live in `src/console/design/`.
- **API layer** — [`src/lib/foundry.js`](src/lib/foundry.js) calls relative `/api/*`; Vite forwards to
  the Node proxy. `askContract()` resolves to `{ answer, citations, queryPlan, live }` and never
  throws; `fetchAgentWorkbook()` and `fetchDocument()` (lazily cached) power the Workbook and viewer.
- **Backend proxy** — [`server.mjs`](server.mjs) authenticates with a **service principal**
  (server-side only) and exposes: `/api/ask` (the agent, verbatim answer + derived citations + a
  tool-accurate trace), `/api/workbook` (downloads the agent's generated register file), and
  `/api/document` (reconstructs a document's verbatim text from the retrieval snippets). Nothing is
  fabricated; citations are derived from the agent's real retrieval, or the file it computed over.

### Demo mode (works with no backend)

If the proxy isn't running (or rate-limits), `askContract()` returns `{ live: false }` and the console
falls back to a built-in canned engine that mirrors the corpus. Live answers are badged **live**;
fallbacks **demo**. The UI never breaks during a recording.

---

## Run it locally

### No terminal? Two-click launcher

You only need [Node.js](https://nodejs.org) (v20.6+) installed and your own API keys.

- **Windows:** double-click **`1 - Set API keys.bat`** → paste your keys (see [SETUP.md](SETUP.md)),
  save, close. Then double-click **`2 - Launch.bat`** → installs dependencies on first run, starts
  everything, opens your browser. (Close the two command windows to stop.)
- **macOS / Linux:** run **`./start.command`** once to create/edit your keys, then again to launch.
  (On macOS, the first time: right-click → Open.)

### From the terminal

**Prerequisites:** Node 20.6+ (uses `node --env-file`). Azure resources per [SETUP.md](SETUP.md).

```bash
npm install
cp .env.example .env.local      # then fill in your values — see SETUP.md
npm run server                  # terminal 1 — API proxy on :8799 (loads .env.local)
npm run dev                     # terminal 2 — Vite UI on :5173
```

Open **http://localhost:5173**. Sanity-check the agent from the CLI:

```bash
npm run probe "Which contracts auto-renew in the next 90 days?"
```

Without a configured backend you can still run `npm run dev` alone and explore the whole UI in
**demo mode**.

---

## Bring your own API / SharePoint

Nothing tenant-specific is hardcoded — all configuration comes from the environment, and every view
renders generically from the data layer, so it scales as the corpus grows. To point this at your own
Azure AI Foundry agent and contracts:

1. Fill in [`.env.example`](.env.example) → `.env.local` (credentials + project/agent).
2. Replace the corpus in `src/console/data.js` with your own contracts (same object shape) — or, since
   the agent already extracts a structured register from raw PDFs, drive the views from that register.

Full walkthrough of the Azure resources, roles, and gotchas: **[SETUP.md](SETUP.md)**.

---

## Security

- The browser bundle contains **zero credentials** — it only ever calls the local `/api` proxy.
- The service-principal secret lives only in `.env.local`, which is **gitignored** and read
  server-side by `server.mjs`.
- The agent is **grounded**: answers are shown verbatim and cite real source files; no fabricated content.

---

## Project layout

```
index.html              # single Vite entry → src/console/main.jsx
server.mjs              # local API proxy → Azure AI Foundry agent (/api/ask · /api/workbook · /api/document)
vite.config.js         # dev server + /api proxy to :8799
.env.example           # config template (copy to .env.local)
SETUP.md               # what APIs you need + how to wire them
1 - Set API keys.bat · 2 - Launch.bat · start.command   # no-terminal launchers
src/
  lib/foundry.js       # browser → /api/* (demo fallback, lazy document cache)
  console/
    main.jsx           # mounts the app
    app.jsx            # shell: header, tabs, stores (chat, review, settings)
    data.js            # the data layer (contract corpus + helpers)
    ui.jsx             # shared primitives (Badge, Chip, Citation, Countdown, …)
    chat.jsx           # demo-mode engine + citation/reco derivation
    AssistantTab.jsx KnowledgeBaseTab.jsx GraphTab.jsx WorkbookTab.jsx SettingsPage.jsx ConversationsRail.jsx
    design/            # CSS tokens (dark / light / colour-blind themes)
```

---

## Credits & disclaimers

- **Synthetic data.** All vendors, figures, and dates are fictional. "Contoso" is Microsoft's
  long-standing placeholder company.
- **Design.** The UI was produced from a Claude Design handoff and implemented here in React.
- Built for the Microsoft Agents League hackathon. Not affiliated with or endorsed by Microsoft.
