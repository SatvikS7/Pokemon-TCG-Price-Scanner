from cachetools import TTLCache
import requests
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)

load_dotenv()

POKEMONTCG_API_KEY = os.getenv('POKEMONTCG_API_KEY')
if not POKEMONTCG_API_KEY:
    raise ValueError("Missing POKEMONTCG_API_KEY. Make sure it's set in the environment or .env file.")

headers = {
    'X-Api-Key': POKEMONTCG_API_KEY
}

# Cache: max 50 items, expire after 1 hour
cache = TTLCache(maxsize=50, ttl=3600)
pricePriority = [
  "normal",
  "1stEditionNormal",
  "reverseHolofoil",
  "holofoil",
  "1stEditionHolofoil",
]

def get_card_price(key: str, set_id: str):
    if key in cache:
        return cache[key]

    # Replace with your actual TCGPlayer API logic
    price = fetch_price_from_tcgplayer(set_id)
    cache[key] = price
    return price

def fetch_price_from_tcgplayer(set_id):
    url = f"https://api.pokemontcg.io/v2/cards?q=id:{set_id}"
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()['data'][0]
            if not data:
                return 0.0
            # Extract price from the response, saved in data.tcgplayer.prices.normal.market
            if "tcgplayer" in data and "prices" in data["tcgplayer"]:
                prices = data["tcgplayer"]["prices"]
                # Check for pricing options in priority order
                for price_type in pricePriority:
                    if price_type in prices and "market" in prices[price_type]:
                        return prices[price_type]["market"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        # Optional: log error
        logging.error(f"Error fetching price for {set_id}: {e}")
    return 0.0