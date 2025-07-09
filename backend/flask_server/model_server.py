from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import cv2
import base64
import requests
import os
from dotenv import load_dotenv
import pytesseract

load_dotenv()

MODEL_URL = os.getenv("MODEL_URL", None)
MODEL_PATH = "pokemon_card_detector.h5"

BOTTOM_PERCENT = 0.94

if MODEL_URL:
    print(f"Using model from {MODEL_URL}")
else:
    print("NONE")

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'


def download_model():
    if not os.path.exists(MODEL_PATH):
        print(f"Downloading model from {MODEL_URL}...")
        response = requests.get(MODEL_URL, stream=True)
        if response.status_code == 200:
            with open(MODEL_PATH, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            print("Model downloaded successfully.")
        else:
            raise Exception(f"Failed to download model. Status code: {response.status_code}")

if MODEL_URL:
    download_model()

app = Flask(__name__)
def get_model():
    if not hasattr(app, 'model'):
        app.model = tf.keras.models.load_model(MODEL_PATH)
    return app.model

def preprocess_ocr_HighRes(region):
    scale = 2.0
    colorBound = 74
    region = cv2.resize(region, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    mask = (region[:, :, 0] < colorBound) & (region[:, :, 1] < colorBound) & (region[:, :, 2] < colorBound)
    kernel = np.ones((3, 3), np.uint8)
    dilated_mask = cv2.dilate(mask.astype(np.uint8), kernel, iterations=1)
    final_mask = dilated_mask == 0
    res = np.zeros_like(region)
    res[final_mask] = 255
    return res

def preprocess_ocr_LowRes(region):
    # 1. Upscale and convert to grayscale
    region = cv2.resize(region, None, fx=3, fy=3, interpolation=cv2.INTER_LANCZOS4)
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    
    # 2. Enhance contrast (preserves white outlines)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    mean_brightness = np.mean(enhanced)
    
    if mean_brightness < 85:       # Dark region
        print("Dark region detected")
        kernel = np.array([[ 0, -1.0,  0 ],
                           [-1.0, 5.0, -1.0],
                           [ 0, -1.0,  0 ]])
    elif mean_brightness > 170:    # Very bright region
        print("Very bright region detected")
        kernel = np.array([[ 0, -0.3,  0 ],
                           [-0.3, 2.6, -0.3],
                           [ 0, -0.3,  0 ]])
    else:                          # Medium brightness
        print("Medium brightness region detected")
        kernel = np.array([[ 0, -0.5,  0 ],
                           [-0.5, 3.0, -0.5],
                           [ 0, -0.5,  0 ]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    
    # 3. Use Otsu's thresholding for automatic level selection
    _, thresh = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # 4. Smart inversion (only if background is darker than text)
    if np.mean(thresh) < 54:
        thresh = cv2.bitwise_not(thresh)
    
    # 5. Remove outer black artifacts using contour area filtering
    contours, _ = cv2.findContours(
        cv2.bitwise_not(thresh), 
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )
    
    mask = np.zeros_like(thresh)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 70:  # Minimum area for text components (adjust as needed)
            cv2.drawContours(mask, [cnt], -1, 255, -1)
    
    # 6. Final clean image (black text on white)
    final = cv2.bitwise_not(mask)
    
    # 7. Mild morphological closing to reconnect broken text
    final = cv2.morphologyEx(final, cv2.MORPH_CLOSE, 
                           cv2.getStructuringElement(cv2.MORPH_RECT, (1,1)))
    
    return final


def preprocess_for_ocr(region):
    h, w = region.shape[:2]
    isHighRes = max(h, w) > 175
    if isHighRes:
        return preprocess_ocr_HighRes(region)
    else:
        return preprocess_ocr_LowRes(region)

def ocr_number(img):
    pil_img = Image.fromarray(img)
    custom_config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789/'
    text = pytesseract.image_to_string(pil_img, config=custom_config)
    return text.strip().replace(" ", "")


def crop_card_from_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges_dialate = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

    contours, _ = cv2.findContours(edges_dialate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image, image, gray, blur, edges, edges_dialate, None

    min_area = 0.03 * image.shape[0] * image.shape[1]
    card_like_contours = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
        if len(approx) == 4: 
            card_like_contours.append(cnt)

    if not card_like_contours:
        return image, image, gray, blur, edges, edges_dialate, None

    card_contour = max(card_like_contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(card_contour)

    image_cpy = image.copy()
    cv2.drawContours(image_cpy, [card_contour], -1, (0, 255, 0), 2)

    cropped = image[y:y+h, x:x+w]
    
    start_row = int(BOTTOM_PERCENT * cropped.shape[0])
    end_row = int(0.98 * cropped.shape[0])
    start_col = int(0.16 * cropped.shape[1])
    end_col = int(0.29 * cropped.shape[1])
    card_number = preprocess_for_ocr(cropped[start_row:end_row, start_col:end_col])

    return cropped, image_cpy, gray, blur, edges, edges_dialate, card_number 

def preprocess(image):
    try:
        img = cv2.resize(image, (224, 224))
        img = np.array(img) 
        return np.expand_dims(img, axis=0)
    except Exception as e:
        print("Error during preprocessing:", e)
        return None
    
def encode_img(img, is_gray=False):
    if is_gray:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')

@app.route("/predict", methods=["POST"])
def predict():
    raw_debug = request.args.get("debug", "false")
    debug_flag = raw_debug.lower() in ["1", "true", "yes"]

    model = get_model()
    
    file = request.files.get("file")
    if file is None:
        return jsonify({"error": "No file uploaded"}), 400
    
    img = Image.open(io.BytesIO(file.read())).convert("RGB")
    img_np = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    cropped_image, annotated_image, gray, blur, edges, edges_dialate, card_number = crop_card_from_image(img_np)
    img_tensor = preprocess(cropped_image)
    if img_tensor is None:
        return jsonify({
        "confidence": 0.0,
        "label": "Error during preprocessing",
        })
    prediction = model.predict(img_tensor)
    confidence = round(float(prediction[0][0]), 2)

    if card_number is not None:
        card_number_text = ocr_number(card_number)
        if card_number_text == "":
            print("OCR failed to read card number")
    else:
        print("No card number region detected")   
        card_number_text = ""

    full_response = {
        "confidence": confidence,
        "annotated_image": encode_img(annotated_image),
        "cropped_image": encode_img(cropped_image),
        "gray": encode_img(gray, is_gray=True),
        "blur": encode_img(blur, is_gray=True),
        "edges": encode_img(edges, is_gray=True),
        "dilated": encode_img(edges_dialate, is_gray=True),
        "card_number": encode_img(card_number) if card_number is not None else None,
        "card_number_text": card_number_text,
    }

    if not debug_flag:
        minimal_response = {
            "confidence": confidence,
            "cropped_image": full_response["cropped_image"],
            "card_number_text": card_number_text,
        }
        return jsonify(minimal_response)

    return jsonify(full_response)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    if MODEL_URL:
        host = '0.0.0.0'
    else:
        host = 'localhost'
    app.run(host=host, port=port)