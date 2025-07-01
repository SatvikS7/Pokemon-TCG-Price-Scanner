from PIL import Image
import imagehash
import requests
from io import BytesIO
import json
import sqlite3
import sys
from tqdm import tqdm


def init_db(db_path="pokemon_hash_db.sqlite"):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS card_hashes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phash TEXT NOT NULL,
            dhash TEXT NOT NULL,
            name TEXT NOT NULL,
            set_id TEXT UNIQUE NOT NULL,
            image_url TEXT NOT NULL
        );
    """)
    conn.commit()
    return conn

def get_all_cards():
    url = "https://api.pokemontcg.io/v2/cards"
    all_cards = []
    page = 1

    while True:
        response = requests.get(url, params={"page": page, "pageSize": 250})
        if response.status_code != 200:
            print(f"Error fetching data: {response.status_code}")
            break
        data = response.json()['data']
        if not data:
            break

        all_cards.extend(data)
        page += 1
    return [{
        "name": card["name"],
        "set_id": card["id"],
        "image_url": card["images"]["large"]
    } for card in all_cards]

def compute_hash(url):
    img = Image.open(BytesIO(requests.get(url).content)).convert("RGB")
    # Resize image to 256x256 for consistency in hashing
    img = img.resize((256, 256), Image.Resampling.LANCZOS)
    phash_val = imagehash.phash(img)
    dhash_val = imagehash.dhash(img)
    return str(phash_val), str(dhash_val)


def save_to_sqlite(db_entries, conn):
    cursor = conn.cursor()
    for entry in db_entries:
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO card_hashes (name, set_id, phash, dhash, image_url)
                VALUES (?, ?, ?, ?, ?)
            """, (entry["name"], entry["set_id"], entry["phash"], entry["dhash"], entry["image_url"]))
        except Exception as e:
            print(f"DB insert failed for {entry['set_id']}: {e}")
    conn.commit()

def build_hash_db():
    conn = init_db()
    cards = get_all_cards()
    db = []

    for card in tqdm(cards, desc="Hashing cards", unit="card"):
        try:
            phash_val, dhash_val = compute_hash(card["image_url"])
            db.append({
                "phash": phash_val,
                "dhash": dhash_val,
                "name": card["name"],
                "set_id": card["set_id"],
                "image_url": card["image_url"]
            })
        except Exception as e:
            print(f"Failed: {card['name']} ({card['set_id']}) → {e}")

    save_to_sqlite(db, conn)
    conn.close()

def get_card_by_set_id(set_id, db_path="pokemon_hash_db.sqlite"):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name, set_id, image_url, phash, dhash FROM card_hashes WHERE set_id = ?", (set_id,))
    result = cursor.fetchone()
    conn.close()
    return result

if __name__ == "__main__":
    if len(sys.argv) > 3: 
        print("Too many arguments provided.")
    elif len(sys.argv) <= 1:
        print("No arguments provided. Use 'build' to create/update the hash database "
              "or 'get <set_id>' to retrieve a card by its set ID.")
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        print("Building hash database...")
        build_hash_db()
    elif len(sys.argv) == 3 and sys.argv[1] == "get": 
        set_id = sys.argv[2]
        card = get_card_by_set_id(set_id)
        if card:
            print(f"Card found: {card}")
        else:
            print(f"No card found with set ID: {set_id}")
    else:
        print("Invalid command. Use 'build' to create/update the hash database "
              "or 'get <set_id>' to retrieve a card by its set ID.")
        