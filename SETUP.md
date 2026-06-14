# Setup — what APIs you need to run this

This app is **bring-your-own-API**. It ships with no working credentials; you point it at your own
Azure AI Foundry agent. This guide lists every Azure resource required, how they connect, and the
exact environment variables to set. Config-only — no code changes needed.

---

## The big picture

```
Service principal (Entra app)  ──auth──►  Foundry project
                                              └─ Agent (name + version)
                                                   └─ grounded on a Knowledge base
                                                        └─ Azure AI Search index over
                                                           a blob container of contract docs
                                              └─ Model deployment (powers the agent)
```

`server.mjs` authenticates as the **service principal**, calls the **agent** in your **project**, and
the agent retrieves from its **knowledge base** to answer. You supply all of the above.

---

## 1. Azure resources to create

Create these in the [Azure AI Foundry portal](https://ai.azure.com) and the
[Azure portal](https://portal.azure.com):

| # | Resource | What it's for | Where |
|---|----------|---------------|-------|
| 1 | **Azure AI Foundry project** | The container for your agent, KB, and model. | ai.azure.com → create project |
| 2 | **Model deployment** | The LLM that powers the agent (e.g. a GPT-4-class model). | Project → Models + endpoints → Deploy |
| 3 | **Knowledge base** | What the agent retrieves from. Built over an **Azure AI Search** index that points at a **blob container** of your contract documents (one file per contract — `.md`, `.pdf`, etc.). | Project → Build → Knowledge |
| 4 | **Agent** | The thing you call. Created in the project, **grounded on the knowledge base (#3)**, using the model (#2). Note its **name** and **version**. | Project → Agents |
| 5 | **Service principal** (Microsoft Entra **app registration**) + **client secret** | Non-interactive auth so `server.mjs` runs without a browser login. | portal.azure.com → Entra ID → App registrations |
| 6 | **Role assignment** | Grant the service principal (#5) the **`Azure AI User`** role on the Foundry **account/project**. Without this the agent call returns 401 *PermissionDenied* (or a 404 that masks it). | portal.azure.com → the resource → Access control (IAM) → Add role assignment |

> **Document format:** put **one file per contract** in the blob container, not a single combined
> file — the indexer/retriever works best with separate documents, and each filename becomes the
> citation the UI shows.

> **Agent capabilities (optional tabs):** the **Documents → Open** viewer uses normal knowledge-base
> retrieval (works with any grounded agent). The **Workbooks → "From the agent"** view downloads a
> register file the agent writes via its **code-interpreter** tool — enable code interpreter on the
> agent for that tab. Both degrade gracefully if unavailable.

---

## 2. Environment variables

Copy `.env.example` → `.env.local` and fill these in. `.env.local` is gitignored — never commit it.

| Variable | What it is | Example / source |
|----------|-----------|------------------|
| `AZURE_TENANT_ID` | Directory (tenant) ID of the app registration | Entra → app registration → Overview |
| `AZURE_CLIENT_ID` | Application (client) ID | Entra → app registration → Overview |
| `AZURE_CLIENT_SECRET` | A client secret **value** (not the secret ID) | Entra → app registration → Certificates & secrets |
| `FOUNDRY_PROJECT_ENDPOINT` | Project endpoint | `https://<resource>.services.ai.azure.com/api/projects/<project>` (Project → Endpoints & key) |
| `FOUNDRY_AGENT_NAME` | The agent's name | Project → Agents |
| `FOUNDRY_AGENT_VERSION` | The agent's version | usually `1` (or whatever the portal shows) |
| `PORT` *(optional)* | Port for the local API proxy | defaults to `8799` |
| `VITE_API_BASE` *(optional)* | Override where the browser sends `/api` | leave unset to use the Vite proxy |

These are read **server-side only** by `server.mjs` via `node --env-file=.env.local`. They are **not**
`VITE_`-prefixed, so Vite never bundles them into the browser.

---

## 3. Swap in your own contracts (the data layer)

The dashboard, graph, knowledge-base, and workbook tabs all render from one file:
**`src/console/data.js`**. Replace the `contracts` array with your own (keep the shape), and every tab
repopulates. Each entry's `file` must match the citation filename your agent returns, so cards line up
with citation badges.

```js
{
  id, file,            // stable id + source filename (the citation)
  vendor, type,        // display
  category,            // one of CATEGORIES — drives clusters + graph
  renewalDate,         // Date
  noticeDays,          // notice period (days)
  autoRenew,           // bool — flips urgency to deadline-based
  annualValue,         // number — sizes graph bubbles, sums stats
  dataPrivacy,         // bool — DPA register
  priceEscalation, escalationPct,  // escalation views
  notes,               // one-line plain-English summary
}
```

> The chat answers come from your live agent, so they reflect **your** knowledge base regardless of
> `data.js`. For full coherence (left-panel cards matching right-panel citations), keep `data.js` in
> sync with the documents in your knowledge base.

---

## 4. Auth scope / token audience

`server.mjs` uses `DefaultAzureCredential`, which picks up the `AZURE_*` env vars (EnvironmentCredential)
first. The Foundry data plane expects tokens for the **`https://ai.azure.com`** audience — the SDK
requests this automatically. (A token for `https://cognitiveservices.azure.com` is rejected with
*"audience is incorrect (https://ai.azure.com)"*.)

---

## 5. Gotchas that cost real time

- **Exact project name.** The project segment in `FOUNDRY_PROJECT_ENDPOINT` must match exactly. A
  near-miss returns `404 "The project does not exist."`
- **`agent_reference`, not `agent`.** The Responses payload uses `agent_reference`; the older `agent`
  key returns `400 "deprecated"`. (Already handled in `server.mjs`.)
- **RBAC masking.** If the service principal lacks the `Azure AI User` role, you may get a 404 rather
  than a clear 403. Assign the role and retry.
- **OS-reserved ports (Windows).** Some ports (e.g. 8787) are reserved by WinNAT and fail to bind with
  `EACCES`. This app defaults to **8799**; change `PORT` if needed.
- **Model quota / rate limits.** Low per-minute quota → `429`. `server.mjs` retries 429 twice with
  backoff; beyond that the UI falls back to demo mode. Raise the deployment's TPM for a smooth live demo.

---

## 6. Verify

```bash
npm install
cp .env.example .env.local      # fill in
npm run probe "Which contracts auto-renew in the next 90 days?"
```

A grounded answer with citations and a query plan means the whole chain (service principal → role →
project → agent → knowledge base) is working. Then `npm run server` + `npm run dev` and open the app.
