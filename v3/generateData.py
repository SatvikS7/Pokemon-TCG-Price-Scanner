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
OUTPUT_IMG_DIR = "synthetic_dataset/images/"
OUTPUT_LABEL_DIR = "synthetic_dataset/labels/"

# Ensure output directory exists
os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)
os.makedirs(OUTPUT_LABEL_DIR, exist_ok=True)

# Load file paths
card_paths = [os.path.join(CARD_DIR, f) for f in os.listdir(CARD_DIR) if f.endswith(('.jpg', '.png'))]
bg_paths = [os.path.join(BACKGROUND_DIR, f) for f in os.listdir(BACKGROUND_DIR) if f.endswith(('.jpg', '.png'))]

# Number of images to generate; get approx 10,000 images with 8% fail rate
NUM_SAMPLES = 11000

# Define augmentations for cards
augment = A.Compose([
    A.RandomBrightnessContrast(p=0.5), # change card brightness and contrast
    A.HueSaturationValue(p=0.3), # change card hue and saturation   
    A.SafeRotate(limit=180,border_mode=cv2.BORDER_CONSTANT, fill=0, p=0.8), # rotate card without cropping
    A.RandomShadow(p=0.4), # create shadows on card
    A.Affine(
        scale=[0.5, 2],
        translate_percent=[-0.05, 0.05],
        rotate=[-45, 45],
        shear=[-15, 15],
        keep_ratio=True,
        p=1.0
    ), # create tilt
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

def paste_card(bg, rgba_card, existing_bboxes, draw_annotations=False):
    rgb_card = rgba_card[:, :, :3] # Extract RGB channels
    alpha = rgba_card[:, :, 3] # Extract alpha channel
    
    # Arbitrary padding to ensure rotations and augmentations don't crop the card
    pad_size = 200
    rgb_card = np.pad(rgb_card, ((pad_size, pad_size), (pad_size, pad_size), (0,0)), 
                     mode='constant')
    alpha = np.pad(alpha, ((pad_size, pad_size), (pad_size, pad_size)), 
                  mode='constant')
    
    # Apply augmentations and save new image and alpha channel
    augmented = augment(image=rgb_card, alpha=alpha) 
    rgb_aug = augmented['image']
    alpha_aug = augmented['alpha']
    
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

    # Prevent major overlapping with existing boxes
    max_attempts = 50
    iou_thresh = 0.05
    for _ in range(max_attempts):
        x_offset = random.randint(0, 640 - new_w)
        y_offset = random.randint(0, 640 - new_h)

        proposed_box = [x_offset, y_offset, new_w, new_h]
        if not check_overlap(proposed_box, existing_bboxes, iou_thresh=iou_thresh):
            break
    else:
        #print(f"Failed to find non-overlapping position for card after {max_attempts} attempts.")
        return bg, None  # Couldn't find non-overlapping spot


    # Paste card onto background
    mask = card[:, :, 3] > 0
    for c in range(3):
        bg[y_offset:y_offset + new_h, x_offset:x_offset + new_w, c][mask] = card[:, :, c][mask]

    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        print("No valid mask found after pasting card.")
        return None, None

    # Adjust coordinates to match the original background
    xs = xs + x_offset
    ys = ys + y_offset
    contour = np.stack([xs, ys], axis=1).flatten().tolist()
    bbox = [int(x_offset), int(y_offset), int(new_w), int(new_h)]
    #area = int(mask.sum())

    # Find center and normalized dimensions
    x_min,y_min = x_offset, y_offset
    x_max,y_max = x_offset+new_w, y_offset+new_h
    xc = ((x_min+x_max)/2)/640
    yc = ((y_min+y_max)/2)/640
    wn = new_w/640
    hn = new_h/640

    # polygon: use 4 corners of minAreaRect
    pts = np.column_stack(np.where(mask)).astype(np.int32)
    rect = cv2.minAreaRect(pts)
    box4 = cv2.boxPoints(rect).astype(int)

    # adjust to global
    box4[:,0]+=x_offset
    box4[:,1]+=y_offset

    # normalize polygon points
    poly = []
    for x,y in box4:
        poly.append(x/640)
        poly.append(y/640)

    # save label line
    label_lines = []
    label_line = f"0 {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f} " + " ".join(f"{p:.6f}" for p in poly)
    label_lines.append(label_line)
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
        cv2.fillPoly(overlay, [contour_points], color=(0, 0, 255))
        alpha = 0.3 
        cv2.addWeighted(overlay, alpha, bg, 1 - alpha, 0, bg)

    return bg, label_lines

for i in tqdm(range(NUM_SAMPLES), desc="Generating synthetic data"):
    bg_path = random.choice(bg_paths)
    bg = cv2.imread(bg_path)
    bg = cv2.resize(bg, (640, 640))

    card_count = random.randint(1, 4)
    labels = [] 
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

        bg, label_list = paste_card(bg, card, existing_bboxes, draw_annotations=False)
        if label_list is not None:
            labels.extend(label_list)

    if not labels:
        continue
    
    # save image
    img_name = f"img_{i:05}.jpg"
    cv2.imwrite(os.path.join(OUTPUT_IMG_DIR,img_name),bg)

    # save txt
    txt_name = img_name.replace('.jpg','.txt')
    with open(os.path.join(OUTPUT_LABEL_DIR,txt_name),'w') as f:
        f.write("\n".join(labels))

print(f"Generated {NUM_SAMPLES} images with YOLO-seg labels.")

