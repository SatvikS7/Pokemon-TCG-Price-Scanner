import requests
import os
import time
from tqdm import tqdm

output_folder = 'digimon_images'
os.makedirs(output_folder, exist_ok=True)

def download_images(num_images):
    api_url = "https://digimoncard.io/api-public/search.php"

    params = {
        "series": "Digimon Card Game"
    }
    response = requests.get(api_url, params=params)
    cards = response.json()

    for card in cards[:num_images]:  
        image_url = card.get('image_url')
        if image_url:
            name = card['name'].replace(' ', '_')
            name = name.replace('"', '_')
            image_name = f"{name}.jpg"
            image_path = os.path.join(output_folder, image_name)

            img_data = requests.get(image_url).content
            with open(image_path, 'wb') as img_file:
                img_file.write(img_data)

            print(f"Downloaded: {image_name}")

    print("Image download complete!")

download_images(3285)