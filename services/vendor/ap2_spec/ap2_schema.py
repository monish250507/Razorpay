from pydantic import BaseModel, Field, constr
from typing import List, Optional
from datetime import datetime

class AP2Item(BaseModel):
    id: str = Field(..., description="Unique product identifier (SKU)")
    title: str = Field(..., description="Product title")
    price: float = Field(..., description="Unit price")
    quantity: int = Field(default=1, ge=1)

class AP2Mandate(BaseModel):
    spend_limit: float = Field(..., gt=0, description="Maximum authorized spend")
    expires_at: datetime = Field(..., description="ISO8601 expiration timestamp")
    signature: str = Field(..., min_length=10, description="Cryptographic ECDSA signature from the agent")
    purpose: str = Field(..., description="Context or reason for this mandate")

class AP2Payload(BaseModel):
    protocol: str = Field("AP2", pattern="^AP2$")
    buyer_agent_id: str = Field(..., description="Global identifier of the buyer agent")
    buyer_agent_name: str = Field(..., description="Human-readable agent name")
    merchant_id: str = Field(..., description="Target merchant identifier")
    items: List[AP2Item] = Field(..., min_length=1)
    mandate: AP2Mandate
