import random
import datetime
from services.catalog_engine import CatalogEngine
from services.audit_ledger import AuditLedger
import services.audit_ledger
from services.protocol_adapter import CanonicalIntentObject

def run_seed():
    if getattr(AuditLedger, '_is_seeded', False):
        return

    # 1. Expand Catalog
    CatalogEngine.catalog.clear()
    
    products = [
        {
            "id": "prod_seed_01",
            "name": "Handmade Sandalwood Soy Candle",
            "description": "100% natural soy wax candle scented with authentic Mysore sandalwood essential oil. Eco-friendly cotton wick, 45-hour burn time.",
            "price": 550.0,
            "currency": "INR",
            "stock": 42,
            "category": "Home Fragrance",
            "tags": ["soy candle", "sandalwood", "eco-friendly", "under 600", "handmade"],
            "return_policy": "7 days replacement for damaged items",
            "shipping_time": "2-3 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_02",
            "name": "Lavender & Vanilla Calming Candle",
            "description": "Relaxing blend of French lavender and Madagascar vanilla bean. Hand-poured in small batches.",
            "price": 499.0,
            "currency": "INR",
            "stock": 18,
            "category": "Home Fragrance",
            "tags": ["lavender", "vanilla", "calming", "relaxation", "under 500"],
            "return_policy": "7 days replacement for damaged items",
            "shipping_time": "2-3 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_03",
            "name": "Spiced Cinnamon & Orange Festive Diffuser",
            "description": "Reed diffuser set with spicy cinnamon, sweet orange, and clove essential oils. Includes 8 rattan reeds.",
            "price": 799.0,
            "currency": "INR",
            "stock": 12,
            "category": "Diffusers",
            "tags": ["cinnamon", "reed diffuser", "festive", "fragrance"],
            "return_policy": "Non-returnable unless defective",
            "shipping_time": "2-4 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_04",
            "name": "Artisan Ceramic Candle Holder",
            "description": "Minimalist hand-thrown ceramic candle holder. Fits standard pillar candles. Handmade in small batches.",
            "price": 350.0,
            "currency": "INR",
            "stock": 0, # out of stock
            "category": "Accessories",
            "tags": ["ceramic", "holder", "minimalist", "handmade"],
            "return_policy": "14 days return policy",
            "shipping_time": "3-5 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_05",
            "name": "Rosemary & Mint Focus Spray",
            "description": "Room and linen spray featuring crisp rosemary and cooling peppermint. Perfect for work-from-home setups and morning boosts.",
            "price": 299.0,
            "currency": "INR",
            "stock": 3, # low stock
            "category": "Room Sprays",
            "tags": ["rosemary", "mint", "spray", "focus"],
            "return_policy": "Non-returnable",
            "shipping_time": "2-3 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_06",
            "name": "Midnight Jasmine Deluxe Box",
            "description": "Gift box containing one large 3-wick jasmine candle, a wick trimmer, and a personalized note. Excellent for gifting.",
            "price": 1499.0,
            "currency": "INR",
            "stock": 8,
            "category": "Gift Sets",
            "tags": ["gift", "jasmine", "deluxe"],
            "return_policy": "Returnable within 7 days un-opened",
            "shipping_time": "3-4 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_07",
            "name": "Eucalyptus Shower Steamers (Set of 6)",
            "description": "Turn your shower into a spa with these potent eucalyptus and menthol steamers. Clears congestion and refreshes.",
            "price": 450.0,
            "currency": "INR",
            "stock": 25,
            "category": "Bath",
            "tags": ["eucalyptus", "shower", "steamer", "spa"],
            "return_policy": "Non-returnable",
            "shipping_time": "2-3 business days",
            "agent_ready": True,
        },
        {
            "id": "prod_seed_08",
            "name": "Travel Tin Candle - Bergamot",
            "description": "Compact 4oz bergamot and cedarwood candle in a travel-friendly tin. 20-hour burn time.",
            "price": 250.0,
            "currency": "INR",
            "stock": 15,
            "category": "Home Fragrance",
            "tags": ["bergamot", "travel", "tin"],
            "return_policy": "7 days replacement",
            "shipping_time": "2-4 business days",
            "agent_ready": True,
        }
    ]
    CatalogEngine.catalog.extend(products)

    # 2. Seed Transactions
    AuditLedger.ledger.clear()
    AuditLedger.llm_call_log.clear()
    
    agents = ["Nova", "Clara", "Agent-X", "Scribe", "BargainBot", "ShopAssist"]
    protocols = ["AP2", "ACP", "UCP"]

    now = datetime.datetime.utcnow()
    transactions = []
    
    # Generate random past timestamps
    for _ in range(35):
        days_ago = random.uniform(0.1, 14.0)
        txn_time = now - datetime.timedelta(days=days_ago)
        transactions.append(txn_time)
        
    transactions.sort()
    
    class MockDatetime:
        current_mock_time = now
        
        @classmethod
        def utcnow(cls):
            return cls.current_mock_time
            
    # Mock datetime to generate historical timestamps in ledger
    original_datetime = services.audit_ledger.datetime
    services.audit_ledger.datetime = MockDatetime
    
    try:
        for idx, txn_time in enumerate(transactions):
            MockDatetime.current_mock_time = txn_time
            
            agent = random.choice(agents)
            protocol = random.choice(protocols)
            
            # 85% approved, 15% rejected
            if random.random() < 0.85:
                decision = "APPROVED"
                trust_score = random.randint(85, 99)
            else:
                decision = "REJECTED"
                trust_score = random.randint(30, 75)
                
            intent_id = f"intent_seed_{idx:03d}"
            amount = random.choice([299.0, 550.0, 499.0, 799.0, 1499.0, 1049.0])
            
            intent = CanonicalIntentObject(
                intentId=intent_id,
                protocolOrigin=protocol,
                buyerAgentName=agent,
                buyerAgentId=f"{agent.lower()}_id_01",
                merchantId="meera_candles_hq",
                currency="INR",
                totalAmount=amount,
                mandate={
                    "maxAmount": 2000.0,
                    "expiresAt": "2026-12-31T23:59:59Z",
                    "signature": "mock_signature_for_seed",
                    "purpose": "Seeded synthetic data checkout"
                },
                cartItems=[],
                shippingAddress=None,
                rawPayload={},
                timestamp=txn_time.isoformat() + "Z"
            )
            
            verification = {
                "decision": decision,
                "trustScore": trust_score,
                "riskScore": 100 - trust_score,
                "explanation": "Seeded synthetic data check.",
                "featureAttributions": []
            }
            
            execution = None
            order_id = None
            if decision == "APPROVED":
                order_id = f"order_seed_{idx:03d}"
                execution = {
                    "status": "SUCCESS",
                    "orderId": order_id,
                    "paymentShortUrl": f"https://rzp.io/i/seed{idx}",
                    "amount": amount,
                    "currency": "INR",
                    "executionType": "LIVE_RAZORPAY_API",
                    "keyId": "rzp_test_demo1234"
                }
                
            # Log intent evaluation
            AuditLedger.append_entry(intent, verification, execution)
            
            # Log webhook capture for approved payments
            if decision == "APPROVED":
                # Advance time slightly for the webhook event
                MockDatetime.current_mock_time = txn_time + datetime.timedelta(seconds=random.randint(2, 8))
                
                payload = {
                    "payload": {
                        "payment": {
                            "entity": {
                                "id": f"pay_seed_{idx:03d}",
                                "order_id": order_id
                            }
                        }
                    }
                }
                AuditLedger.append_webhook_event(
                    event_type="payment.captured",
                    payload=payload,
                    signature_valid=True
                )
                
    finally:
        # Restore normal datetime
        services.audit_ledger.datetime = original_datetime
        AuditLedger._is_seeded = True
