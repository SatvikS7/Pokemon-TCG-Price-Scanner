import pandas as pd
import requests
import os
from tqdm import tqdm
from urllib.parse import urlparse

df = pd.read_csv('C:/Users/satvi/Desktop/Personal Projects/pokemon-price-checker-v2/model/dataset/yugioh-cards.csv')
df = df.sample(frac=1).reset_index(drop=True)

print(df.head())

output_folder = 'yugioh_images'
os.makedirs(output_folder, exist_ok=True)

def download_images(df, image_column, output_folder):
    for index, url in tqdm(enumerate(df[image_column]), total=len(df)):
        try:    
            name = df.loc[index, 'name']
            name = name.replace('"', '')
            filename = f"{name.replace(' ', '_')}.jpg"
            image_path = os.path.join(output_folder, filename)
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            with open(image_path, 'wb') as f:
                f.write(response.content)

            print(f"\n Saved: {image_path}")

        except Exception as e:
            print(f"\n Failed to download {url}: {e}")

download_images(df.head(3285), 'image_url', output_folder)
