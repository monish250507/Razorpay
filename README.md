# Hallucion: Universal Trust & Translation Gateway for Agentic Commerce

Hallucion (Razorpay Agentic Intent Layer) is a secure, deterministically bound gateway designed to bridge the gap between autonomous AI agents (like Groq/Claude/OpenAI-powered shopping assistants) and the Razorpay financial execution layer. 

By enforcing strict trust verification, cryptographically signed audit logs, and hardware-level isolation between "thinking" layers and "execution" layers, Hallucion ensures that **AI agents can propose transactions, but can never independently authorize the movement of funds.**

## 🌊 Pipeline Architecture

The pipeline processes transactions through 6 immutable layers. **No layer is allowed to skip to the end.**

1. **Protocol Translation (Layer 1)**: Normalizes incoming buyer intents (whether from WhatsApp, Web, or custom LLM bots) into a `CanonicalIntentObject`. No LLMs exist in this layer.
2. **Catalog Agentification Engine (Layer 2)**: Translates unstructured merchant product descriptions into structured Razorpay catalog items. This layer uses an LLM, but it is strictly bound by the 4-Stage LLM Harness (see below).
3. **Trust & Mandate Verification (Layer 3)**: The most critical layer. Evaluates the normalized intent against risk heuristics, merchant rules, and buyer mandates. **Zero LLM imports exist here.** Uses deterministic classifiers to approve or block transactions.
4. **Orchestrator Agent (Layer 4)**: A routing layer that decides what to do with a *verified* intent. It can only call tools from a hardcoded allow-list. It cannot pass monetary values as tool arguments, and it cannot bypass Layer 3.
5. **Execution (Layer 5)**: The Razorpay integration layer. Generates Orders or Payment Links based on the orchestrator's decision. **Zero LLM imports exist here.** 
6. **Tamper-Evident Ledger (Layer 6)**: An HMAC-SHA256 cryptographically chained audit log. It records every decision, every transaction, and **every single LLM call** (accepted or rejected) to ensure full regulatory traceability.

## 🧠 Agentic Architecture & The 4-Stage LLM Harness

Hallucion operates on a foundational security principle: **"The LLM proposes. It may never dispose."**

To enforce this, all LLM API calls in Layer 2 and Layer 4 are wrapped in a proprietary **4-Stage LLM Harness**. The LLM cannot execute code or return data directly; it must survive the harness:

1. **Constrained Call**: The LLM is forced into tool-calling or structured JSON mode.
2. **Schema Validation**: The raw output is parsed through strict Pydantic models. Any deviation (extra fields, missing types) results in immediate rejection.
3. **Grounding Check**: The data proposed by the LLM (e.g., price, stock) is deterministically string-matched against the original source document. This eliminates "hallucinated discounts" or prompt injections.
4. **Bounded Execution**: The LLM's chosen action is mapped against a closed allow-list of Python functions. If the LLM invents a tool (e.g., `approve_transaction`) or tries to inject monetary values as parameters, execution is instantly blocked and gracefully falls back to a manual Payment Link.

## 🚀 Deployable MVP Features

This codebase has been upgraded from a prototype to a deployable Minimum Viable Product (MVP):

- **Backend Migration**: Upgraded from Node.js/Express to Python/FastAPI for native AI ecosystem compatibility and rigorous type safety (Pydantic).
- **Adversarial Test Suite**: Includes a rigorous 9-test adversarial suite (using Pytest) that actively tries to prompt-inject the LLM, hallucinate prices, bypass trust checks, and simulate API timeouts. The harness catches and blocks all of them.
- **Cryptographic Audit Logging**: The Layer 6 Ledger was upgraded to use `HMAC-SHA256` keyed with a 256-bit secure environment secret (`HASH_CHAIN_SECRET`). Even a database administrator cannot forge or alter past logs without the secret key.
- **Virtual Environment Isolation**: The system runs entirely inside an isolated `.venv` (`Python 3.9`), ensuring dependency stability.
- **Graceful Fallbacks**: If the AI orchestration times out or hallucinates, the system automatically degrades to generating a standard Razorpay Payment Link for human completion, ensuring the merchant never loses a sale.

## 🎮 Demo Features

For demonstration purposes, the system includes a React/Vite frontend (`npm run dev`) that visually tracks the flow of a transaction through the layers:

1. **Simulated AI Buyer Bot**: Submit natural language purchase intents.
2. **Trust Inspector View**: Watch Layer 3 calculate risk scores and mandate caps in real-time.
3. **Merchant Hub**: View the "agentified" catalog and track items flagged for `needs_manual_review` due to repeated LLM extraction failures.
4. **Live Audit Ledger**: A real-time view of the HMAC-chained ledger, showing every transaction block and every LLM hallucination successfully caught by the harness.

---

## 🎬 Interactive Demo & Walkthrough

Hallucion includes an interactive React/Vite visualizer paired with the FastAPI backend that provides real-time visibility into how transactions flow through the 6 security layers and how the 4-Stage LLM Harness protects against adversarial attacks.

### 🧑‍💻 Live Demo & Ngrok Setup (Important!)

This application can run fully on your localhost, with **ONE critical exception**: the Razorpay webhook requires the backend to be reachable from the public internet to confirm live test payments.

To ensure a reliable live demo without needing to deploy to production, we provide an automated ngrok orchestration script.

**Follow this exact setup order before a live presentation:**
1. **Start the Demo Environment:**
   Run our included script from your terminal:
   ```bash
   .venv\Scripts\python.exe scripts/start_demo.py
   ```
   *This starts the FastAPI backend and an ngrok tunnel simultaneously.*
2. **Copy the Webhook URL:** The script will output an active public URL (e.g., `https://<ngrok-id>.ngrok-free.app/api/webhooks/razorpay`). 
3. **Update Razorpay Dashboard:** Go to your Razorpay Dashboard -> Account & Settings -> Webhooks, and paste that exact URL.
4. **Verify Webhook Secret:** Ensure the `RAZORPAY_WEBHOOK_SECRET` in your `.env` matches what is configured in the dashboard. (The backend will now print the last 4 characters of your loaded secret on startup to help you visually verify this).
5. **Run Selftest:** Verify the tunnel is properly wired by opening the selftest URL provided by the script in your browser. It should return a 200 OK status.
6. **Start Frontend:** In a separate terminal, run the frontend:
   ```bash
   npm run dev:client
   ```

*Note: Because ngrok free tier changes URLs on every restart, you MUST re-paste the webhook URL into the Razorpay dashboard every time you restart the script, unless you configure a static ngrok domain.*

---

### 🖼️ Demo UI Dashboard Breakdown

The interface is structured into four main operational quadrants and a top-level architectural status pipeline:

1. **Top Pipeline Visualizer (`LayerArchitectureDiagram`)**:
   - Highlights each of the 6 pipeline layers in real-time as an intent is processed.
   - Visually indicates status changes (`Idle`, `Processing`, `Approved`, `Blocked`, `Needs Review`).

2. **Nova AI Buyer Agent Simulator (`NovaSimulator`)** — *Layer 1 Ingress*:
   - Simulates inbound agent intents across 4 agentic protocol standards:
     - **AP2** (Agent Payment Protocol)
     - **ACP** (Agentic Commerce Protocol)
     - **UCP** (Universal Commerce Protocol)
     - **NPCI_UAP** (NPCI Unified Agentic Protocol)
   - Allows fine-grained control over:
     - **Agent Identity & Protocol Payload**
     - **Item Price & Quantity** vs **Buyer Mandate Spend Cap**
     - **Mandate Expiry** (Valid, Near Expiry - 30s, Expired)
     - **Cryptographic ECDSA Signature Status** (Valid vs. Forged/Tampered)

3. **Trust & Mandate Inspector (`TrustInspector`)** — *Layer 3 & 4 Evaluation*:
   - Real-time display of Layer 3 deterministic risk scoring (0-100 scale).
   - Instant visual breakdown of mandate checks: Signature Verification, Expiry Check, Spend Limit Enforcement, and Catalog Grounding Match.
   - Shows the decision output: **APPROVED**, **BLOCKED**, or **REJECTED**.
   - Features a **"Simulate Razorpay Modal Checkout"** trigger upon intent approval.

4. **Razorpay Execution Modal (`RazorpayModal`)** — *Layer 5 Execution*:
   - Demonstrates the payment execution layer once an intent passes all trust checks.
   - Shows generated `Razorpay Order ID`, `Amount`, `Currency`, and `Payment Link`.
   - Offers an interactive payment completion simulator.

5. **Merchant Hub (`MerchantHub`)** — *Layer 2 Catalog Management*:
   - Displays merchant products normalized by the Catalog Agentification Engine.
   - Highlights items flagged for `needs_manual_review` when LLM extraction fails or confidence score drops below safety thresholds.

6. **Live Tamper-Evident Ledger View (`AuditLedgerView`)** — *Layer 6 Audit Log*:
   - Real-time stream of the HMAC-SHA256 cryptographically chained ledger.
   - Displays previous block hashes (`prev_hash`), current block hashes (`hash`), timestamp, decision result, and every intercepted LLM call (accepted or blocked prompt injections).

---

### ⚡ One-Click Test & Attack Vectors

The Nova Simulator includes 4 pre-configured test scenarios to demonstrate security layer responses in real-time:

| Test Scenario | Parameters | Expected Layer 3 Response | Result |
| :--- | :--- | :--- | :--- |
| **1. Valid AP2 Purchase** | Price: ₹550 \| Mandate Cap: ₹600 \| Valid Sig | Risk Score: Low (0/100) \| Mandate Valid | ✅ **APPROVED** → Razorpay Order Generated |
| **2. Over-Budget Attack** | Price: ₹2,500 \| Mandate Cap: ₹600 \| Valid Sig | Risk Score: High (100/100) \| Cap Exceeded | 🚫 **BLOCKED** — Spend Limit Violation |
| **3. Forged Signature Attack** | Price: ₹550 \| Mandate Cap: ₹600 \| Invalid Sig | Risk Score: High (100/100) \| Invalid Proof | 🚫 **BLOCKED** — Crypto Verification Failure |
| **4. NPCI UAP Mandate** | NPCI Protocol Payload \| Price: ₹550 \| Cap: ₹600 | Normalizes to `CanonicalIntentObject` | ✅ **APPROVED** — Protocol Translated & Verified |

---

### 🏃 Step-by-Step Demo Guide

1. **Launch the Servers**:
   ```bash
   npm run dev
   ```
2. **Access the Dashboard**: Open `http://localhost:3000` in your web browser.
3. **Execute a Test Scenario**:
   - Click **"Valid AP2 Purchase (₹550)"** in the Nova Simulator and hit **"Transmit Intent"**.
   - Watch the top pipeline diagram step through Layers 1 to 6.
   - Inspect the **Trust & Mandate Inspector** to verify the signature status and risk score (0/100).
   - Click **"Pay via Razorpay Modal"** to view the live Razorpay Order ID.
4. **Test Security Interception**:
   - Click **"Over-Budget (₹2,500 vs ₹600)"** or set signature to **"Invalid / Tampered Signature"**.
   - Hit **"Transmit Intent"**.
   - Notice how Layer 3 instantly blocks the transaction **before any LLM or payment gateway call occurs**.
   - Check the **Live Audit Ledger** at the bottom right to see the HMAC-signed audit entry recording the block.

---

### 🛠️ Running the Project

```bash
# 1. Install frontend dependencies
npm install

# 2. Run both the FastAPI backend (Port 5000) and Vite frontend (Port 3000) concurrently
npm run dev
```

*Note: Ensure you have your `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `GROQ_API_KEY`, and `HASH_CHAIN_SECRET` configured in your `.env` file.*


## ☁️ Production Deployment (Vercel)

This codebase is fully configured for a unified deployment on Vercel:
- **Frontend**: Vercel will automatically build the Vite SPA (via `npm run build`) and serve the static files, routing all client-side navigation appropriately via `vercel.json`.
- **Backend (Serverless)**: The FastAPI application is exposed via `api/index.py`. Vercel's Python runtime (`@vercel/python`) will automatically convert it into serverless functions.
- **Routing**: `vercel.json` rewrites all `/api/*` traffic to the backend, preventing any CORS issues and ensuring a single unified domain.

To deploy:
1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Add the required environment variables (`GROQ_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `HASH_CHAIN_SECRET`) in the Vercel dashboard.
4. Click Deploy. Vercel handles the rest automatically.

## 📜 Deployment & Troubleshooting History

The following challenges were encountered and resolved during the deployment of Hallucion to production environments:

- **Missing `render.yaml` / Missing env checks**: Fixed by creating a declarative Render deployment configuration and adding startup validations for required secrets (`GROQ_API_KEY`, `RAZORPAY_KEY_ID`, etc.).
- **Insecure CORS / Proxy Buffering**: Fixed wildcard CORS issues and added `Connection: keep-alive` along with `X-Accel-Buffering: no` to prevent SSE proxy buffering.
- **Razorpay Checkout Configuration Conflicts**: Resolved issues with the Razorpay modal failing to open due to contact validation ("9999999999") and redundant payload definitions (amount/currency sent alongside order_id).
- **Unhandled Frontend Exceptions**: Added robust error handlers that populate the UI explicitly upon failures instead of silently logging to the console.
- **Webhook Logging**: Implemented proper Python structured logging for webhook signature verification failures.
- **Hidden trailing spaces in `.env`**: Cleaned up the `.env` variables causing 401 Unauthorized errors from Groq.
- **Vercel Serverless Function Detection**: Implemented `api/index.py` wrapper to ensure Vercel detects the FastAPI app while preserving local `npm run dev:server` functionality.
- **Vercel SPA Routing Conflicts**: Added `vercel.json` to properly map API calls and SPA fallback routes.

This log is kept as evidence of our systematic approach to ensuring the platform runs reliably in a production environment.
