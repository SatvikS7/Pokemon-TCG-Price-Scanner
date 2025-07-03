import cv2
import numpy as np
import os
import json
import random
from tqdm import tqdm
import albumentations as A

# Paths
CARD_DIR = "../dataset/pos_data"
BACKGROUND_DIR = "backgrounds/"
OUTPUT_DIR = "synthetic_dataset/images/"
ANNOTATION_PATH = "synthetic_dataset/annotations.json"

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load file paths
card_paths = [os.path.join(CARD_DIR, f) for f in os.listdir(CARD_DIR) if f.endswith(('.jpg', '.png'))]
bg_paths = [os.path.join(BACKGROUND_DIR, f) for f in os.listdir(BACKGROUND_DIR) if f.endswith(('.jpg', '.png'))]

# Initialize COCO fields
images = []
annotations = []
categories = [{"id": 0, "name": "pokemon_card"}]

ann_id = 1
img_id = 1
NUM_SAMPLES = 10

# Define augmentations for cards
augment = A.Compose([
    A.RandomBrightnessContrast(p=0.5),
    A.HueSaturationValue(p=0.3),
    #A.GaussianBlur(sigma_limit=[0, 1], p=0.4),
    #A.ImageCompression(quality_range=(60, 100), p=0.5),
    A.Perspective(scale=(0.03, 0.1), p=0.8),
    A.SafeRotate(limit=180,border_mode=cv2.BORDER_CONSTANT, fill=0, p=0.8),
    A.RandomShadow(p=0.2),
    A.Affine(
        scale=[0.5, 2],
        translate_percent=[-0.05, 0.05],
        rotate=[-45, 45],
        shear=[-15, 15],
        keep_ratio=True,
        p=1.0
    ),
    A.PadIfNeeded(min_height=512, min_width=512, border_mode=cv2.BORDER_CONSTANT, fill=0, p=1.0),
], additional_targets={"alpha": "mask"})

def check_overlap(new_box, existing_boxes, iou_thresh=0.2):
    x1, y1, w1, h1 = new_box
    for x2, y2, w2, h2 in existing_boxes:
        xa, ya = max(x1, x2), max(y1, y2)
        xb, yb = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
        inter_area = max(0, xb - xa) * max(0, yb - ya)
        union_area = w1 * h1 + w2 * h2 - inter_area
        if union_area > 0 and inter_area / union_area > iou_thresh:
            return True
    return False

def paste_card(bg, rgba_card, ann_id, img_id, existing_bboxes, draw_annotations=False):
    rgb_card = rgba_card[:, :, :3]
    alpha = rgba_card[:, :, 3]
    alpha_3c = np.stack([alpha] * 3, axis=-1)
    
    pad_size = 100
    rgb_card = np.pad(rgb_card, ((pad_size, pad_size), (pad_size, pad_size), (0,0)), 
                     mode='constant')
    alpha = np.pad(alpha, ((pad_size, pad_size), (pad_size, pad_size)), 
                  mode='constant')

    augmented = augment(image=rgb_card, alpha=alpha)
    rgb_aug = augmented['image']
    alpha_aug = augmented['alpha']
    #rgba_aug = np.dstack((rgb_aug, alpha_aug))
    
    #mask = alpha_aug > 0
    if not np.any(alpha_aug):
        print("No valid alpha channel found after augmentation.")
        return bg, None
        
    ys, xs = np.where(alpha_aug)
    y_min, x_min, y_max, x_max = ys.min(), xs.min(), ys.max(), xs.max()
    cropped_rgb = rgb_aug[y_min:y_max+1, x_min:x_max+1]
    cropped_alpha = alpha_aug[y_min:y_max+1, x_min:x_max+1]
    
    # Use cropped card for placement
    card = np.dstack((cropped_rgb, cropped_alpha))
    new_h, new_w = card.shape[:2]

    max_attempts = 50
    iou_thresh = 0.05
    for _ in range(max_attempts):
        x_offset = random.randint(0, 640 - new_w)
        y_offset = random.randint(0, 640 - new_h)

        proposed_box = [x_offset, y_offset, new_w, new_h]
        if not check_overlap(proposed_box, existing_bboxes, iou_thresh=iou_thresh):
            break
    else:
        print(f"Failed to find non-overlapping position for card after {max_attempts} attempts.")
        return bg, None  # Couldn't find non-overlapping spot


    mask = card[:, :, 3] > 0
    for c in range(3):
        bg[y_offset:y_offset + new_h, x_offset:x_offset + new_w, c][mask] = card[:, :, c][mask]

    #mask = alpha_aug > 0
    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        print("No valid mask found after pasting card.")
        return None, None

    xs = xs + x_offset
    ys = ys + y_offset
    contour = np.stack([xs, ys], axis=1).flatten().tolist()
    bbox = [int(x_offset), int(y_offset), int(new_w), int(new_h)]
    area = int(mask.sum())

    annotation = {
        "id": ann_id,
        "image_id": img_id,
        "category_id": 0,
        "segmentation": [contour],
        "bbox": bbox,
        "area": area,
        "iscrowd": 0
    }

    existing_bboxes.append(bbox)

    if draw_annotations:
        # Draw bounding box (green)
        cv2.rectangle(bg, 
                     (bbox[0], bbox[1]), 
                     (bbox[0] + bbox[2], bbox[1] + bbox[3]), 
                     (0, 255, 0), 2)
        
        # Draw segmentation contour (red)
        overlay = bg.copy()
        contour_points = np.array(contour).reshape(-1, 2)
        cv2.fillPoly(overlay, [contour_points], color=(0, 0, 255))  # Red mask
        alpha = 0.3  # Transparency factor (0 = fully transparent, 1 = opaque)
        cv2.addWeighted(overlay, alpha, bg, 1 - alpha, 0, bg)

    return bg, annotation

for i in tqdm(range(NUM_SAMPLES), desc="Generating synthetic data"):
    bg_path = random.choice(bg_paths)
    bg = cv2.imread(bg_path)
    bg = cv2.resize(bg, (640, 640))

    card_count = random.randint(1, 3)
    sample_annotations = []
    existing_bboxes = []

    for _ in range(card_count):
        card_path = random.choice(card_paths)
        card = cv2.imread(card_path, cv2.IMREAD_UNCHANGED)
        if card is None or card.shape[2] != 4:
            continue

        card_h, card_w = card.shape[:2]
        scale = random.uniform(0.10, 0.25)
        new_w, new_h = int(card_w * scale), int(card_h * scale)
        card = cv2.resize(card, (new_w, new_h), interpolation=cv2.INTER_AREA)

        bg, ann = paste_card(bg, card, ann_id, img_id, existing_bboxes, draw_annotations=True)
        if ann is not None:
            sample_annotations.append(ann)
            ann_id += 1

    if not sample_annotations:
        continue

    img_filename = f"img_{i:05}.jpg"
    cv2.imwrite(os.path.join(OUTPUT_DIR, img_filename), bg)

    images.append({
        "id": img_id,
        "file_name": img_filename,
        "width": 640,
        "height": 640
    })
    annotations.extend(sample_annotations)
    img_id += 1

# Save annotations in COCO format
coco = {
    "images": images,
    "annotations": annotations,
    "categories": categories
}

os.makedirs(os.path.dirname(ANNOTATION_PATH), exist_ok=True)
with open(ANNOTATION_PATH, "w") as f:
    json.dump(coco, f, indent=2)

print(f"Saved {NUM_SAMPLES} synthetic images and annotations to COCO format.")
