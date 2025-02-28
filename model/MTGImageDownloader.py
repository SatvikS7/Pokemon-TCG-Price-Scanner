import requests
import os
import time
from tqdm import tqdm

output_folder = 'mtg_images'
os.makedirs(output_folder, exist_ok=True)

def download_mtg_images(num_images):
    base_url = "https://api.scryfall.com/cards/random"
    count = 0

    while count < num_images:
        try:
            response = requests.get(base_url)
            if response.status_code != 200:
                print("Error fetching card, retrying...")
                time.sleep(1)
                continue

            card_data = response.json()

            image_url = card_data.get('image_uris', {}).get('large')
            if not image_url:
                continue

            card_name = card_data['name'].replace(" ", "_").replace("/", "_")
            image_path = os.path.join(output_folder, f"{card_name}.jpg")

            img_response = requests.get(image_url)
            with open(image_path, 'wb') as img_file:
                img_file.write(img_response.content)

            count += 1
            print(f"{count}/{num_images}: {card_name}")

        except Exception as e:
            print(f"Error: {e}")
            time.sleep(1)

download_mtg_images(1250)
