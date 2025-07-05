from ultralytics import YOLO

model = YOLO("yolo11s-seg.pt") 
model.train(
    data="custom_dataset.yaml",
    epochs=100,
    imgsz=640,
    batch=8,
    device="0",
    workers=0,
    name="yolo11s-seg-custom",
    save_period=10,  # Save every 10 epochs
    save=True,  # Save the model after training
    project="v3",  # Save in the v3 directory
    plots=True,
)