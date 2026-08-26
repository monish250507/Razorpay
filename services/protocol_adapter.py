import uuid
import json
import os
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, ValidationError
import jsonschema
from typing import List, Optional, Dict, Any

from services.vendor.ap2_spec.ap2_schema import AP2Payload

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
    def load_json_schema(filename: str) -> dict:
        schema_path = os.path.join(os.path.dirname(__file__), "vendor", filename)
        with open(schema_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def normalize(raw_input: dict) -> CanonicalIntentObject:
        protocol = raw_input.get("protocol", "AP2")
        timestamp = datetime.utcnow().isoformat() + "Z"
        intent_id = f"intent_{int(datetime.utcnow().timestamp()*1000)}_{uuid.uuid4().hex[:5]}"
        
        cart_items = []
        total_amount = 0.0
        mandate_obj = None

        if protocol.upper() == "AP2":
            # Real validation against official AP2 Pydantic models
            try:
                ap2_data = AP2Payload.model_validate(raw_input)
            except ValidationError as e:
                raise ValueError(f"Schema validation failed against official AP2 Spec: {e}")
                
            buyer_agent_id = ap2_data.buyer_agent_id
            buyer_agent_name = ap2_data.buyer_agent_name
            merchant_id = ap2_data.merchant_id
            
            for i in ap2_data.items:
                cart_items.append(CartItem(
                    id=i.id,
                    name=i.title,
                    price=i.price,
                    quantity=i.quantity
                ))
                total_amount += i.price * i.quantity
            
            mandate_obj = Mandate(
                maxAmount=ap2_data.mandate.spend_limit,
                expiresAt=ap2_data.mandate.expires_at.isoformat() + "Z",
                signature=ap2_data.mandate.signature,
                purpose=ap2_data.mandate.purpose
            )

        elif protocol.upper() == "ACP":
            # Real validation against official ACP JSON Schema
            try:
                acp_schema = ProtocolAdapter.load_json_schema("acp_spec/acp_schema.json")
                jsonschema.validate(instance=raw_input, schema=acp_schema)
            except jsonschema.exceptions.ValidationError as e:
                raise ValueError(f"Schema validation failed against official ACP Spec: {e.message} at {e.json_path}")
                
            buyer_agent_id = raw_input.get("agent_id")
            buyer_agent_name = raw_input.get("agent_id")  # ACP schema doesn't have agent name explicitly
            merchant_id = raw_input.get("merchant_id")
            
            for i in raw_input.get("line_items", []):
                cart_items.append(CartItem(
                    id=i.get("product_id"),
                    name=i.get("name"),
                    price=i.get("amount"),
                    quantity=i.get("qty")
                ))
                total_amount += i.get("amount") * i.get("qty")
                
            auth = raw_input.get("authorization", {})
            mandate_obj = Mandate(
                maxAmount=auth.get("max_amount"),
                expiresAt=auth.get("valid_until"),
                signature=auth.get("token"),
                purpose="ACP Direct Checkout"
            )

        elif protocol.upper() == "UCP":
            # Real validation against official UCP JSON Schema
            try:
                ucp_schema = ProtocolAdapter.load_json_schema("ucp_spec/ucp_schema.json")
                jsonschema.validate(instance=raw_input, schema=ucp_schema)
            except jsonschema.exceptions.ValidationError as e:
                raise ValueError(f"Schema validation failed against official UCP Spec: {e.message} at {e.json_path}")
                
            buyer_agent_id = raw_input.get("agent").get("id")
            buyer_agent_name = raw_input.get("agent").get("name")
            merchant_id = raw_input.get("merchant").get("id")
            
            for i in raw_input.get("cart", []):
                cart_items.append(CartItem(
                    id=i.get("item_id"),
                    name=i.get("item_name"),
                    price=i.get("price"),
                    quantity=i.get("count")
                ))
                total_amount += i.get("price") * i.get("count")
                
            auth = raw_input.get("payment_auth", {})
            mandate_obj = Mandate(
                maxAmount=auth.get("limit"),
                expiresAt=auth.get("expiry"),
                signature=auth.get("signature"),
                purpose="UCP Purchase"
            )

        elif protocol.upper() == "UAP":
            # NOTE: NPCI UAP (Unified Agent Protocol) has NO PUBLIC SPECIFICATION.
            # This parsing path is a compliant-in-spirit simulation based on existing research.
            # It is NOT validated against a real schema because none exists.
            
            buyer_agent_id = raw_input.get("agent_id", "agent_nova_v2")
            buyer_agent_name = raw_input.get("agent_name", "Nova AI Assistant")
            merchant_id = raw_input.get("payee_vpa", "merchant_meera_candles")
            
            cart = raw_input.get("invoice_details", {}).get("items", [])
            for i in cart:
                price = float(i.get("unit_price", 550))
                qty = int(i.get("quantity", 1))
                cart_items.append(CartItem(
                    id=i.get("sku", "prod_candle_01"),
                    name=i.get("desc", "Sandalwood Soy Candle"),
                    price=price,
                    quantity=qty
                ))
                total_amount += price * qty
            
            if "total_amount" in raw_input.get("invoice_details", {}):
                total_amount = float(raw_input["invoice_details"]["total_amount"])
                
            mandate_data = raw_input.get("upi_mandate", {})
            mandate_obj = Mandate(
                maxAmount=float(mandate_data.get("max_amount", 600)),
                expiresAt=mandate_data.get("validity_end", (datetime.utcnow() + timedelta(minutes=10)).isoformat() + "Z"),
                signature=mandate_data.get("device_signature", "uap_sig_sample"),
                purpose=mandate_data.get("purpose_code", "UAP Intent")
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
