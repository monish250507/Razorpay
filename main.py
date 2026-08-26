import os
from dotenv import load_dotenv
load_dotenv()

import json
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
import uuid

from services.catalog_engine import CatalogEngine
from services.trust_gateway import TrustGateway
from services.orchestrator_agent import OrchestratorAgent
from services.audit_ledger import AuditLedger
from services.llm_harness import run_harness, HarnessResult

# LLM audit-log endpoint needs the log function
from services.audit_ledger import AuditLedger as _AuditLedger

import logging
logger = logging.getLogger(__name__)

# Startup Checks
REQUIRED_ENV_VARS = [
    "GROQ_API_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "HASH_CHAIN_SECRET",
]
missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing_vars:
    raise RuntimeError(f"Startup Failed: Missing required environment variables: {', '.join(missing_vars)}")

from services.seed_data import run_seed
run_seed()

app = FastAPI()

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",")] if allowed_origins_env else []


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "AEGIS RAIL — Universal Trust & Translation Gateway (Python/FastAPI)",
        "version": "1.0.0",
        "layers": [
            "Layer 1: Protocol Translation Gateway (AP2, ACP, UCP, NPCI UAP)",
            "Layer 2: Catalog Agentification Engine",
            "Layer 3: Trust & Mandate Verification Gateway (Centerpiece)",
            "Layer 4: Orchestrator Agent (Groq Llama-3 SDK pattern)",
            "Layer 5: Razorpay Execution Layer",
            "Layer 6: Audit & Tamper-Evident Ledger"
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/catalog")
def get_catalog():
    return {
        "merchant": "Demo Merchant",
        "products": CatalogEngine.get_catalog(),
        "mcpSchema": CatalogEngine.get_mcp_tool_schema()
    }

@app.post("/api/catalog/query")
def query_catalog(query_params: dict):
    results = CatalogEngine.query_catalog(query_params)
    return {"count": len(results), "results": results}

@app.post("/api/process-intent")
async def process_intent(raw_buyer_request: dict):
    """
    Existing non-streaming endpoint — kept for backward compatibility and tests.
    """
    result = await OrchestratorAgent.process_transaction(raw_buyer_request)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result)
    return result


@app.post("/api/process-intent/stream")
async def process_intent_stream(request: Request):
    """
    Streaming SSE endpoint. Emits one Server-Sent Event per pipeline layer as it
    completes. The frontend consumes this with a fetch + ReadableStream reader.

    Accepts optional header:
      X-Force-LLM-Failure: true   — forces Layer 4 LLM call to fail immediately.

    SSE event format:  data: <json>\\n\\n
    Final event:       data: {"event": "done", "data": <full result object>}\\n\\n
    """
    raw_buyer_request = await request.json()
    force_llm_failure = request.headers.get("X-Force-LLM-Failure", "").lower() == "true"
    raw_buyer_request.pop("_forceFailure", None)

    async def event_generator():
        try:
            async for event in OrchestratorAgent.stream_transaction(
                raw_buyer_request,
                force_llm_failure=force_llm_failure,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            error_event = {"event": "error", "data": {"success": False, "error": str(e)}}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.post("/api/catalog/agentify")
def agentify_product(body: dict):
    """
    Layer 2 LLM-Harnessed Catalog Agentification (non-streaming).
    Body: { "product_id": str, "raw_text": str }
    """
    product_id = body.get("product_id", "")
    raw_text   = body.get("raw_text", "")
    if not product_id or not raw_text:
        raise HTTPException(status_code=422, detail="product_id and raw_text are required")

    def _audit_log(*, layer, messages, result):
        _AuditLedger.append_llm_call(
            layer=layer,
            input_messages=messages,
            raw_response=result.raw_llm_response,
            stage_reached=result.stage_reached,
            success=result.success,
            failure_reason=result.failure_reason,
            model_used=result.model_used,
            latency_ms=result.latency_ms,
            fallback_triggered=result.fallback_triggered,
        )

    result = CatalogEngine.agentify_raw_product(product_id, raw_text, audit_log_fn=_audit_log)
    return {
        **result,
        "product_id": product_id,
        "raw_text_preview": raw_text[:200],
        "harness_stage_reached": result.get("failure_reason", ""),
    }


@app.post("/api/catalog/agentify/stream")
async def agentify_product_stream(request: Request):
    """
    Streaming SSE version of catalog agentification.
    Emits harness-stage events as they conceptually complete, then the final result.

    Since the harness runs synchronously, we emit "stage_started" events before
    calling the harness, then emit the real result stage-by-stage using the
    stage_reached field from HarnessResult to determine where it stopped.

    SSE events:
      { stage: "CONSTRAINED_CALL" | "SCHEMA_VALIDATION" | "GROUNDING_CHECK" | "BOUNDED_EXECUTION",
        status: "running" | "passed" | "failed",
        detail: str }
      Final: { event: "done", data: <agentify result> }
             { event: "error", data: ... }

    Body: { "product_id": str, "raw_text": str }
    """
    body = await request.json()
    product_id = body.get("product_id", "")
    raw_text   = body.get("raw_text", "")

    if not product_id or not raw_text:
        async def err():
            yield f"data: {json.dumps({'event':'error','data':{'error':'product_id and raw_text required'}})}\n\n"
        return StreamingResponse(err(), media_type="text/event-stream")

    STAGE_ORDER = ["CONSTRAINED_CALL", "SCHEMA_VALIDATION", "GROUNDING_CHECK", "BOUNDED_EXECUTION"]
    STAGE_LABELS = {
        "CONSTRAINED_CALL":  "Stage 1: Groq Constrained Call",
        "SCHEMA_VALIDATION": "Stage 2: Pydantic Schema Validation",
        "GROUNDING_CHECK":   "Stage 3: Grounding Check (anti-hallucination)",
        "BOUNDED_EXECUTION": "Stage 4: Bounded Execution Allow-List",
    }

    harness_result_holder = {}
    audit_log_holder = []

    def _audit_log(*, layer, messages, result):
        audit_log_holder.append(result)
        _AuditLedger.append_llm_call(
            layer=layer,
            input_messages=messages,
            raw_response=result.raw_llm_response,
            stage_reached=result.stage_reached,
            success=result.success,
            failure_reason=result.failure_reason,
            model_used=result.model_used,
            latency_ms=result.latency_ms,
            fallback_triggered=result.fallback_triggered,
        )

    async def event_generator():
        import asyncio

        # Emit "running" for all stages upfront so the UI can render a progress list
        for stage in STAGE_ORDER:
            yield f"data: {json.dumps({'stage': stage, 'label': STAGE_LABELS[stage], 'status': 'pending'})}\n\n"

        # Small delay so frontend renders the pending states before we block
        await asyncio.sleep(0.05)

        # Emit stage 1 as "running"
        yield f"data: {json.dumps({'stage': 'CONSTRAINED_CALL', 'label': STAGE_LABELS['CONSTRAINED_CALL'], 'status': 'running', 'detail': 'Calling Groq with structured-output schema…'})}\n\n"
        await asyncio.sleep(0)

        # Run the actual harness (blocking call — runs in event loop, Groq network I/O)
        import asyncio as _asyncio
        loop = _asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: CatalogEngine.agentify_raw_product(product_id, raw_text, audit_log_fn=_audit_log)
        )
        harness_result_holder['result'] = result

        # Reconstruct which stages passed/failed from the audit log
        hr = audit_log_holder[0] if audit_log_holder else None

        stage_reached = hr.stage_reached if hr else "COMPLETE"
        stage_success = hr.success if hr else result.get("success", False)
        failure_reason = hr.failure_reason if hr else result.get("failure_reason")
        model_used = hr.model_used if hr else None
        latency_ms = hr.latency_ms if hr else None

        # Determine which stages passed vs failed
        final_stage_idx = len(STAGE_ORDER)  # all passed by default
        if stage_reached in STAGE_ORDER:
            final_stage_idx = STAGE_ORDER.index(stage_reached)

        for i, stage in enumerate(STAGE_ORDER):
            if i < final_stage_idx:
                # This stage completed before failure — mark passed
                detail = ""
                if stage == "CONSTRAINED_CALL" and model_used:
                    detail = f"Model: {model_used} · Latency: {latency_ms}ms"
                elif stage == "SCHEMA_VALIDATION":
                    detail = "Pydantic model validated all fields"
                elif stage == "GROUNDING_CHECK":
                    detail = "All field values traced to source document"
                yield f"data: {json.dumps({'stage': stage, 'label': STAGE_LABELS[stage], 'status': 'passed', 'detail': detail})}\n\n"
            elif i == final_stage_idx:
                # This is the stage that failed (or the final stage if success)
                if stage_success or result.get("success"):
                    # Actually succeeded — all stages passed
                    detail = ""
                    if stage == "CONSTRAINED_CALL" and model_used:
                        detail = f"Model: {model_used} · Latency: {latency_ms}ms"
                    yield f"data: {json.dumps({'stage': stage, 'label': STAGE_LABELS[stage], 'status': 'passed', 'detail': detail})}\n\n"
                else:
                    yield f"data: {json.dumps({'stage': stage, 'label': STAGE_LABELS[stage], 'status': 'failed', 'detail': failure_reason or 'Stage failed'})}\n\n"
                    # Remaining stages skipped
                    for j in range(i + 1, len(STAGE_ORDER)):
                        yield f"data: {json.dumps({'stage': STAGE_ORDER[j], 'label': STAGE_LABELS[STAGE_ORDER[j]], 'status': 'skipped'})}\n\n"
                    break
            await asyncio.sleep(0)

        # If success, publish to catalog and emit done
        if result.get("success") and result.get("entry"):
            entry = result["entry"]
            # Add to live catalog so it's immediately queryable
            new_product = {
                "id": product_id,
                "name": entry.get("name", product_id),
                "description": entry.get("description", ""),
                "price": entry.get("price", 0),
                "currency": entry.get("currency", "INR"),
                "stock": entry.get("stock", 0),
                "category": entry.get("category", "General"),
                "tags": [],
                "return_policy": entry.get("return_policy", ""),
                "shipping_time": entry.get("shipping_time", ""),
                "agent_ready": True,
                "onboarded_at": datetime.utcnow().isoformat() + "Z",
            }
            CatalogEngine.catalog.append(new_product)

            yield f"data: {json.dumps({'event': 'done', 'data': {**result, 'product_id': product_id, 'published_product': new_product}})}\n\n"
        else:
            yield f"data: {json.dumps({'event': 'done', 'data': {**result, 'product_id': product_id}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.post("/api/nova/parse-intent")
async def nova_parse_intent(request: Request):
    """
    Part B — Conversational buyer-agent entry point.

    Takes a natural-language shopping request and uses the Groq LLM harness
    (same infrastructure as Layer 4, same structured-output constraints) to
    convert it into a valid AP2 purchase intent payload that can be fed directly
    into /api/process-intent/stream.

    The LLM is given the ACTUAL live catalog as context, so it can only select
    real products that exist — it cannot invent product IDs or prices.

    Body: { "query": str, "buyer_agent_name"?: str }
    Returns: { "success": bool, "payload": <AP2 intent> | null,
               "matched_product": <catalog item> | null,
               "failure_reason": str | null,
               "model_used": str, "latency_ms": int }
    """
    from openai import OpenAI
    from pydantic import BaseModel, Field
    from typing import Optional as Opt

    body = await request.json()
    nl_query = body.get("query", "").strip()
    buyer_name = body.get("buyer_agent_name", "Nova AI Assistant")
    protocol = body.get("protocol", "AP2")

    if not nl_query:
        raise HTTPException(status_code=422, detail="query is required")

    # Fetch live catalog to ground the LLM
    catalog = CatalogEngine.get_catalog()
    catalog_context = "\n".join([
        f"- ID: {p['id']} | Name: {p['name']} | Price: ₹{p['price']} INR | "
        f"Stock: {p['stock']} | Category: {p['category']} | "
        f"Description: {p['description'][:100]}"
        for p in catalog
    ])

    valid_until = (datetime.utcnow() + timedelta(minutes=10)).isoformat() + "Z"

    # JSON schema the LLM must conform to
    output_schema = {
        "type": "object",
        "properties": {
            "matched": {"type": "boolean", "description": "True if a product was confidently matched"},
            "product_id": {"type": "string", "description": "Exact product ID from catalog, or empty string if no match"},
            "product_name": {"type": "string", "description": "Exact product name from catalog, or empty string"},
            "price": {"type": "number", "description": "Exact price from catalog in INR, or 0 if no match"},
            "suggested_spend_limit": {"type": "number", "description": "Recommended mandate spend limit (price + 10% buffer), or 0"},
            "failure_reason": {"type": "string", "description": "If matched=false, explain why. Empty string if matched=true"},
        },
        "required": ["matched", "product_id", "product_name", "price", "suggested_spend_limit", "failure_reason"],
        "additionalProperties": False,
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are a product-matching assistant for an agentic commerce system. "
                "Given a user's natural-language shopping request, find the BEST matching product "
                "from the provided catalog. You MUST only select products that actually exist in "
                "the catalog below — do NOT invent product IDs, names, or prices. "
                "If no product reasonably matches, set matched=false and explain why.\n\n"
                f"LIVE CATALOG:\n{catalog_context}"
            ),
        },
        {
            "role": "user",
            "content": f"Shopping request: \"{nl_query}\"\n\nFind the best matching product from the catalog above.",
        },
    ]

    start = time.time()
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL   = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    GROQ_FALLBACK = os.getenv("GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")
    GROQ_TIMEOUT = float(os.getenv("GROQ_TIMEOUT_SECONDS", "8.0"))

    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
        timeout=GROQ_TIMEOUT,
    )

    raw_json = None
    model_used = None
    call_error = None

    for model in [GROQ_MODEL, GROQ_FALLBACK]:
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.1,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "nova_product_match",
                        "strict": True,
                        "schema": output_schema,
                    }
                }
            )
            raw_json = resp.choices[0].message.content
            model_used = model
            break
        except Exception as e:
            call_error = str(e)
            continue

    latency_ms = int((time.time() - start) * 1000)

    if not raw_json:
        return {
            "success": False,
            "payload": None,
            "matched_product": None,
            "failure_reason": f"LLM call failed: {call_error}",
            "model_used": model_used,
            "latency_ms": latency_ms,
        }

    try:
        parsed = json.loads(raw_json)
    except Exception:
        return {
            "success": False,
            "payload": None,
            "matched_product": None,
            "failure_reason": f"LLM returned non-JSON output: {raw_json[:200]}",
            "model_used": model_used,
            "latency_ms": latency_ms,
        }

    if not parsed.get("matched"):
        return {
            "success": False,
            "payload": None,
            "matched_product": None,
            "failure_reason": parsed.get("failure_reason") or "No matching product found in catalog",
            "model_used": model_used,
            "latency_ms": latency_ms,
        }

    # Grounding check: verify the returned product_id actually exists in catalog
    matched_product = next((p for p in catalog if p["id"] == parsed["product_id"]), None)
    if not matched_product:
        return {
            "success": False,
            "payload": None,
            "matched_product": None,
            "failure_reason": f"LLM returned product_id '{parsed['product_id']}' which does not exist in catalog (grounding check failed)",
            "model_used": model_used,
            "latency_ms": latency_ms,
        }

    # Use real catalog price (not LLM-returned price) for the actual amount
    real_price = matched_product["price"]
    spend_limit = max(real_price * 1.1, parsed.get("suggested_spend_limit", real_price * 1.1))
    spend_limit = round(spend_limit + 50)  # round up
    sig_token = "valid_nl_signature_token"
    if protocol == "AP2":
        intent_payload = {
            "protocol": "AP2",
            "buyer_agent_id": "agent_nova_nl_01",
            "buyer_agent_name": buyer_name,
            "merchant_id": "merchant_meera_candles",
            "items": [{
                "id": matched_product["id"],
                "title": matched_product["name"],
                "price": real_price,
                "quantity": 1,
            }],
            "mandate": {
                "spend_limit": spend_limit,
                "signature": sig_token,
                "purpose": f"Purchase from catalog match: {matched_product['name']}",
                "expires_at": valid_until,
            }
        }
    elif protocol == "ACP":
        intent_payload = {
            "protocol": "ACP",
            "agent_id": "agent_nova_nl_01",
            "merchant_id": "merchant_meera_candles",
            "line_items": [{
                "product_id": matched_product["id"],
                "name": matched_product["name"],
                "amount": real_price,
                "qty": 1
            }],
            "amount_total": real_price,
            "authorization": {
                "max_amount": spend_limit,
                "token": sig_token,
                "valid_until": valid_until
            }
        }
    elif protocol == "UCP":
        intent_payload = {
            "protocol": "UCP",
            "agent": {"id": "agent_nova_nl_01", "name": buyer_name},
            "merchant": {"id": "merchant_meera_candles"},
            "cart": [{
                "item_id": matched_product["id"],
                "item_name": matched_product["name"],
                "price": real_price,
                "count": 1
            }],
            "payment_auth": {
                "limit": spend_limit,
                "expiry": valid_until,
                "signature": sig_token
            }
        }
    else:
        # Default fallback to AP2
        intent_payload = {
            "protocol": "AP2",
            "buyer_agent_id": "agent_nova_nl_01",
            "buyer_agent_name": buyer_name,
            "merchant_id": "merchant_meera_candles",
            "items": [{
                "id": matched_product["id"],
                "title": matched_product["name"],
                "price": real_price,
                "quantity": 1,
            }],
            "mandate": {
                "spend_limit": spend_limit,
                "signature": sig_token,
                "purpose": f"Purchase from catalog match: {matched_product['name']}",
                "expires_at": valid_until,
            }
        }

    # Log this LLM call to the audit ledger
    _AuditLedger.append_llm_call(
        layer="Nova_NL_Intent_Parser",
        input_messages=messages,
        raw_response=raw_json,
        stage_reached="COMPLETE",
        success=True,
        failure_reason=None,
        model_used=model_used,
        latency_ms=latency_ms,
        fallback_triggered=False,
    )

    return {
        "success": True,
        "payload": intent_payload,
        "matched_product": matched_product,
        "nl_query": nl_query,
        "failure_reason": None,
        "model_used": model_used,
        "latency_ms": latency_ms,
    }


@app.get("/api/catalog/manual-review")
def get_manual_review_items():
    """Returns product IDs currently flagged for manual review (failed harness 2+ times)."""
    return {"items_pending_review": CatalogEngine.get_manual_review_flags()}

@app.get("/api/simulations")
def get_simulations():
    now = datetime.utcnow()
    valid_until = (now + timedelta(minutes=10)).isoformat() + "Z"
    expired = (now - timedelta(minutes=2)).isoformat() + "Z"

    return [
        {
            "id": "valid_ap2_purchase",
            "name": "1. Valid AP2 Purchase (Nova -> Meera)",
            "description": "Nova orders Sandalwood Soy Candle (₹550) within ₹600 AP2 spend mandate with valid signature.",
            "payload": {
                "protocol": "AP2",
                "buyer_agent_id": "agent_nova_01",
                "buyer_agent_name": "Nova AI Assistant",
                "merchant_id": "merchant_meera_candles",
                "items": [{"id": "prod_candle_01", "title": "Handmade Sandalwood Soy Candle", "price": 550, "quantity": 1}],
                "mandate": {
                    "spend_limit": 600,
                    "signature": "ap2_ecdsa_valid_sig_9942a",
                    "purpose": "User search: find soy candle under 600",
                    "expires_at": valid_until
                }
            }
        },
        {
            "id": "over_budget_blocked",
            "name": "2. Over-Budget Blocked (Mandate Violation)",
            "description": "Rogue agent attempts to buy ₹2,500 premium diffuser package with a ₹600 cap mandate.",
            "payload": {
                "protocol": "AP2",
                "buyer_agent_id": "agent_rogue_bot",
                "buyer_agent_name": "Unconstrained Procurement Bot",
                "merchant_id": "merchant_meera_candles",
                "items": [
                    {"id": "prod_candle_01", "title": "Handmade Sandalwood Soy Candle", "price": 550, "quantity": 1},
                    {"id": "prod_candle_03", "title": "Spiced Cinnamon & Orange Festive Diffuser", "price": 799, "quantity": 2}
                ],
                "mandate": {
                    "spend_limit": 600,
                    "signature": "ap2_ecdsa_valid_sig_8821b",
                    "purpose": "Purchase home fragrance set",
                    "expires_at": valid_until
                }
            }
        },
        {
            "id": "forged_signature_blocked",
            "name": "3. Forged Cryptographic Signature Blocked",
            "description": "Request with invalid or tampered ECDSA mandate token.",
            "payload": {
                "protocol": "ACP",
                "buyer_agent_id": "agent_unverified_99",
                "buyer_agent_name": "Unknown Shopping Script",
                "merchant_id": "merchant_meera_candles",
                "line_items": [{"product_id": "prod_candle_01", "name": "Handmade Sandalwood Soy Candle", "amount": 550, "qty": 1}],
                "amount_total": 550,
                "authorization": {
                    "max_amount": 600,
                    "token": "acp_tok_invalid_forged_tampered_token",
                    "valid_until": valid_until
                }
            }
        },
        {
            "id": "expired_mandate_blocked",
            "name": "4. Expired Mandate Blocked",
            "description": "Buyer agent request sent after mandate timestamp expired.",
            "payload": {
                "protocol": "UCP",
                "buyer_agent_id": "agent_slow_bot",
                "buyer_agent_name": "Laggy Shopping Assistant",
                "merchant_id": "merchant_meera_candles",
                "cart": [{"item_id": "prod_candle_01", "item_name": "Handmade Sandalwood Soy Candle", "price": 550, "count": 1}],
                "cart_total": 550,
                "user_mandate": {
                    "cap": 600,
                    "proof": "ucp_proof_valid_123",
                    "expiry": expired
                }
            }
        },
        {
            "id": "npci_uap_simulated",
            "name": "5. Simulated NPCI UAP Mandate Flow",
            "description": "Indian UPI Unified Agent Protocol (UAP) delegate mandate execution.",
            "payload": {
                "protocol": "NPCI_UAP",
                "buyer_agent_id": "npci_agent_ind_01",
                "buyer_agent_name": "Bharat AI Assistant",
                "merchant_id": "merchant_meera_candles",
                "product_code": "prod_candle_01",
                "product_desc": "Handmade Sandalwood Soy Candle",
                "mandate_amount": 550,
                "upi_mandate_limit": 600,
                "npci_token": "uap_npci_signed_valid_token_2026",
                "mandate_expiry": valid_until
            }
        }
    ]

@app.get("/api/ledger")
def get_ledger():
    return {
        "totalEntries":   len(AuditLedger.get_ledger()),
        "integrityCheck": AuditLedger.verify_integrity(),
        "ledger":         AuditLedger.get_ledger()
    }

@app.get("/api/ledger/llm-calls")
def get_llm_call_log():
    """Full log of every Groq call (accepted or rejected) with input, output, and harness stage."""
    log = AuditLedger.get_llm_call_log()
    return {
        "totalLlmCalls":   len(log),
        "acceptedCalls":   sum(1 for e in log if e["success"]),
        "rejectedCalls":   sum(1 for e in log if not e["success"]),
        "fallbacksCalled": sum(1 for e in log if e["fallback_triggered"]),
        "calls":           log,
    }

@app.get("/api/ledger/full")
def get_full_audit_log():
    """Merged, time-ordered audit trail: transactions + all LLM calls."""
    return {
        "totalEntries": len(AuditLedger.get_full_audit_log()),
        "log":          AuditLedger.get_full_audit_log(),
    }

import hmac
import hashlib

# In-memory store for webhook statuses
# Format: order_id -> "pending" | "confirmed" | "failed"
_transaction_statuses = {}

import asyncio
_merchant_subscribers = []

@app.get("/api/merchant/notifications/stream")
async def stream_merchant_notifications(request: Request):
    """
    SSE endpoint for Merchant View to receive real-time webhook notifications.
    """
    queue = asyncio.Queue()
    _merchant_subscribers.append(queue)
    
    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                # Wait for a new notification in the queue
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in _merchant_subscribers:
                _merchant_subscribers.remove(queue)
                
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    """
    Real Razorpay Webhook endpoint.
    Verifies signature and logs to Audit Ledger.
    """
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "test_webhook_secret_123")
    
    # Get raw body for signature verification
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    
    # Verify signature
    expected_signature = hmac.new(
        key=webhook_secret.encode('utf-8'),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    try:
        payload = json.loads(raw_body.decode('utf-8'))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    is_valid = hmac.compare_digest(expected_signature, signature)
    
    event_type = payload.get("event")
    order_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")

    # If signature fails, log it to ledger as an invalid attempt and reject
    if not is_valid:
        AuditLedger.append_webhook_event(
            event_type=event_type or "unknown",
            payload=payload,
            signature_valid=False
        )
        logger.warning(f"Webhook signature verification failed for event {event_type}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Signature is valid. Process it.
    if order_id:
        if event_type == "payment.captured":
            _transaction_statuses[order_id] = "confirmed"
        elif event_type == "payment.failed":
            _transaction_statuses[order_id] = "failed"
            
    # Check if this exact payment event was already logged to prevent duplicates
    # For a real system we'd check payment ID in the DB.
    # We check if the ledger already has a WEBHOOK_EVENT for this paymentId and eventType
    payment_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
    ledger_entries = AuditLedger.get_ledger()
    already_logged = any(
        e.get("type") == "WEBHOOK_EVENT" and 
        e.get("eventType") == event_type and 
        e.get("paymentId") == payment_id 
        for e in ledger_entries
    )

    if not already_logged:
        # Write to hash-chained audit ledger
        AuditLedger.append_webhook_event(
            event_type=event_type,
            payload=payload,
            signature_valid=True
        )

        # Broadcast to any connected Merchant View clients if successful payment
        if event_type == "payment.captured" and order_id:
            tx_details = AuditLedger.get_transaction_details(order_id)
            notification = {
                "event": "payment.captured",
                "orderId": order_id,
                "amount": tx_details["amount"],
                "buyerAgent": tx_details["buyerAgent"],
                "trustScore": tx_details["trustScore"],
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "paymentId": payment_id
            }
            # Enqueue to all active subscribers
            for queue in _merchant_subscribers:
                queue.put_nowait(notification)

    return {"status": "ok"}

@app.get("/api/transactions/{order_id}/status")
def get_transaction_status(order_id: str):
    """
    Polling endpoint for the frontend to check if the webhook has arrived.
    Returns: pending, confirmed, or failed
    """
    status = _transaction_statuses.get(order_id, "pending")
    return {"order_id": order_id, "status": status}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
