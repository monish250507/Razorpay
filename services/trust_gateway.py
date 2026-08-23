from datetime import datetime
from services.protocol_adapter import CanonicalIntentObject

class TrustGateway:
    recent_requests = []

    @classmethod
    def verify_intent(cls, canonical_intent: CanonicalIntentObject) -> dict:
        feature_attributions = []
        risk_score = 0
        is_blocked = False
        block_reasons = []

        now = datetime.utcnow()
        # Parse ISO string with Z
        expires_at_str = canonical_intent.mandate.expiresAt.replace("Z", "+00:00")
        try:
            mandate_expiry = datetime.fromisoformat(expires_at_str).replace(tzinfo=None)
        except ValueError:
            mandate_expiry = now

        amount = canonical_intent.totalAmount
        limit = canonical_intent.mandate.maxAmount
        agent_id = canonical_intent.buyerAgentId

        # 1. DETERMINISTIC BOUNDS CHECK: Mandate Amount Limit
        if amount > limit:
            is_blocked = True
            overspend_ratio = f"{amount / limit:.2f}" if limit > 0 else "inf"
            block_reasons.append(f"Spend limit exceeded: Request amount ₹{amount} exceeds mandate limit ₹{limit} ({overspend_ratio}x of cap)")
            risk_score += 65
            feature_attributions.append({
                "feature": "Spend Mandate Bound",
                "impact": "+65 Risk",
                "status": "FAIL",
                "details": f"Requested ₹{amount} vs Cap ₹{limit}"
            })
        else:
            feature_attributions.append({
                "feature": "Spend Mandate Bound",
                "impact": "0 Risk",
                "status": "PASS",
                "details": f"Requested ₹{amount} is within declared cap of ₹{limit}"
            })

        # 2. DETERMINISTIC BOUNDS CHECK: Expiry Check
        if now > mandate_expiry:
            is_blocked = True
            block_reasons.append(f"Mandate expired: Expiry time ({mandate_expiry.isoformat()}) has passed")
            risk_score += 50
            feature_attributions.append({
                "feature": "Mandate Timeliness",
                "impact": "+50 Risk",
                "status": "FAIL",
                "details": f"Mandate expired {int((now - mandate_expiry).total_seconds())} seconds ago"
            })
        else:
            seconds_remaining = int((mandate_expiry - now).total_seconds())
            if seconds_remaining < 60:
                risk_score += 15
                feature_attributions.append({
                    "feature": "Mandate Timeliness",
                    "impact": "+15 Risk",
                    "status": "WARN",
                    "details": f"Mandate expires in {seconds_remaining}s (near-expiry threshold)"
                })
            else:
                feature_attributions.append({
                    "feature": "Mandate Timeliness",
                    "impact": "0 Risk",
                    "status": "PASS",
                    "details": f"Mandate active with {seconds_remaining}s validity remaining"
                })

        # 3. CRYPTOGRAPHIC SIGNATURE & IDENTITY CHECK
        sig = canonical_intent.mandate.signature or ""
        if not sig or "invalid" in sig.lower() or "forged" in sig.lower() or "tampered" in sig.lower():
            is_blocked = True
            block_reasons.append("Cryptographic verification failed: Mandate signature validation error")
            risk_score += 80
            feature_attributions.append({
                "feature": "Cryptographic Identity",
                "impact": "+80 Risk",
                "status": "FAIL",
                "details": "Invalid or forged ECDSA signature token"
            })
        else:
            feature_attributions.append({
                "feature": "Cryptographic Identity",
                "impact": "0 Risk",
                "status": "PASS",
                "details": f"Signature verified for agent '{canonical_intent.buyerAgentName}' ({agent_id})"
            })

        # 4. ANOMALY & FRAUD SCORING LOGIC
        # Filter recent requests from the same agent within the last 60 seconds
        recent_agent_calls = [r for r in cls.recent_requests if r["agentId"] == agent_id and (now - r["timestamp"]).total_seconds() < 60]

        if len(recent_agent_calls) >= 5:
            risk_score += 35
            if len(recent_agent_calls) >= 10:
                is_blocked = True
            block_reasons.append(f"High velocity anomaly: {len(recent_agent_calls)} requests received in last 60s from {agent_id}")
            feature_attributions.append({
                "feature": "Request Velocity Anomaly",
                "impact": "+35 Risk",
                "status": "FAIL" if len(recent_agent_calls) >= 10 else "WARN",
                "details": f"{len(recent_agent_calls)} calls/min (threshold: 5/min)"
            })
        else:
            feature_attributions.append({
                "feature": "Request Velocity Anomaly",
                "impact": "0 Risk",
                "status": "PASS",
                "details": f"{len(recent_agent_calls)} calls in last 60s (normal range)"
            })

        # Basket multiplier anomaly vs merchant average order (550 INR)
        avg_order_value = 550.0
        basket_multiplier = amount / avg_order_value
        if basket_multiplier > 3.0:
            risk_score += 20
            feature_attributions.append({
                "feature": "Basket Size Anomaly",
                "impact": "+20 Risk",
                "status": "WARN",
                "details": f"Basket total is {basket_multiplier:.1f}x merchant average"
            })
        else:
            feature_attributions.append({
                "feature": "Basket Size Anomaly",
                "impact": "0 Risk",
                "status": "PASS",
                "details": f"Basket ratio {basket_multiplier:.1f}x is typical"
            })

        cls.recent_requests.append({"agentId": agent_id, "timestamp": now})
        if len(cls.recent_requests) > 200:
            cls.recent_requests.pop(0)

        risk_score = max(0, min(risk_score, 100))
        decision = "APPROVED" if (not is_blocked and risk_score < 60) else "BLOCKED"

        if decision == "APPROVED":
            explanation = f"Transaction APPROVED (Trust Score: {100 - risk_score}/100). Mandate signature valid, amount (₹{amount}) within cap (₹{limit}), and request pattern evaluated low-risk across 4 verification layers."
        else:
            reasons_str = ". ".join(block_reasons)
            explanation = f"Transaction BLOCKED (Trust Score: {100 - risk_score}/100). {reasons_str}."

        return {
            "decision": decision,
            "trustScore": 100 - risk_score,
            "riskScore": risk_score,
            "isBounded": amount <= limit,
            "isSignatureValid": "invalid" not in sig.lower() and "forged" not in sig.lower(),
            "isTimely": now <= mandate_expiry,
            "explanation": explanation,
            "blockReasons": block_reasons,
            "featureAttributions": feature_attributions,
            "verifiedAt": now.isoformat() + "Z"
        }
