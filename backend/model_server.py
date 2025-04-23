from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import cv2
import base64

app = Flask(__name__)
model = tf.keras.models.load_model("../model/pokemon_card_detector.h5")

def crop_card_from_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print("No contours found — using original image")
        return image, image

    min_area = 0.03 * image.shape[0] * image.shape[1]
    card_like_contours = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
        aspect_ratio = h / w if w != 0 else 0
        if len(approx) == 4 and 1.0 < aspect_ratio < 1.8:
            card_like_contours.append(cnt)

    if not card_like_contours:
        print("No card-like contours found — using original image")
        return image, image

    card_contour = max(card_like_contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(card_contour)

    image_cpy = image.copy()
    cv2.drawContours(image_cpy, [card_contour], -1, (0, 255, 0), 2)

    return image[y:y+h, x:x+w], image_cpy


def preprocess(image):
    try:
        img = cv2.resize(image, (224, 224))
        img = np.array(img) 
        return np.expand_dims(img, axis=0)
    except Exception as e:
        print("Error during preprocessing:", e)
        return None

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files.get("file")
    if file is None:
        return jsonify({"error": "No file uploaded"}), 400
    
    img = Image.open(io.BytesIO(file.read())).convert("RGB")
    img_np = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    cropped_image, annotated_image = crop_card_from_image(img_np)
    img_tensor = preprocess(cropped_image)
    if img_tensor is None:
        return jsonify({
        "confidence": 0.0,
        "label": "Error during preprocessing",
        })
    prediction =    model.predict(img_tensor)
    confidence = round(float(prediction[0][0]), 2)
    label = "Pokemon Card" if confidence >= 0.5 else "Not a Pokemon Card"

    # Encode image with rectangle to base64
    _, buffer = cv2.imencode('.jpg', annotated_image)
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    return jsonify({
        "confidence": confidence,
        "annotated_image": img_base64,
        })

if __name__ == "__main__":
    app.run(port=5000)