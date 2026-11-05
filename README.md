# SplitPay AI

**Snap the bill. AI settles it.**

SplitPay AI reads a receipt photo, understands how you want to split it in plain English, and uses an AI agent built on the **PayPal Agent Toolkit** to send everyone a PayPal request, track who has paid, and send polite reminders until the group is settled.

> Built for the PayPal AI Hackathon 2026. Runs entirely on the free PayPal **sandbox**.

---

## The problem

After every trip, flat-share month or group dinner, one person pays and then spends a week chasing friends over chat. Splitting apps work out *who owes what*, but collecting the money is still manual, awkward and easy to forget.

## What it does

| Step | What happens | Tech |
|---|---|---|
| 📸 **Snap the receipt** | Claude reads every line item, tax, service charge and tip, and checks they add up to the total | Claude vision + structured outputs |
| 💬 **Say how to split it** | "Raj doesn't drink, Priya had both brownies, Sam is vegetarian, tip split equally" becomes an exact item-by-item assignment | Claude structured outputs |
| 🧮 **Exact money math** | The AI only decides *who shares what*. Deterministic code turns that into cents that always add up (largest-remainder rounding) | TypeScript |
| 📊 **Group ledger** | Every expense and each person's share, with sorting, filtering and a totals row | AG Grid |
| 📨 **Collect with PayPal** | One click sends each person a PayPal invoice for exactly what they owe; status syncs from PayPal | PayPal Agent Toolkit (Invoicing) |
| 🤖 **Agent** | Chat: "Who still owes me?", "Remind whoever hasn't paid", "I paid $48 for the cab, split with Raj and Priya" | Claude tool use + PayPal Agent Toolkit |

### Guardrails (agentic payments done safely)
- **The AI never sets amounts.** PayPal request amounts are always computed from the ledger; the agent can only pick *who* to request from.
- **Per-request cap.** Requests above `MAX_REQUEST_CENTS` are blocked.
- **No duplicate requests.** Amounts already requested (and still open) are subtracted.
- **Check before nagging.** The agent refreshes PayPal status before sending reminders.
- **Refusal fallback.** Claude requests use server-side fallbacks so a classifier false-positive doesn't break a user action.

## Architecture

```
Browser (Next.js + React + Tailwind + AG Grid)
   │
   ├── /api/receipt   ── Claude (vision, structured output) ──► items / tax / tip
   ├── /api/split     ── Claude (structured output) ──► who-shares-what ──► exact cents (split.ts)
   ├── /api/groups/:id/requests ─┐
   └── /api/groups/:id/agent ────┤  Claude tool runner (agent.ts)
                                 ▼
                        service.ts (ledger + guardrails)
                                 ▼
                 PayPal Agent Toolkit  ──►  PayPal Invoicing API (sandbox)
                 create_invoice · send_invoice · get_invoice ·
                 send_invoice_reminder · cancel_sent_invoice
```

| File | Purpose |
|---|---|
| `src/lib/paypal.ts` | All PayPal calls, through `@paypal/agent-toolkit` |
| `src/lib/ai.ts` | Receipt reading and split planning with Claude (`claude-opus-5-5`) |
| `src/lib/agent.ts` | The SplitPay agent: Claude tool runner with PayPal-backed tools |
| `src/lib/service.ts` | Ledger operations and payment guardrails, shared by UI and agent |
| `src/lib/money.ts`, `split.ts` | Balances, debt simplification, exact cent allocation |

## Tools used

- **PayPal Agent Toolkit** (`@paypal/agent-toolkit`): creating, sending, checking, reminding and cancelling invoices in the PayPal sandbox. The toolkit's tool executor is wrapped as Claude tools.
- **Claude API** (`@anthropic-ai/sdk`, model `claude-opus-5-5`):
  - Vision + structured outputs (Zod schema) to read receipts
  - Structured outputs to turn plain-English split rules into item assignments
  - Tool runner for the agent, whose tools call PayPal through the toolkit
- **AG Grid Community** for the group ledger
- **Next.js 15 / React 19 / Tailwind CSS 4**
- **Render** for hosting (see below)

## Run it locally

Requirements: Node.js 20+, a free [PayPal Developer](https://developer.paypal.com) account, an [Anthropic API key](https://console.anthropic.com).

```bash
git clone https://github.com/Kamal934/splitpay-ai.git
cd splitpay-ai
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Getting the PayPal sandbox values
1. developer.paypal.com → **Apps & Credentials** → toggle **Sandbox** → **Create App** → copy the Client ID and Secret.
2. **Testing Tools → Sandbox Accounts**: copy the **Business** account email into `PAYPAL_SANDBOX_BUSINESS_EMAIL` (invoices come from this account).
3. Create 2–3 **Personal** sandbox accounts and use their emails for your friends (or put them in `DEMO_EMAIL_1..3`). You can then open the invoice's payer link, log in as that personal account and pay it with sandbox money. Click **Check payments** in SplitPay and the status changes to PAID.

### Try it in 60 seconds
1. Open the site → **Try the live demo** (or **Open app → Load demo trip**).
2. Upload `public/samples/goa-dinner-receipt.png`.
3. Type: *"Raj doesn't drink, Priya had both brownies, Sam is vegetarian so no prawns or fish, tip split equally"* → **Split with AI** → **Save**.
4. **Send PayPal requests**, or ask the agent: *"Send PayPal requests to everyone who owes"*.
5. Ask the agent: *"Has anyone paid yet? Remind whoever hasn't."*

## Deploy on Render
1. New **Web Service** → connect this repo.
2. Build command `npm install && npm run build`, start command `npm start`.
3. Add the environment variables from `.env.example`.
4. Optional: add a persistent disk and set `DATA_DIR` to its mount path so groups survive restarts.

## What's next
- PayPal **Payouts** so the organiser can pay back friends who fronted money (full many-to-many settlement)
- Recurring splits for flatmates (rent, utilities) with PayPal subscriptions
- Multi-currency trips
- WhatsApp / Telegram bot front-end for the same agent

## License
MIT. See [LICENSE](LICENSE).
