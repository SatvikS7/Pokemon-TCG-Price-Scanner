import pandas as pd
import requests
import os
from tqdm import tqdm
from urllib.parse import urlparse

df = pd.read_csv('C:/Users/satvi/Desktop/Personal Projects/pokemon-price-checker-v2/model/dataset/pokemon-cards.csv')
df = df.sample(frac=1).reset_index(drop=True)

output_folder = 'pokemon_images'
os.makedirs(output_folder, exist_ok=True)

def download_images(df, image_column, output_folder):
    for index, url in tqdm(enumerate(df[image_column]), total=len(df)):
        try:    
            name = df.loc[index, 'name']
            filename = f"{name.replace(' ', '_')}.jpg"
            image_path = os.path.join(output_folder, filename)

            response = requests.get(url, timeout=10)
            response.raise_for_status()

            with open(image_path, 'wb') as f:
                f.write(response.content)

            print(f"\n Saved: {image_path}")

        except Exception as e:
            print(f"\n Failed to download {url}: {e}")

download_images(df, 'image_url', output_folder)
