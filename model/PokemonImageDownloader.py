import pandas as pd
import requests
import os
from tqdm import tqdm
from urllib.parse import urlparse

df = pd.read_csv('./dataset/pokemon-cards.csv')
df = df.sample(frac=1).reset_index(drop=True)


output_folder = '../dataset/pos_data'
os.makedirs(output_folder, exist_ok=True)

def download_images(df, image_column, output_folder):
    with tqdm(total=len(df), ncols= 80, desc="Downloading images") as pbar:
        errors = 0
        for index, url in enumerate(df[image_column]):
            try:    
                name = df.loc[index, 'name'] + '_' + df.loc[index, 'id']
                filename = f"{name.replace(' ', '_')}.jpg"
                filename = filename.replace('"', '')
                filename = filename.replace('δ', 'delta')

                #check if filename already exists in output_folder
                if os.path.exists(os.path.join(output_folder, filename)):
                    tqdm.write(f"Already downloaded: {filename}")
                else:
                    image_path = os.path.join(output_folder, filename)

                    response = requests.get(url, timeout=10)
                    response.raise_for_status()

                    with open(image_path, 'wb') as f:
                        f.write(response.content)

            except Exception as e:
                # add number of errors to a counter
                errors += 1
                tqdm.write(f"Failed to download {url}: {e}")

            if(index%100 == 0):
                tqdm.write(f"Downloaded {index} images with {errors} errors")
            
            pbar.update(1)

download_images(df, 'image_url', output_folder)
