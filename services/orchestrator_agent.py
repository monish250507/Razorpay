"""
LAYER 4 — Orchestrator Agent (LLM-Harnessed)

The LLM selects from a CLOSED, FIXED tool list using Groq tool-calling mode.
HARD RULES:
  - Layer 3 verification ALWAYS runs before Layer 5 execution. Hard-coded. Not LLM-decided.
  - No tool exists that can skip verification or re-approve a blocked transaction.
  - The LLM may NEVER pass a raw monetary amount as a tool argument.
  - Groq timeout → immediate fallback to fallback_to_payment_link, logged.
  - Tool call outside allow-list → immediate fallback, logged.
"""

import time
from datetime import datetime
from typing import AsyncGenerator
from services.protocol_adapter import ProtocolAdapter, CanonicalIntentObject
from services.catalog_engine import CatalogEngine
from services.trust_gateway import TrustGateway
from services.razorpay_execution import RazorpayExecution
from services.audit_ledger import AuditLedger
from services.llm_harness import run_harness

# ──────────────────────────────────────────────
# CLOSED TOOL DEFINITIONS (Groq tool-calling mode)
# The LLM sees ONLY these tools. There is no "approve_transaction" or "skip_verification".
# ──────────────────────────────────────────────
_ORCHESTRATOR_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "route_to_catalog_agent",
            "description": "Route this intent to the Catalog Agent to verify product availability and pricing from Meera's catalog.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "The product ID from the catalog to verify."},
                    "intent_id":  {"type": "string", "description": "The unique intent ID for traceability."},
                },
                "required": ["product_id", "intent_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "route_to_payment_execution_agent",
            "description": "Route a TRUST-VERIFIED intent to the Razorpay payment execution layer. Only call this after trust verification is confirmed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "intent_id":  {"type": "string", "description": "The unique intent ID to execute payment for."},
                    "merchant_id": {"type": "string", "description": "The merchant ID."},
                },
                "required": ["intent_id", "merchant_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fallback_to_payment_link",
            "description": "Trigger graceful fallback and generate a standard Razorpay Payment Link for human completion. Use when the agent flow cannot proceed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "intent_id": {"type": "string", "description": "The unique intent ID."},
                    "reason":    {"type": "string", "description": "Human-readable reason for fallback."},
                },
                "required": ["intent_id", "reason"],
                "additionalProperties": False,
            },
        },
    },
]

# Tool name allow-list derived from the definitions above
_ALLOWED_TOOL_NAMES = {t["function"]["name"] for t in _ORCHESTRATOR_TOOLS}


def _audit_log_llm_call(*, layer: str, messages: list, result):
    """Write every LLM call result to the Layer 6 audit ledger."""
    AuditLedger.append_llm_call(
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


# ──────────────────────────────────────────────
# Bounded Execution Allow-List
# These are the ONLY functions the LLM output may trigger.
# ──────────────────────────────────────────────
def _tool_route_to_catalog_agent(*, product_id: str, intent_id: str) -> dict:
    """Verify product availability from static catalog."""
    catalog = CatalogEngine.get_catalog()
    item = next((p for p in catalog if p["id"] == product_id), None)
    return {
        "tool": "route_to_catalog_agent",
        "product_id": product_id,
        "found": item is not None,
        "stock": item["stock"] if item else 0,
        "price": item["price"] if item else None,
    }

def _tool_route_to_payment_execution(*, intent_id: str, merchant_id: str) -> dict:
    """Signal to proceed with payment execution (returns routing token only)."""
    return {
        "tool": "route_to_payment_execution_agent",
        "intent_id": intent_id,
        "merchant_id": merchant_id,
        "action": "PROCEED_TO_EXECUTION",
    }

def _tool_fallback_to_payment_link(*, intent_id: str, reason: str) -> dict:
    """Signal graceful fallback."""
    return {
        "tool": "fallback_to_payment_link",
        "intent_id": intent_id,
        "reason": reason,
        "action": "FALLBACK",
    }

_ALLOWED_FUNCTIONS = {
    "route_to_catalog_agent":           lambda **kw: _tool_route_to_catalog_agent(**kw),
    "route_to_payment_execution_agent": lambda **kw: _tool_route_to_payment_execution(**kw),
    "fallback_to_payment_link":         lambda **kw: _tool_fallback_to_payment_link(**kw),
}


class OrchestratorAgent:
    @classmethod
    async def process_transaction(cls, raw_buyer_request: dict, force_llm_failure: bool = False) -> dict:
        start_time = time.time()

        try:
            # ── LAYER 1: Protocol Translation (deterministic, no LLM) ──
            canonical_intent: CanonicalIntentObject = ProtocolAdapter.normalize(raw_buyer_request)

            # ── LAYER 2: Catalog Validation (deterministic lookup) ──
            available_catalog = CatalogEngine.get_catalog()
            validated_cart = []
            for cart_item in canonical_intent.cartItems:
                catalog_item = next(
                    (c for c in available_catalog
                     if c["id"] == cart_item.id or cart_item.name.lower() in c["name"].lower()),
                    None,
                )
                if catalog_item:
                    cart_item.price = catalog_item["price"]
                validated_cart.append(cart_item)
            canonical_intent.cartItems = validated_cart

            # ── LAYER 3: Trust & Mandate Verification (ALWAYS before Layer 5, HARD-CODED) ──
            verification_result = TrustGateway.verify_intent(canonical_intent)

            execution_result    = None
            fallback_triggered  = False
            fallback_link       = None
            llm_routing_result  = None

            if verification_result["decision"] == "APPROVED":
                # ── LAYER 4: LLM-Harnessed Routing Decision ──
                # Build a context summary WITHOUT any raw monetary values for the LLM
                # (amounts come from the already-verified canonical_intent in execution, not from LLM)
                llm_context = (
                    f"Incoming verified purchase intent (ID: {canonical_intent.intentId}) "
                    f"from buyer agent '{canonical_intent.buyerAgentName}' "
                    f"for merchant '{canonical_intent.merchantId}'. "
                    f"Cart contains {len(canonical_intent.cartItems)} item(s). "
                    f"Trust score: {verification_result['trustScore']}/100 (APPROVED). "
                    f"Protocol: {canonical_intent.protocolOrigin}. "
                    "Decide the routing action. Do NOT invent monetary values."
                )

                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are AEGIS RAIL's orchestrator agent. "
                            "Your sole job is to select the appropriate routing tool from the provided list. "
                            "You may NOT pass monetary amounts, spend limits, or mandate values as tool arguments — "
                            "those are handled by the system, not by you. "
                            "You may NOT approve a previously blocked transaction. "
                            "When in doubt, use fallback_to_payment_link."
                        ),
                    },
                    {"role": "user", "content": llm_context},
                ]

                harness_result = run_harness(
                    layer="Layer4_Orchestrator",
                    messages=messages,
                    tools=_ORCHESTRATOR_TOOLS,
                    allowed_functions=_ALLOWED_FUNCTIONS,
                    audit_log_fn=_audit_log_llm_call,
                    force_failure=force_llm_failure,
                )
                llm_routing_result = harness_result

                if harness_result.success and isinstance(harness_result.validated_output, dict):
                    action = harness_result.validated_output.get("action", "")
                    if action == "PROCEED_TO_EXECUTION":
                        try:
                            execution_result = RazorpayExecution.execute_payment(
                                canonical_intent, verification_result
                            )
                        except Exception as exec_err:
                            fallback_triggered = True
                            execution_result = RazorpayExecution.generate_fallback_execution(
                                canonical_intent, f"Execution error: {exec_err}"
                            )
                            fallback_link = execution_result.get("paymentShortUrl")
                    else:
                        # LLM chose fallback or catalog check — still generate payment link
                        fallback_triggered = True
                        execution_result = RazorpayExecution.generate_fallback_execution(
                            canonical_intent,
                            harness_result.validated_output.get("reason", "LLM routed to fallback"),
                        )
                        fallback_link = execution_result.get("paymentShortUrl")
                else:
                    # Harness rejected LLM output → deterministic fallback
                    fallback_triggered = True
                    execution_result = RazorpayExecution.generate_fallback_execution(
                        canonical_intent,
                        f"LLM harness fallback: {harness_result.failure_reason}",
                    )
                    fallback_link = execution_result.get("paymentShortUrl")
            else:
                # BLOCKED by Layer 3 — never reaches Layer 5
                fallback_triggered = True
                fallback_link = f"https://rzp.io/i/fallback_{canonical_intent.intentId[7:]}"

            # ── LAYER 6: Audit Ledger ──
            ledger_block = AuditLedger.append_entry(canonical_intent, verification_result, execution_result)
            processing_time_ms = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "intentId":        canonical_intent.intentId,
                "protocol":        canonical_intent.protocolOrigin,
                "buyerAgent":      canonical_intent.buyerAgentName,
                "merchantId":      canonical_intent.merchantId,
                "canonicalIntent": canonical_intent.model_dump(),
                "verification":    verification_result,
                "execution":       execution_result,
                "llmRouting": {
                    "used":            llm_routing_result is not None,
                    "success":         llm_routing_result.success if llm_routing_result else None,
                    "stageReached":    llm_routing_result.stage_reached if llm_routing_result else None,
                    "modelUsed":       llm_routing_result.model_used if llm_routing_result else None,
                    "latencyMs":       llm_routing_result.latency_ms if llm_routing_result else None,
                    "fallbackTriggered": llm_routing_result.fallback_triggered if llm_routing_result else None,
                },
                "fallback": {
                    "triggered":          fallback_triggered,
                    "fallbackPaymentLink": fallback_link,
                    "message": "Graceful Fallback Active." if fallback_triggered else "Direct Agentic Execution Complete.",
                },
                "ledgerBlock": {
                    "index":        ledger_block["index"],
                    "hash":         ledger_block["hash"],
                    "previousHash": ledger_block["previousHash"],
                },
                "processingTimeMs": processing_time_ms,
            }

        except Exception as err:
            return {
                "success":   False,
                "error":     str(err),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }

    @classmethod
    async def stream_transaction(
        cls,
        raw_buyer_request: dict,
        force_llm_failure: bool = False,
    ) -> AsyncGenerator[dict, None]:
        """
        Async generator that yields per-layer SSE event dicts as each pipeline
        layer completes. The caller (FastAPI StreamingResponse) serialises these
        to SSE format.

        Event shape:
          { "layerId": int, "layerName": str, "status": str, "data": dict }

        status values:
          "started"   — layer is executing right now
          "completed" — layer finished successfully
          "blocked"   — Layer 3 blocked the transaction
          "skipped"   — layer was skipped because a prior layer blocked
        """
        start_time = time.time()

        try:
            # ── LAYER 1: Protocol Translation ──
            yield {
                "layerId": 1, "layerName": "Protocol Translation",
                "status": "started", "data": {}
            }
            canonical_intent: CanonicalIntentObject = ProtocolAdapter.normalize(raw_buyer_request)
            yield {
                "layerId": 1, "layerName": "Protocol Translation",
                "status": "completed",
                "data": {
                    "protocol": canonical_intent.protocolOrigin,
                    "intentId": canonical_intent.intentId,
                    "buyerAgent": canonical_intent.buyerAgentName,
                    "itemCount": len(canonical_intent.cartItems),
                }
            }

            # ── LAYER 2: Catalog Validation ──
            yield {
                "layerId": 2, "layerName": "Catalog Agentification",
                "status": "started", "data": {}
            }
            available_catalog = CatalogEngine.get_catalog()
            validated_cart = []
            catalog_hits = 0
            for cart_item in canonical_intent.cartItems:
                catalog_item = next(
                    (c for c in available_catalog
                     if c["id"] == cart_item.id or cart_item.name.lower() in c["name"].lower()),
                    None,
                )
                if catalog_item:
                    cart_item.price = catalog_item["price"]
                    catalog_hits += 1
                validated_cart.append(cart_item)
            canonical_intent.cartItems = validated_cart
            yield {
                "layerId": 2, "layerName": "Catalog Agentification",
                "status": "completed",
                "data": {
                    "itemsChecked": len(validated_cart),
                    "catalogHits": catalog_hits,
                    "totalAmount": canonical_intent.totalAmount,
                }
            }

            # ── LAYER 3: Trust & Mandate Gateway ──
            yield {
                "layerId": 3, "layerName": "Trust & Mandate Gateway",
                "status": "started", "data": {}
            }
            verification_result = TrustGateway.verify_intent(canonical_intent)
            is_blocked = verification_result["decision"] != "APPROVED"
            yield {
                "layerId": 3, "layerName": "Trust & Mandate Gateway",
                "status": "blocked" if is_blocked else "completed",
                "data": {
                    "decision": verification_result["decision"],
                    "trustScore": verification_result["trustScore"],
                    "riskScore": verification_result["riskScore"],
                    "blockReasons": verification_result.get("blockReasons", []),
                    "featureAttributions": verification_result.get("featureAttributions", []),
                    "explanation": verification_result.get("explanation", ""),
                }
            }

            execution_result   = None
            fallback_triggered = False
            fallback_link      = None
            llm_routing_result = None

            if is_blocked:
                # Layers 4 and 5 are skipped — transaction was blocked
                fallback_triggered = True
                fallback_link = f"https://rzp.io/i/fallback_{canonical_intent.intentId[7:]}"

                yield {
                    "layerId": 4, "layerName": "Orchestrator Agent",
                    "status": "skipped",
                    "data": {"reason": "Skipped — transaction blocked by Layer 3"}
                }
                yield {
                    "layerId": 5, "layerName": "Razorpay Execution",
                    "status": "skipped",
                    "data": {"reason": "Skipped — transaction blocked by Layer 3"}
                }
            else:
                # ── LAYER 4: LLM-Harnessed Routing ──
                yield {
                    "layerId": 4, "layerName": "Orchestrator Agent",
                    "status": "started", "data": {}
                }

                llm_context = (
                    f"Incoming verified purchase intent (ID: {canonical_intent.intentId}) "
                    f"from buyer agent '{canonical_intent.buyerAgentName}' "
                    f"for merchant '{canonical_intent.merchantId}'. "
                    f"Cart contains {len(canonical_intent.cartItems)} item(s). "
                    f"Trust score: {verification_result['trustScore']}/100 (APPROVED). "
                    f"Protocol: {canonical_intent.protocolOrigin}. "
                    "Decide the routing action. Do NOT invent monetary values."
                )
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are AEGIS RAIL's orchestrator agent. "
                            "Your sole job is to select the appropriate routing tool from the provided list. "
                            "You may NOT pass monetary amounts, spend limits, or mandate values as tool arguments — "
                            "those are handled by the system, not by you. "
                            "You may NOT approve a previously blocked transaction. "
                            "When in doubt, use fallback_to_payment_link."
                        ),
                    },
                    {"role": "user", "content": llm_context},
                ]

                harness_result = run_harness(
                    layer="Layer4_Orchestrator",
                    messages=messages,
                    tools=_ORCHESTRATOR_TOOLS,
                    allowed_functions=_ALLOWED_FUNCTIONS,
                    audit_log_fn=_audit_log_llm_call,
                    force_failure=force_llm_failure,
                )
                llm_routing_result = harness_result

                action = ""
                if harness_result.success and isinstance(harness_result.validated_output, dict):
                    action = harness_result.validated_output.get("action", "")
                    fallback_triggered = action != "PROCEED_TO_EXECUTION"
                else:
                    fallback_triggered = True

                yield {
                    "layerId": 4, "layerName": "Orchestrator Agent",
                    "status": "completed",
                    "data": {
                        "routingAction": action or "FALLBACK",
                        "fallbackTriggered": fallback_triggered,
                        "modelUsed": harness_result.model_used,
                        "latencyMs": harness_result.latency_ms,
                        "stageReached": harness_result.stage_reached,
                        "harnessSuccess": harness_result.success,
                        "failureReason": harness_result.failure_reason,
                    }
                }

                # ── LAYER 5: Razorpay Execution ──
                yield {
                    "layerId": 5, "layerName": "Razorpay Execution",
                    "status": "started", "data": {}
                }

                if not fallback_triggered and action == "PROCEED_TO_EXECUTION":
                    try:
                        execution_result = RazorpayExecution.execute_payment(
                            canonical_intent, verification_result
                        )
                    except Exception as exec_err:
                        fallback_triggered = True
                        execution_result = RazorpayExecution.generate_fallback_execution(
                            canonical_intent, f"Execution error: {exec_err}"
                        )
                        fallback_link = execution_result.get("paymentShortUrl")
                else:
                    reason = (
                        harness_result.failure_reason or
                        (harness_result.validated_output.get("reason", "LLM routed to fallback")
                         if harness_result.success and isinstance(harness_result.validated_output, dict)
                         else f"LLM harness fallback: {harness_result.failure_reason}")
                    )
                    execution_result = RazorpayExecution.generate_fallback_execution(
                        canonical_intent, reason
                    )
                    fallback_link = execution_result.get("paymentShortUrl")

                yield {
                    "layerId": 5, "layerName": "Razorpay Execution",
                    "status": "completed",
                    "data": {
                        "orderId": execution_result.get("orderId"),
                        "paymentLinkId": execution_result.get("paymentLinkId"),
                        "paymentShortUrl": execution_result.get("paymentShortUrl"),
                        "executionType": execution_result.get("executionType"),
                        "amount": execution_result.get("amount"),
                    }
                }

            # ── LAYER 6: Audit Ledger ──
            yield {
                "layerId": 6, "layerName": "Audit & Explainability Ledger",
                "status": "started", "data": {}
            }
            ledger_block = AuditLedger.append_entry(canonical_intent, verification_result, execution_result)
            processing_time_ms = int((time.time() - start_time) * 1000)
            yield {
                "layerId": 6, "layerName": "Audit & Explainability Ledger",
                "status": "completed",
                "data": {
                    "index": ledger_block["index"],
                    "hash": ledger_block["hash"],
                    "previousHash": ledger_block["previousHash"],
                    "entryId": ledger_block["entryId"],
                }
            }

            # ── Final result event ──
            final_result = {
                "success": True,
                "intentId":        canonical_intent.intentId,
                "protocol":        canonical_intent.protocolOrigin,
                "buyerAgent":      canonical_intent.buyerAgentName,
                "merchantId":      canonical_intent.merchantId,
                "canonicalIntent": canonical_intent.model_dump(),
                "verification":    verification_result,
                "execution":       execution_result,
                "llmRouting": {
                    "used":            llm_routing_result is not None,
                    "success":         llm_routing_result.success if llm_routing_result else None,
                    "stageReached":    llm_routing_result.stage_reached if llm_routing_result else None,
                    "modelUsed":       llm_routing_result.model_used if llm_routing_result else None,
                    "latencyMs":       llm_routing_result.latency_ms if llm_routing_result else None,
                    "fallbackTriggered": llm_routing_result.fallback_triggered if llm_routing_result else None,
                },
                "fallback": {
                    "triggered":          fallback_triggered,
                    "fallbackPaymentLink": fallback_link,
                    "message": "Graceful Fallback Active." if fallback_triggered else "Direct Agentic Execution Complete.",
                },
                "ledgerBlock": {
                    "index":        ledger_block["index"],
                    "hash":         ledger_block["hash"],
                    "previousHash": ledger_block["previousHash"],
                },
                "processingTimeMs": processing_time_ms,
            }
            yield {"event": "done", "data": final_result}

        except Exception as err:
            yield {
                "event": "error",
                "data": {
                    "success":   False,
                    "error":     str(err),
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
            }
