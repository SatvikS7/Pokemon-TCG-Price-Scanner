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

load_dotenv()

MODEL_URL = os.getenv("MODEL_URL", None)
MODEL_PATH = "pokemon_card_detector.h5"

TOP_PERCENT = 0.15
BOTTOM_PERCENT = 0.93

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

def preprocess_for_ocr(region):
    
    # Upscale to help OCR
    region = cv2.resize(region, None, fx=3, fy=3, interpolation=cv2.INTER_LANCZOS4)

    # Convert to grayscale
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

    # Improve contrast with CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # Light blur to remove noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # Adaptive thresholding with tuned parameters
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11, 1
    )

    # OPTIONAL: Light morphological closing to bridge broken digits
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close)

    # Light erosion to thin lines slightly (1x1 or 2x2 kernel)
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
    thinned = cv2.erode(closed, kernel_erode, iterations=1)

    return thinned

def crop_card_from_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges_dialate = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

    contours, _ = cv2.findContours(edges_dialate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print("No contours found — using original image")
        return image, image, gray, blur, edges, edges_dialate, None, None

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
        print("No rectangular card-like contours found — using original image")
        return image, image, gray, blur, edges, edges_dialate, None, None

    card_contour = max(card_like_contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(card_contour)

    image_cpy = image.copy()
    cv2.drawContours(image_cpy, [card_contour], -1, (0, 255, 0), 2)

    cropped = image[y:y+h, x:x+w]

    card_crop = int(TOP_PERCENT * cropped.shape[0])
    card_name = cropped[:card_crop, :]
    
    start_row = int(BOTTOM_PERCENT * cropped.shape[0])
    end_row = int(0.98 * cropped.shape[0])
    start_col = int(0.15 * cropped.shape[1])
    end_col = int(0.28 * cropped.shape[1])
    card_number = preprocess_for_ocr(cropped[start_row:end_row, start_col:end_col])

    return cropped, image_cpy, gray, blur, edges, edges_dialate, card_name, card_number 

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
    model = get_model()
    
    file = request.files.get("file")
    if file is None:
        return jsonify({"error": "No file uploaded"}), 400
    
    img = Image.open(io.BytesIO(file.read())).convert("RGB")
    img_np = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    cropped_image, annotated_image, gray, blur, edges, edges_dialate, card_name, card_number = crop_card_from_image(img_np)
    img_tensor = preprocess(cropped_image)
    if img_tensor is None:
        return jsonify({
        "confidence": 0.0,
        "label": "Error during preprocessing",
        })
    prediction = model.predict(img_tensor)
    confidence = round(float(prediction[0][0]), 2)

    return jsonify({
        "confidence": confidence,
        "annotated_image": encode_img(annotated_image),
        "cropped_image": encode_img(cropped_image),
        "gray": encode_img(gray, is_gray=True),
        "blur": encode_img(blur, is_gray=True),
        "edges": encode_img(edges, is_gray=True),
        "dilated": encode_img(edges_dialate, is_gray=True),
        "card_name": encode_img(card_name) if card_name is not None else None,
        "card_number": encode_img(card_number) if card_number is not None else None,
        })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    if MODEL_URL:
        host = '0.0.0.0'
    else:
        host = 'localhost'
    app.run(host=host, port=port)