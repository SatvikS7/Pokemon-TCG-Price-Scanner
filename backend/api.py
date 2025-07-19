# api.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from utils.price_cache import get_card_price
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "https://your-production-url.com"],  # or ["*"] for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CardRequest(BaseModel):
    name: str
    set_id: str

@app.post("/price/batch")
def get_prices(cards: List[CardRequest]):
    results = []
    for card in cards:
        key = f"{card.name}-{card.set_id}"
        try: 
            price = get_card_price(key, card.set_id)
        except Exception as e:
            price = 0.0
            logging.error(f"Error fetching price for {key}: {e}")
        results.append({
            "name": card.name,
            "set_id": card.set_id,
            "price": price
        })
    return results
