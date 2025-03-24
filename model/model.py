import os

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing import image_dataset_from_directory
import matplotlib.pyplot as plt

# Paths to the dataset
data_dir = "../dataset/" 
batch_size = 32
img_size = (224, 224)

print("Full dataset path:", os.path.abspath(data_dir))

# Load datasets (with 80-20 train-validation split)
train_ds = image_dataset_from_directory(
    data_dir,
    labels='inferred',
    label_mode = 'categorical',
    class_names=['neg_data', 'pos_data'],
    shuffle=True,
    validation_split=0.2,
    subset="training",
    seed=123,
    crop_to_aspect_ratio=False,
    pad_to_aspect_ratio=True,
    image_size=img_size,
    batch_size=batch_size
)

val_ds = image_dataset_from_directory(
    data_dir,
    labels='inferred',
    label_mode = 'categorical',
    class_names=['neg_data', 'pos_data'],
    shuffle=True,
    validation_split=0.2,
    subset="validation",
    seed=123,
    crop_to_aspect_ratio=False,
    pad_to_aspect_ratio=True,
    image_size=img_size,
    batch_size=batch_size
)

# Data Augmentation
data_augmentation = keras.Sequential([
    layers.RandomFlip("horizontal"),      # Randomly flip images horizontally
    layers.RandomRotation(0.2),           # Rotate images up to 20%
    layers.RandomZoom(0.2),               # Randomly zoom by 20%
    layers.RandomContrast(0.2),           # Randomly change contrast
    layers.RandomTranslation(0.1, 0.1)    # Randomly translate (shift) images
])
# Visualize Augmented Data
for images, _ in train_ds.take(1):
    plt.figure(figsize=(10, 10))
    for i in range(9):
        augmented_image = data_augmentation(images)
        plt.subplot(3, 3, i + 1)
        plt.imshow(augmented_image[0].numpy().astype("uint8"))
        plt.axis("off")
    plt.show()

# Define the CNN Model
model = keras.Sequential([
    layers.Rescaling(1./255, input_shape=(224, 224, 3)),
    data_augmentation,
    layers.Conv2D(32, 3, activation='relu'),
    layers.MaxPooling2D(),
    layers.Conv2D(64, 3, activation='relu'),
    layers.MaxPooling2D(),
    layers.Conv2D(128, 3, activation='relu'),
    layers.MaxPooling2D(),
    layers.Flatten(),
    layers.Dense(128, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(1, activation='sigmoid')
])

# Compile the Model
model.compile(optimizer='adam',
              loss='binary_crossentropy',
              metrics=['accuracy'])

# Train the Model
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=20
)

# Save the Model
model.save('pokemon_card_detector.h5')

# Evaluate the Model
test_loss, test_acc = model.evaluate(val_ds)
print(f"Test Accuracy: {test_acc:.4f}")

plt.plot(history.history['accuracy'], label='Train Accuracy')
plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
plt.xlabel('Epochs')
plt.ylabel('Accuracy')
plt.legend()
plt.show()
