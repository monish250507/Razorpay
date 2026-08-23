import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class CartItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int

class Mandate(BaseModel):
    maxAmount: float
    expiresAt: str
    signature: str
    purpose: str

class CanonicalIntentObject(BaseModel):
    intentId: str
    protocolOrigin: str
    buyerAgentId: str
    buyerAgentName: str
    merchantId: str
    cartItems: List[CartItem]
    totalAmount: float
    currency: str = "INR"
    mandate: Mandate
    rawPayload: Dict[str, Any]
    timestamp: str

class ProtocolAdapter:
    @staticmethod
    def normalize(raw_input: dict) -> CanonicalIntentObject:
        protocol = raw_input.get("protocol", "AP2")
        timestamp = datetime.utcnow().isoformat() + "Z"
        intent_id = f"intent_{int(datetime.utcnow().timestamp()*1000)}_{uuid.uuid4().hex[:5]}"
        
        buyer_agent_id = raw_input.get("buyer_agent_id") or raw_input.get("agent_id") or "agent_nova_v2"
        buyer_agent_name = raw_input.get("buyer_agent_name", "Nova AI Assistant")
        merchant_id = raw_input.get("merchant_id", "merchant_meera_candles")
        
        cart_items = []
        total_amount = 0.0
        mandate_obj = None

        if protocol.upper() == "AP2":
            items = raw_input.get("items", [])
            for i in items:
                price = float(i.get("unit_price") or i.get("price") or 550)
                qty = int(i.get("quantity", 1))
                cart_items.append(CartItem(
                    id=i.get("sku") or i.get("id") or "prod_candle_01",
                    name=i.get("title") or i.get("name") or "Sandalwood Soy Candle",
                    price=price,
                    quantity=qty
                ))
                total_amount += price * qty
            
            mandate_data = raw_input.get("mandate", {})
            mandate_obj = Mandate(
                maxAmount=float(mandate_data.get("spend_limit") or raw_input.get("spend_limit") or 600),
                expiresAt=mandate_data.get("expires_at", (datetime.utcnow() + timedelta(minutes=10)).isoformat() + "Z"),
                signature=mandate_data.get("signature") or raw_input.get("signature") or "ap2_sig_valid_ecdsa_sample",
                purpose=mandate_data.get("purpose", "Purchase of handmade soy candle")
            )

        elif protocol.upper() == "ACP":
            line_items = raw_input.get("line_items", [])
            for i in line_items:
                price = float(i.get("amount", 550))
                qty = int(i.get("qty", 1))
                cart_items.append(CartItem(
                    id=i.get("product_id", "prod_candle_01"),
                    name=i.get("name", "Sandalwood Soy Candle"),
                    price=price,
                    quantity=qty
                ))
                total_amount += price * qty
            
            if "amount_total" in raw_input:
                total_amount = float(raw_input["amount_total"])
                
            auth = raw_input.get("authorization", {})
            mandate_obj = Mandate(
                maxAmount=float(auth.get("max_amount", 600)),
                expiresAt=auth.get("valid_until", (datetime.utcnow() + timedelta(minutes=10)).isoformat() + "Z"),
                signature=auth.get("token", "acp_tok_valid_sample"),
                purpose="ACP Direct Checkout"
            )

        elif protocol.upper() == "UCP":
            cart = raw_input.get("cart", [])
            for i in cart:
                price = float(i.get("price", 550))
                qty = int(i.get("count", 1))
                cart_items.append(CartItem(
                    id=i.get("item_id", "prod_candle_01"),
                    name=i.get("item_name", "Sandalwood Soy Candle"),
                    price=price,
                    quantity=qty
                ))
                total_amount += price * qty
                
            if "cart_total" in raw_input:
                total_amount = float(raw_input["cart_total"])
                
            user_mandate = raw_input.get("user_mandate", {})
            mandate_obj = Mandate(
                maxAmount=float(user_mandate.get("cap", 600)),
                expiresAt=user_mandate.get("expiry", (datetime.utcnow() + timedelta(minutes=10)).isoformat() + "Z"),
                signature=user_mandate.get("proof", "ucp_proof_sample"),
                purpose="UCP Standard Purchase"
            )

        elif protocol.upper() == "NPCI_UAP":
            price = float(raw_input.get("mandate_amount", 550))
            cart_items.append(CartItem(
                id=raw_input.get("product_code", "prod_candle_01"),
                name=raw_input.get("product_desc", "Sandalwood Soy Candle"),
                price=price,
                quantity=1
            ))
            total_amount = price
            mandate_obj = Mandate(
                maxAmount=float(raw_input.get("upi_mandate_limit", 600)),
                expiresAt=raw_input.get("mandate_expiry", (datetime.utcnow() + timedelta(minutes=10)).isoformat() + "Z"),
                signature=raw_input.get("npci_token", "uap_npci_signed_token"),
                purpose="NPCI UAP Delegate Mandate"
            )

        else:
            raise ValueError(f"Unsupported protocol origin: {protocol}")

        return CanonicalIntentObject(
            intentId=intent_id,
            protocolOrigin=protocol,
            buyerAgentId=buyer_agent_id,
            buyerAgentName=buyer_agent_name,
            merchantId=merchant_id,
            cartItems=cart_items,
            totalAmount=total_amount,
            currency="INR",
            mandate=mandate_obj,
            rawPayload=raw_input,
            timestamp=timestamp
        )
