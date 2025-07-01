import cv2
import numpy as np
import os
import random
import albumentations as A
from glob import glob

CARD_DIR = "../dataset/pos_data"
BG_DIR = "backgrounds/"
OUTPUT_DIR = "synthetic_data/"

os.makedirs(f"{OUTPUT_DIR}/images", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/labels", exist_ok=True)

augment = A.Compose([
    A.RandomBrightnessContrast(p=0.5),
    A.HueSaturationValue(p=0.3),
    A.GaussianBlur(p=0.3),
    A.ImageCompression(quality_lower=60, quality_upper=100, p=0.5),
    A.Perspective(scale=(0.03, 0.1), p=0.8),
    A.Rotate(limit=180, border_mode=cv2.BORDER_REFLECT, p=0.8),
    A.RandomShadow(p=0.2),
], bbox_params=A.BboxParams(format='yolo'))

card_paths = glob(f"{CARD_DIR}/*.jpg")
bg_paths = glob(f"{BG_DIR}/*.jpg")

for i in range(1000):  # Generate 1000 synthetic images
    card_path = random.choice(card_paths)
    bg_path = random.choice(bg_paths)

    card = cv2.imread(card_path)
    bg = cv2.imread(bg_path)
    bg = cv2.resize(bg, (640, 640))

    # Resize card and get bbox
    h, w = random.randint(200, 350), random.randint(300, 450)
    card = cv2.resize(card, (w, h))
    x, y = random.randint(0, 640 - w), random.randint(0, 640 - h)
    bbox = [x / 640, y / 640, w / 640, h / 640]  # YOLO format

    # Composite
    bg[y:y+h, x:x+w] = card

    # Apply augmentation
    result = augment(image=bg, bboxes=[bbox])
    final_img = result['image']
    final_bbox = result['bboxes'][0]

    filename = f"{i:05}.jpg"
    cv2.imwrite(f"{OUTPUT_DIR}/images/{filename}", final_img)

    with open(f"{OUTPUT_DIR}/labels/{filename.replace('.jpg', '.txt')}", 'w') as f:
        f.write(f"0 {final_bbox[0]} {final_bbox[1]} {final_bbox[2]} {final_bbox[3]}\n")  # class_id = 0
