import os
import requests
from PIL import Image
from io import BytesIO

# === CONFIGURATION ===
UNSPLASH_ACCESS_KEY = "MflPAcNrREtFo6jBSpU0wqimMSJymgpiHun7Yt7gxR4"
SEARCH_TERMS = ["books", "playing cards", "paper sheets", "boxes", "frames",
                "posters", "magazines", "envelopes", "stationery", "notebooks",
                "clutter", "messy"
]
IMAGES_PER_TERM = 130  # Total images = len(SEARCH_TERMS) * IMAGES_PER_TERM
MAX_PER_PAGE = 30
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
        downloaded = 0
        page = 1
        while downloaded < IMAGES_PER_TERM:
            per_page = min(MAX_PER_PAGE, IMAGES_PER_TERM - downloaded)
            results = search_unsplash(term, page=page, per_page=per_page)

            if not results:         
                break

            for img_data in results:
                url = img_data["urls"]["regular"]
                file_name = f"{term.replace(' ', '_')}_{idx:04}.jpg"
                save_path = os.path.join(OUTPUT_DIR, file_name)
                download_and_resize_image(url, save_path)
                idx += 1
                downloaded += 1

            page += 1

if __name__ == "__main__":
    main()