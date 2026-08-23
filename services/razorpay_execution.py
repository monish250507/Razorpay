import os
import random
import string
from datetime import datetime
import razorpay
from services.protocol_adapter import CanonicalIntentObject

class RazorpayExecution:
    @classmethod
    def execute_payment(cls, canonical_intent: CanonicalIntentObject, verification_result: dict) -> dict:
        key_id = os.getenv("RAZORPAY_KEY_ID", "rzp_test_demo12345678")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET", "secret_test_demo12345678")

        is_real_credentials = key_id.startswith("rzp_test_") and "demo12345678" not in key_id
        amount_in_paise = int(round(canonical_intent.totalAmount * 100))
        receipt = f"rcpt_{canonical_intent.intentId}"

        if is_real_credentials:
            try:
                client = razorpay.Client(auth=(key_id, key_secret))
                
                # Create Razorpay Order
                order_data = {
                    "amount": amount_in_paise,
                    "currency": canonical_intent.currency or "INR",
                    "receipt": receipt,
                    "notes": {
                        "buyer_agent": canonical_intent.buyerAgentName,
                        "protocol": canonical_intent.protocolOrigin,
                        "trust_score": str(verification_result.get("trustScore", "")),
                        "aegis_intent_id": canonical_intent.intentId
                    }
                }
                order = client.order.create(data=order_data)

                # Create Razorpay Payment Link
                plink_data = {
                    "amount": amount_in_paise,
                    "currency": canonical_intent.currency or "INR",
                    "accept_partial": False,
                    "description": f"Order {order.get('id')} via AEGIS RAIL Agentic Checkout",
                    "customer": {
                        "name": f"{canonical_intent.buyerAgentName} (for User)",
                        "email": "nova.agent@aegisrail.io",
                        "contact": "+919999999999"
                    },
                    "notify": {"sms": False, "email": False},
                    "reminder_enable": False,
                    "notes": {
                        "order_id": order.get('id'),
                        "intent_id": canonical_intent.intentId
                    }
                }
                payment_link = client.payment_link.create(data=plink_data)

                return {
                    "status": "SUCCESS",
                    "executionType": "LIVE_RAZORPAY_API",
                    "orderId": order.get("id"),
                    "paymentLinkId": payment_link.get("id"),
                    "paymentShortUrl": payment_link.get("short_url"),
                    "amount": canonical_intent.totalAmount,
                    "currency": canonical_intent.currency,
                    "receipt": receipt,
                    "createdAt": datetime.utcnow().isoformat() + "Z"
                }
            except Exception as e:
                print(f"Razorpay Live Test API call failed, triggering Graceful Fallback Mode: {e}")
                return cls.generate_fallback_execution(canonical_intent, str(e))
        else:
            return cls.generate_fallback_execution(canonical_intent, "Simulated Razorpay Test-Mode Connection")

    @classmethod
    def generate_fallback_execution(cls, canonical_intent: CanonicalIntentObject, reason: str) -> dict:
        amount_in_paise = int(round(canonical_intent.totalAmount * 100))
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))
        mock_order_id = f"order_{random_suffix}"
        mock_plink_id = f"plink_{random_suffix}"

        return {
            "status": "SUCCESS",
            "executionType": "SIMULATED_RAZORPAY_TEST_MODE",
            "orderId": mock_order_id,
            "paymentLinkId": mock_plink_id,
            "paymentShortUrl": f"https://rzp.io/i/{mock_plink_id[6:]}",
            "amount": canonical_intent.totalAmount,
            "amountPaise": amount_in_paise,
            "currency": canonical_intent.currency or "INR",
            "receipt": f"rcpt_{canonical_intent.intentId}",
            "note": reason,
            "razorpayPayload": {
                "id": mock_order_id,
                "entity": "order",
                "amount": amount_in_paise,
                "amount_paid": 0,
                "amount_due": amount_in_paise,
                "currency": "INR",
                "receipt": f"rcpt_{canonical_intent.intentId}",
                "offer_id": None,
                "status": "created",
                "attempts": 0,
                "notes": {
                    "aegis_rail_gateway": "active",
                    "protocol": canonical_intent.protocolOrigin,
                    "buyer_agent": canonical_intent.buyerAgentName
                },
                "created_at": int(datetime.utcnow().timestamp())
            },
            "createdAt": datetime.utcnow().isoformat() + "Z"
        }
