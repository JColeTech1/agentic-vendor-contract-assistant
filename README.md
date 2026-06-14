# Contoso Contract Intelligence

A grounded **contract-intelligence console** for vendor-contract management — built for the
Microsoft Agents League hackathon. It pairs a multi-tab operator UI with a chat assistant that
answers questions about a contract portfolio and **shows its work**: every answer comes back with
the exact source documents it used and the retrieval steps it took.

The demo tenant is the fictional **"Contoso Marketing."** All contract data is synthetic.

> **Status:** Assistant (live agent), Knowledge base, and Graph are complete. **Workbooks is a
> work in progress** (the sheet logic is still being designed).

---

## What it does

- **Assistant** — a grounded chat over the contract corpus. Answers stream a **reasoning trace**,
  cite the **source files** they're drawn from, and surface **recommended actions** you can drop onto
  a live **Review & Timers** queue (with ticking countdowns to each notice deadline). Includes a
  conversations rail, and an **auto-pilot** mode that drafts non-renewal notices for your approval.
- **Knowledge base** — the contract corpus that grounds the agent, shown two ways: a flat document
  library (*Current*) and the same files re-clustered by domain (*Organized*).
- **Graph** — every contract as a connected bubble map (Contoso → domain clusters → contracts) with a
  status ring per renewal.
- **Workbooks** *(in progress)* — spreadsheet views of the corpus (Renewals / All Contracts /
  Escalations / DPA Register) plus user-created tables.
- **Settings** — theme (dark / light), colour-blind-safe palette, review workflow, alert mode, and a
  **Memory** panel: standing facts/policies the agent applies to every answer.

---

## Architecture

The browser never talks to Azure directly and **holds no credentials**. All authenticated calls run
in a tiny local Node proxy.

```
Browser (React + Vite)
   │  fetch /api/ask        ← no secrets in the client bundle
   ▼
Vite dev server :5173  ──proxy /api──►  Node API proxy  (server.mjs) :8799
                                              │  Azure AI Projects SDK
                                              │  (DefaultAzureCredential / service principal)
                                              ▼
                                   Azure AI Foundry agent  ──grounded on──►  knowledge base
```

- **Frontend** — React 18 + Vite, single entry. The UI lives in [`src/console/`](src/console);
  `src/console/data.js` is the single data layer (the 16-contract corpus + helpers) that every tab
  renders from. Design tokens (dark / light / colour-blind themes) are in `src/console/design/`.
- **API layer** — [`src/lib/foundry.js`](src/lib/foundry.js) calls the relative path `/api/ask`;
  Vite forwards it to the Node proxy. It always resolves to `{ answer, citations, queryPlan, live }`
  and never throws.
- **Backend proxy** — [`server.mjs`](server.mjs) authenticates with a **service principal**
  (server-side only), calls the Foundry agent, and returns a clean
  `{ answer, citations, queryPlan }`. It parses the agent's real citations and the actual retrieval
  subqueries (the "reasoning trace") from the response — nothing is fabricated.

### Demo mode (works with no backend)

If the proxy isn't running (or rate-limits), `askContract()` returns `{ live: false }` and the console
falls back to a built-in canned answer engine that mirrors the real corpus. Live answers are badged
**live**; fallbacks are badged **demo**. The UI never breaks during a recording.

---

## Run it locally

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

## Bring your own API

Nothing tenant-specific is hardcoded — all configuration comes from the environment, and the contract
corpus is a swappable data layer. To point this at your own Azure AI Foundry agent and contracts:

1. Fill in [`.env.example`](.env.example) → `.env.local` (credentials + project/agent).
2. Replace the corpus in `src/console/data.js` with your own contracts (same object shape).

Full walkthrough of the Azure resources, roles, and gotchas: **[SETUP.md](SETUP.md)**.

---

## Security

- The browser bundle contains **zero credentials** — it only ever calls the local `/api` proxy.
- The service-principal secret lives only in `.env.local`, which is **gitignored** and read
  server-side by `server.mjs`.
- The agent is **grounded**: answers cite real source files; there is no fabricated content.

---

## Project layout

```
index.html              # single Vite entry → src/console/main.jsx
server.mjs              # local API proxy → Azure AI Foundry agent
vite.config.js         # dev server + /api proxy to :8799
.env.example           # config template (copy to .env.local)
SETUP.md               # what APIs you need + how to wire them
src/
  lib/foundry.js       # browser → /api/ask (with demo fallback)
  console/
    main.jsx           # mounts the app
    app.jsx            # shell: header, tabs, stores (chat, review, memory, settings)
    data.js            # the data layer (contract corpus + helpers)
    ui.jsx             # shared primitives (Badge, Chip, Citation, Countdown, …)
    chat.jsx           # demo-mode answer engine + reco derivation
    AssistantTab.jsx KnowledgeBaseTab.jsx GraphTab.jsx WorkbookTab.jsx SettingsPage.jsx ConversationsRail.jsx
    design/            # CSS tokens (dark / light / colour-blind themes)
```

---

## Credits & disclaimers

- **Synthetic data.** All vendors, figures, and dates are fictional. "Contoso" is Microsoft's
  long-standing placeholder company.
- **Design.** The UI was produced from a Claude Design handoff and implemented here in React.
- Built for the Microsoft Agents League hackathon. Not affiliated with or endorsed by Microsoft.
