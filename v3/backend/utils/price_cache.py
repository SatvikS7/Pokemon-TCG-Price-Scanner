from cachetools import TTLCache
import requests
import os

# Cache: max 50 items, expire after 1 hour
cache = TTLCache(maxsize=50, ttl=3600)

def get_card_price(key: str, set_id: str):
    if key in cache:
        return cache[key]

    # Replace with your actual TCGPlayer API logic
    price = fetch_price_from_tcgplayer(set_id)
    cache[key] = price
    return price

def fetch_price_from_tcgplayer(set_id):
    url = f"https://api.pokemontcg.io/v2/cards?q=id:{set_id}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()['data'][0]
        # Extract price from the response, saved in data.tcgplayer.prices.normal.market
        if "tcgplayer" in data and "prices" in data["tcgplayer"] and "normal" in data["tcgplayer"]["prices"]:
            return data["tcgplayer"]["prices"]["normal"].get("market", 0.0)
        return 0.0
    return 0.0