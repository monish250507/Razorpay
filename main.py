import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import uuid

from services.catalog_engine import CatalogEngine
from services.trust_gateway import TrustGateway
from services.orchestrator_agent import OrchestratorAgent
from services.audit_ledger import AuditLedger

# LLM audit-log endpoint needs the log function
from services.audit_ledger import AuditLedger as _AuditLedger

app = FastAPI()

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
            "Layer 4: Orchestrator Agent (Claude Agent SDK pattern)",
            "Layer 5: Razorpay Execution Layer",
            "Layer 6: Audit & Tamper-Evident Ledger"
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/catalog")
def get_catalog():
    return {
        "merchant": "Meera's Handmade Candles",
        "products": CatalogEngine.get_catalog(),
        "mcpSchema": CatalogEngine.get_mcp_tool_schema()
    }

@app.post("/api/catalog/query")
def query_catalog(query_params: dict):
    results = CatalogEngine.query_catalog(query_params)
    return {"count": len(results), "results": results}

@app.post("/api/process-intent")
async def process_intent(raw_buyer_request: dict):
    result = await OrchestratorAgent.process_transaction(raw_buyer_request)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result)
    return result


@app.post("/api/catalog/agentify")
def agentify_product(body: dict):
    """
    Layer 2 LLM-Harnessed Catalog Agentification.
    Takes raw merchant product text and extracts structured fields via the 4-stage harness.
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
    return result


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

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
