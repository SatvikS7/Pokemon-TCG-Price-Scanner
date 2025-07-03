import os
import requests
from PIL import Image
from io import BytesIO

# === CONFIGURATION ===
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
SEARCH_TERMS = [
    "desk", "table", "carpet", "flat lay", "wood texture", "nature", "car interior",
    "backpack", "keyboard", "blanket", "notebook", "concrete floor", "bed sheets",
    "bookshelf", "cardboard", "fabric texture", "plastic surface", "game board",
    "workbench", "gaming setup", "mousepad", "window sill"
]
IMAGES_PER_TERM = 20  # Total images = len(SEARCH_TERMS) * IMAGES_PER_TERM
OUTPUT_DIR = "backgrounds"
RESIZE_TO = (640, 640)

os.makedirs(OUTPUT_DIR, exist_ok=True)

def search_unsplash(query, page=1, per_page=20):
    url = "https://api.unsplash.com/search/photos"
    headers = {"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"}
    params = {
        "query": query,
        "page": page,
        "per_page": per_page,
        "orientation": "landscape"
    }
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()["results"]

def download_and_resize_image(url, save_path):
    try:
        response = requests.get(url)
        img = Image.open(BytesIO(response.content)).convert("RGB")
        img = img.resize(RESIZE_TO)
        img.save(save_path)
        #print(f"Saved {save_path}")
    except Exception as e:
        print(f"Failed to save {save_path}: {e}")

def main():
    idx = 0
    for term in SEARCH_TERMS:
        print(f"Searching for '{term}'...")
        try:
            results = search_unsplash(term, per_page=IMAGES_PER_TERM)
            for img_data in results:
                url = img_data["urls"]["regular"]
                filename = f"{term.replace(' ', '_')}_{idx:04}.jpg"
                save_path = os.path.join(OUTPUT_DIR, filename)
                download_and_resize_image(url, save_path)
                idx += 1
        except Exception as e:
            print(f"⚠️ Failed for term '{term}': {e}")
        print(f"Completed term '{term}'")

if __name__ == "__main__":
    main()