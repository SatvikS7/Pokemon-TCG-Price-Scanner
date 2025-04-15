from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io

app = Flask(__name__)
model = tf.keras.models.load_model("../model/saved_model/")

def preprocess(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = img.resize((224, 224))  # adjust as needed
    img = np.array(img) / 255.0
    return np.expand_dims(img, axis=0)

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files.get("file")
    if file is None:
        return jsonify({"error": "No file uploaded"}), 400

    img_tensor = preprocess(file.read())
    prediction = model.predict(img_tensor)

    return jsonify({"prediction": float(prediction[0][0])})

if __name__ == "__main__":
    app.run(port=5000)
