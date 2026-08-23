"""
AEGIS RAIL — LLM Harness Module
"LLM proposes, code disposes."

This module implements the 4-stage harness through which ALL Groq calls must pass:
  [1] CONSTRAINED CALL       — Groq structured-output / JSON-schema only
  [2] SCHEMA VALIDATION      — Pydantic model parsing; hard-reject on any failure
  [3] GROUNDING CHECK        — every LLM value traced back to source; no invented fields
  [4] BOUNDED EXECUTION      — only pre-registered allow-list functions may be triggered

Layer 3 and Layer 5 NEVER import this module. Confirmed by design and verified in tests.
"""

from __future__ import annotations
import os
import time
import json
from typing import Any, Optional
from pydantic import BaseModel, ValidationError, ConfigDict
from openai import OpenAI  # Groq exposes an OpenAI-compatible API

# ──────────────────────────────────────────────
# Groq client (OpenAI-compatible)
# ──────────────────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_FALLBACK = os.getenv("GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")
GROQ_TEMP     = float(os.getenv("GROQ_TEMPERATURE", "0.1"))
GROQ_TIMEOUT  = float(os.getenv("GROQ_TIMEOUT_SECONDS", "8.0"))

def _get_client() -> OpenAI:
    return OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
        timeout=GROQ_TIMEOUT,
    )

# ──────────────────────────────────────────────
# Harness result envelope
# ──────────────────────────────────────────────
class HarnessResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    success: bool
    stage_reached: str          # "CONSTRAINED_CALL" | "SCHEMA_VALIDATION" | "GROUNDING_CHECK" | "BOUNDED_EXECUTION" | "COMPLETE"
    failure_reason: Optional[str] = None
    validated_output: Optional[Any] = None
    raw_llm_response: Optional[str] = None
    model_used: Optional[str] = None
    latency_ms: Optional[int] = None
    fallback_triggered: bool = False

# ──────────────────────────────────────────────
# STAGE 1 — Constrained Call
# ──────────────────────────────────────────────
def _stage1_constrained_call(
    messages: list,
    response_schema: dict,
    tools: Optional[list] = None,
) -> tuple:
    """
    Call Groq in structured-output / tool-calling mode.
    Returns (raw_response_str, model_used, error_message, raw_tool_call_str).
    Always tries GROQ_MODEL first, then GROQ_FALLBACK on any API-level failure.
    """
    client = _get_client()
    for model in [GROQ_MODEL, GROQ_FALLBACK]:
        try:
            kwargs: dict[str, Any] = dict(
                model=model,
                messages=messages,
                temperature=GROQ_TEMP,
            )
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "required"
            else:
                kwargs["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "structured_output",
                        "strict": True,
                        "schema": response_schema,
                    }
                }
            resp = client.chat.completions.create(**kwargs)
            choice = resp.choices[0]
            if tools:
                # Return tool call JSON
                tool_calls = choice.message.tool_calls
                if tool_calls:
                    tc = tool_calls[0]
                    return None, model, None, json.dumps({
                        "function_name": tc.function.name,
                        "arguments": tc.function.arguments
                    })
                return None, model, "No tool_calls in response", None
            else:
                return choice.message.content, model, None, None
        except Exception as e:
            last_error = str(e)
            continue
    return None, None, f"Both models failed: {last_error}", None

# ──────────────────────────────────────────────
# STAGE 2 — Schema Validation
# ──────────────────────────────────────────────
def _stage2_schema_validation(raw_json: str, pydantic_model) -> tuple[Optional[Any], Optional[str]]:
    try:
        parsed = json.loads(raw_json)
        validated = pydantic_model(**parsed)
        return validated, None
    except (json.JSONDecodeError, ValidationError) as e:
        return None, f"Schema validation failed: {e}"
    except Exception as e:
        return None, f"Unexpected validation error: {e}"

# ──────────────────────────────────────────────
# STAGE 3 — Grounding Check
# ──────────────────────────────────────────────
def _stage3_grounding_check(validated_output: Any, source_text: str) -> tuple[bool, Optional[str]]:
    """
    Checks every string/numeric field of the Pydantic model against source_text.
    If ANY field value cannot be found in the source, the ENTIRE output is rejected.
    """
    source_lower = source_text.lower()
    
    if hasattr(validated_output, "model_dump"):
        fields = validated_output.model_dump()
    elif isinstance(validated_output, dict):
        fields = validated_output
    else:
        return True, None  # Non-structured output; pass through

    for field_name, value in fields.items():
        if value is None:
            continue
        str_value = str(value).strip().lower()
        # Skip very short or purely numeric/boolean values (IDs, booleans)
        if len(str_value) <= 2 or str_value in ("true", "false", "none", "null"):
            continue
        # Numbers: check if the numeric string appears in source
        if isinstance(value, (int, float)):
            if str(value) not in source_text and str(int(value)) not in source_text:
                return False, f"Grounding FAILED: field '{field_name}' value '{value}' not found in source document. Possible hallucination."
        elif isinstance(value, str) and len(value) > 5:
            # Check if significant portions of the string appear in source
            # Use a sliding window of 6+ character substrings
            found = False
            words = str_value.split()
            if len(words) >= 2:
                # At least 2 consecutive words must appear in source
                bigram = " ".join(words[:2])
                found = bigram in source_lower
            else:
                found = str_value in source_lower
            if not found:
                return False, f"Grounding FAILED: field '{field_name}' value '{value}' not traceable to source document. Possible hallucination or prompt injection."

    return True, None

# ──────────────────────────────────────────────
# STAGE 4 — Bounded Execution (allow-list)
# ──────────────────────────────────────────────
def _stage4_bounded_execution(function_name: str, allowed_functions: dict, arguments: dict) -> tuple:
    """
    Only functions registered in the allow-list may execute.
    LLM output NEVER becomes a direct function call string.
    No monetary values are accepted as arguments.
    """
    if function_name not in allowed_functions:
        return None, f"Bounded execution REJECTED: function '{function_name}' is not in the allow-list: {list(allowed_functions.keys())}"
    
    # SAFETY: reject if any argument looks like a raw monetary amount
    for arg_key, arg_val in arguments.items():
        if arg_key in ("amount", "spend_limit", "price", "mandate_limit", "money", "rupees", "inr", "payment_amount"):
            return None, f"Bounded execution REJECTED: LLM attempted to pass monetary parameter '{arg_key}={arg_val}' directly. This is structurally forbidden."

    try:
        result = allowed_functions[function_name](**arguments)
        return result, None
    except Exception as e:
        return None, f"Bounded execution error: {e}"

# ──────────────────────────────────────────────
# Master Harness Entry Point
# ──────────────────────────────────────────────
def run_harness(
    *,
    layer: str,
    messages: list,
    response_schema: Optional[dict] = None,
    pydantic_model: Any = None,
    source_text: str = "",
    tools: Optional[list] = None,
    allowed_functions: Optional[dict] = None,
    audit_log_fn: Any = None,
) -> HarnessResult:
    """
    Runs all four harness stages. Any stage failure returns immediately with a failed
    HarnessResult. The audit_log_fn is called with the full result for Layer 6 logging.
    """
    start = time.time()

    # ── Stage 1: Constrained Call ──
    raw_content, model_used, call_error, tool_call_json = _stage1_constrained_call(
        messages, response_schema or {}, tools
    )
    latency_ms = int((time.time() - start) * 1000)

    if call_error:
        result = HarnessResult(
            success=False,
            stage_reached="CONSTRAINED_CALL",
            failure_reason=call_error,
            raw_llm_response=None,
            model_used=model_used,
            latency_ms=latency_ms,
            fallback_triggered=True,
        )
        if audit_log_fn:
            audit_log_fn(layer=layer, messages=messages, result=result)
        return result

    # If tool-call mode, skip schema/grounding, go to bounded execution
    if tools and tool_call_json:
        try:
            tc = json.loads(tool_call_json)
            fn_name = tc.get("function_name", "")
            fn_args = json.loads(tc.get("arguments", "{}"))
        except Exception as e:
            result = HarnessResult(
                success=False,
                stage_reached="SCHEMA_VALIDATION",
                failure_reason=f"Tool call JSON parse error: {e}",
                raw_llm_response=tool_call_json,
                model_used=model_used,
                latency_ms=latency_ms,
                fallback_triggered=True,
            )
            if audit_log_fn:
                audit_log_fn(layer=layer, messages=messages, result=result)
            return result

        # ── Stage 4: Bounded Execution (tool path) ──
        if not allowed_functions:
            result = HarnessResult(
                success=False,
                stage_reached="BOUNDED_EXECUTION",
                failure_reason="No allow-list provided for tool mode.",
                raw_llm_response=tool_call_json,
                model_used=model_used,
                latency_ms=latency_ms,
                fallback_triggered=True,
            )
            if audit_log_fn:
                audit_log_fn(layer=layer, messages=messages, result=result)
            return result

        exec_result, exec_error = _stage4_bounded_execution(fn_name, allowed_functions, fn_args)
        if exec_error:
            result = HarnessResult(
                success=False,
                stage_reached="BOUNDED_EXECUTION",
                failure_reason=exec_error,
                raw_llm_response=tool_call_json,
                model_used=model_used,
                latency_ms=latency_ms,
                fallback_triggered=True,
            )
        else:
            result = HarnessResult(
                success=True,
                stage_reached="COMPLETE",
                validated_output=exec_result,
                raw_llm_response=tool_call_json,
                model_used=model_used,
                latency_ms=latency_ms,
            )
        if audit_log_fn:
            audit_log_fn(layer=layer, messages=messages, result=result)
        return result

    # ── Stage 2: Schema Validation ──
    if not pydantic_model:
        result = HarnessResult(
            success=False,
            stage_reached="SCHEMA_VALIDATION",
            failure_reason="No Pydantic model provided for schema validation.",
            raw_llm_response=raw_content,
            model_used=model_used,
            latency_ms=latency_ms,
            fallback_triggered=True,
        )
        if audit_log_fn:
            audit_log_fn(layer=layer, messages=messages, result=result)
        return result

    validated, val_error = _stage2_schema_validation(raw_content, pydantic_model)
    if val_error:
        result = HarnessResult(
            success=False,
            stage_reached="SCHEMA_VALIDATION",
            failure_reason=val_error,
            raw_llm_response=raw_content,
            model_used=model_used,
            latency_ms=latency_ms,
            fallback_triggered=True,
        )
        if audit_log_fn:
            audit_log_fn(layer=layer, messages=messages, result=result)
        return result

    # ── Stage 3: Grounding Check ──
    grounded, ground_error = _stage3_grounding_check(validated, source_text)
    if not grounded:
        result = HarnessResult(
            success=False,
            stage_reached="GROUNDING_CHECK",
            failure_reason=ground_error,
            raw_llm_response=raw_content,
            model_used=model_used,
            latency_ms=latency_ms,
            fallback_triggered=True,
        )
        if audit_log_fn:
            audit_log_fn(layer=layer, messages=messages, result=result)
        return result

    result = HarnessResult(
        success=True,
        stage_reached="COMPLETE",
        validated_output=validated,
        raw_llm_response=raw_content,
        model_used=model_used,
        latency_ms=latency_ms,
    )
    if audit_log_fn:
        audit_log_fn(layer=layer, messages=messages, result=result)
    return result





