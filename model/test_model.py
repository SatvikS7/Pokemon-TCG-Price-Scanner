import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image
import sys

# Load your trained model
model = tf.keras.models.load_model("pokemon_card_detector_v2.h5")

def load_image(img_path, target_size=(224, 224)):
    img = image.load_img(img_path, target_size=target_size)
    img_array = image.img_to_array(img).astype("float32")
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

# Get image path from command line argument
if len(sys.argv) < 2:
    print("Usage: python test_model.py path_to_image.jpg")
    sys.exit(1)

img_path = sys.argv[1]
input_array = load_image(img_path)

# Make prediction
prediction = model.predict(input_array)
print("Raw Prediction Output:", prediction)

# Optional: if using softmax + class labels
# Replace this with your actual class names
class_names = ["not_pokemon_card", "pokemon_card"]

predicted_class = class_names[np.argmax(prediction)]
confidence = np.max(prediction)

print(f"Predicted Class: {predicted_class} (Confidence: {confidence:.2f})")
