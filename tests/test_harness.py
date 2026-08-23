"""
AEGIS RAIL — Full Adversarial Test Suite
Section 7 of the LLM Harness Plan — ALL 6 tests must pass before any live demo.

Run with: python -m pytest tests/test_harness.py -v
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from services.llm_harness import (
    run_harness,
    _stage2_schema_validation,
    _stage3_grounding_check,
    _stage4_bounded_execution,
)
from services.catalog_engine import CatalogEngine, LLMCatalogEntry, _manual_review_flags, _extraction_failure_counts
from services.audit_ledger import AuditLedger
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────
# TEST 1: Prompt-injection in merchant data → grounding rejects
# ─────────────────────────────────────────────────────────
def test_prompt_injection_grounding_check():
    """
    Adversarial: product text contains hidden prompt injection attempting to set price=1.
    The LLM 'extraction' returns price=1 (injected value).
    Grounding check must reject because '1' as a price is not grounded in the clean source.
    """
    source_text = "Sandalwood Soy Candle. Price: 550 INR. Stock: 42 units. Category: Home Fragrance. Return: 7 days. Ships: 2-3 days."

    # Simulate LLM returning a price that was NOT in the source (injection succeeded in LLM but grounding catches it)
    injected_llm_output = LLMCatalogEntry(
        name="Sandalwood Soy Candle",
        description="100% natural soy wax candle scented with authentic sandalwood",
        price=1.0,       # ← INJECTED value not in source
        currency="INR",
        stock=42,
        category="Home Fragrance",
        return_policy="7 days replacement",
        shipping_time="2-3 business days",
    )

    grounded, error = _stage3_grounding_check(injected_llm_output, source_text)
    assert not grounded, "Grounding check MUST reject a price not present in the source document"
    assert "1.0" in error or "Grounding FAILED" in error, f"Expected grounding failure, got: {error}"
    print(f"✓ TEST 1 PASSED: Prompt injection caught at grounding stage. Reason: {error}")


# ─────────────────────────────────────────────────────────
# TEST 2: Malformed/truncated Groq JSON → schema validation rejects
# ─────────────────────────────────────────────────────────
def test_malformed_groq_response_triggers_fallback():
    """
    Adversarial: Groq returns truncated / malformed JSON.
    Schema validation must hard-reject and trigger fallback.
    """
    malformed_json = '{"name": "Sandalwood Candle", "price": 550, "stock": '  # truncated!
    validated, error = _stage2_schema_validation(malformed_json, LLMCatalogEntry)
    assert validated is None, "Truncated JSON must NOT produce a validated output"
    assert error is not None, "An error must be returned for malformed JSON"
    assert "Schema validation failed" in error
    print(f"✓ TEST 2 PASSED: Malformed JSON rejected at schema validation. Error: {error[:80]}...")


# ─────────────────────────────────────────────────────────
# TEST 3: Orchestrator asked to approve a blocked transaction → structurally impossible
# ─────────────────────────────────────────────────────────
def test_no_approve_tool_exists():
    """
    Adversarial: Verify that no "approve_transaction" or "re_approve" tool exists
    in the orchestrator's allow-list. The LLM structurally cannot call what doesn't exist.
    """
    from services.orchestrator_agent import _ALLOWED_FUNCTIONS, _ALLOWED_TOOL_NAMES

    forbidden_tools = [
        "approve_transaction",
        "re_approve_blocked_transaction",
        "bypass_trust_check",
        "skip_verification",
        "override_decision",
    ]
    for tool in forbidden_tools:
        assert tool not in _ALLOWED_TOOL_NAMES, \
            f"SECURITY FAILURE: forbidden tool '{tool}' found in orchestrator allow-list!"

    # Also test bounded execution rejects unknown tools
    result, error = _stage4_bounded_execution(
        "approve_transaction",
        _ALLOWED_FUNCTIONS,
        {"intent_id": "test_123"}
    )
    assert result is None
    assert "not in the allow-list" in error
    print(f"✓ TEST 3 PASSED: No approval tools exist. Bounded execution rejected. Allow-list: {sorted(_ALLOWED_TOOL_NAMES)}")


# ─────────────────────────────────────────────────────────
# TEST 4: Groq API timeout → fallback triggered, no hang
# ─────────────────────────────────────────────────────────
def test_groq_timeout_triggers_fallback():
    """
    Adversarial: Groq call times out. Harness must return a fallback result within
    a reasonable time bound (< 30s) with fallback_triggered=True.
    """
    import time
    from openai import APITimeoutError

    logged_calls = []
    def mock_audit_log(*, layer, messages, result):
        logged_calls.append(result)

    with patch("services.llm_harness._stage1_constrained_call") as mock_call:
        mock_call.return_value = (None, None, "Both models failed: Request timeout", None)

        start = time.time()
        result = run_harness(
            layer="Layer4_Orchestrator",
            messages=[{"role": "user", "content": "test"}],
            tools=[{"type": "function", "function": {"name": "fallback_to_payment_link", "parameters": {"type":"object","properties":{},"required":[]}}}],
            allowed_functions={"fallback_to_payment_link": lambda **kw: {"action": "FALLBACK"}},
            audit_log_fn=mock_audit_log,
        )
        elapsed = time.time() - start

    assert result.fallback_triggered, "Timeout must set fallback_triggered=True"
    assert not result.success, "Timed-out call must not succeed"
    assert elapsed < 5.0, f"Harness should not hang on timeout (took {elapsed:.1f}s)"
    assert len(logged_calls) == 1, "Timed-out call must be logged to audit ledger"
    print(f"✓ TEST 4 PASSED: Groq timeout handled in {elapsed:.2f}s, fallback triggered, logged.")


# ─────────────────────────────────────────────────────────
# TEST 5: Monetary value smuggled through routing tool argument → rejected
# ─────────────────────────────────────────────────────────
def test_monetary_value_in_tool_argument_rejected():
    """
    Adversarial: LLM attempts to pass `amount=550` inside a routing tool call.
    Bounded execution must reject any tool argument with a monetary key.
    """
    allowed = {
        "route_to_payment_execution_agent": lambda **kw: {"action": "PROCEED"},
    }

    # Test various monetary argument keys
    for forbidden_key in ["amount", "spend_limit", "price", "mandate_limit", "inr"]:
        result, error = _stage4_bounded_execution(
            "route_to_payment_execution_agent",
            allowed,
            {"intent_id": "test_123", "merchant_id": "meera", forbidden_key: 550}
        )
        assert result is None, f"Monetary arg '{forbidden_key}=550' must be rejected"
        assert "monetary parameter" in error, f"Expected monetary rejection, got: {error}"
        print(f"  ✓ Monetary key '{forbidden_key}' correctly rejected")

    print("✓ TEST 5 PASSED: All monetary smuggling attempts rejected by bounded execution.")


# ─────────────────────────────────────────────────────────
# TEST 6: Repeated catalog extraction failures → needs_manual_review after 2 failures
# ─────────────────────────────────────────────────────────
def test_repeated_catalog_failures_flag_manual_review():
    """
    Adversarial: The LLM/harness fails to extract a catalog entry twice.
    After 2 failures, the item MUST be flagged `needs_manual_review` and excluded.
    A 3rd attempt returns `needs_manual_review` immediately without calling Groq again.
    """
    test_product_id = "test_prod_adversarial_99"

    # Clean state
    _extraction_failure_counts.pop(test_product_id, None)
    _manual_review_flags.discard(test_product_id)

    raw_text = "Broken Product Listing. No price no stock no policy."
    groq_call_count = [0]

    def mock_harness_fail(*args, **kwargs):
        from services.llm_harness import HarnessResult
        groq_call_count[0] += 1
        return HarnessResult(
            success=False,
            stage_reached="SCHEMA_VALIDATION",
            failure_reason="Schema validation failed: missing required fields",
            fallback_triggered=True,
        )

    with patch("services.catalog_engine.run_harness", side_effect=mock_harness_fail):
        result1 = CatalogEngine.agentify_raw_product(test_product_id, raw_text)
        assert result1["status"] == "extraction_failed"
        assert test_product_id not in _manual_review_flags, "Should NOT flag after 1st failure"

        result2 = CatalogEngine.agentify_raw_product(test_product_id, raw_text)
        assert result2["status"] == "needs_manual_review"
        assert test_product_id in _manual_review_flags, "MUST flag for manual review after 2nd failure"

        # 3rd attempt: Groq should NOT be called again
        result3 = CatalogEngine.agentify_raw_product(test_product_id, raw_text)
        assert result3["status"] == "needs_manual_review"
        assert groq_call_count[0] == 2, \
            f"Groq must NOT be called on 3rd attempt (was called {groq_call_count[0]} times)"

    # Cleanup
    _extraction_failure_counts.pop(test_product_id, None)
    _manual_review_flags.discard(test_product_id)
    print(f"✓ TEST 6 PASSED: Flagged after 2 failures, Groq not called on 3rd attempt.")


# ─────────────────────────────────────────────────────────
# SECURITY VERIFICATION: Layer 3 and Layer 5 contain zero LLM imports
# ─────────────────────────────────────────────────────────
def test_layer3_contains_no_llm_imports():
    """Structural check: trust_gateway.py must NOT import any LLM client."""
    with open("services/trust_gateway.py", "r") as f:
        content = f.read()

    forbidden = ["openai", "groq", "anthropic", "llm_harness", "langchain", "litellm"]
    for keyword in forbidden:
        assert keyword not in content, \
            f"SECURITY VIOLATION: Layer 3 trust_gateway.py imports '{keyword}' — this is FORBIDDEN."
    print(f"✓ SECURITY: Layer 3 (trust_gateway.py) contains ZERO LLM client imports. ✓")


def test_layer5_contains_no_llm_imports():
    """Structural check: razorpay_execution.py must NOT import any LLM client."""
    with open("services/razorpay_execution.py", "r") as f:
        content = f.read()

    forbidden = ["openai", "groq", "anthropic", "llm_harness", "langchain", "litellm"]
    for keyword in forbidden:
        assert keyword not in content, \
            f"SECURITY VIOLATION: Layer 5 razorpay_execution.py imports '{keyword}' — this is FORBIDDEN."
    print(f"✓ SECURITY: Layer 5 (razorpay_execution.py) contains ZERO LLM client imports. ✓")


# ─────────────────────────────────────────────────────────
# VERIFICATION: Every rejected Groq call is written to Layer 6 ledger
# ─────────────────────────────────────────────────────────
def test_rejected_llm_call_written_to_audit_ledger():
    """Every Groq call — even rejected ones — must appear in the Layer 6 audit ledger."""
    initial_count = len(AuditLedger.get_llm_call_log())

    with patch("services.llm_harness._stage1_constrained_call") as mock_call:
        mock_call.return_value = ('{"invalid_field": "xyz"}', "mock-model", None, None)

        class StrictModel(BaseModel):
            required_field: str

        result = run_harness(
            layer="TestLayer",
            messages=[{"role": "user", "content": "test"}],
            response_schema={"type": "object", "properties": {}},
            pydantic_model=StrictModel,
            source_text="some source text",
            audit_log_fn=lambda **kw: AuditLedger.append_llm_call(
                layer=kw["layer"],
                input_messages=kw["messages"],
                raw_response=kw["result"].raw_llm_response,
                stage_reached=kw["result"].stage_reached,
                success=kw["result"].success,
                failure_reason=kw["result"].failure_reason,
                model_used=kw["result"].model_used,
                latency_ms=kw["result"].latency_ms,
                fallback_triggered=kw["result"].fallback_triggered,
            ),
        )

    assert not result.success
    new_count = len(AuditLedger.get_llm_call_log())
    assert new_count > initial_count, "Rejected LLM call MUST be logged in Layer 6 audit ledger"
    last_log = AuditLedger.get_llm_call_log()[-1]
    assert last_log["success"] == False
    assert last_log["final_action"] in ("REJECTED", "FALLBACK")
    print(f"✓ VERIFICATION: Rejected LLM call logged to Layer 6 ledger. Entry: {last_log['final_action']}")
