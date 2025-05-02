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
    edges_dialate = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

    contours, _ = cv2.findContours(edges_dialate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print("No contours found — using original image")
        return image, image, gray, blur, edges, edges_dialate, None

    min_area = 0.03 * image.shape[0] * image.shape[1]
    card_like_contours = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
        if len(approx) == 4:  # looks like a rectangle
            card_like_contours.append(cnt)

    if not card_like_contours:
        print("No rectangular card-like contours found — using original image")
        return image, image, gray, blur, edges, edges_dialate, None

    card_contour = max(card_like_contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(card_contour)

    image_cpy = image.copy()
    cv2.drawContours(image_cpy, [card_contour], -1, (0, 255, 0), 2)

    cropped = image[y:y+h, x:x+w]

    card_name_height = int(0.10 * cropped.shape[0])
    card_name = cropped[:card_name_height, :]

    return cropped, image_cpy, gray, blur, edges, edges_dialate, card_name

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
    file = request.files.get("file")
    if file is None:
        return jsonify({"error": "No file uploaded"}), 400
    
    img = Image.open(io.BytesIO(file.read())).convert("RGB")
    img_np = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    cropped_image, annotated_image, gray, blur, edges, edges_dialate, card_name = crop_card_from_image(img_np)
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
        })

if __name__ == "__main__":
    app.run(port=5000)