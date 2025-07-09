from ultralytics import YOLO

model = YOLO("card_identifier/yolo11s-seg-custom_v2/weights/last.pt") 
model.train(
    data="custom_dataset.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    device="0",
    workers=0,
    name="yolo11s-seg-custom_v2",
    save_period=10,  # Save every 10 epochs
    save=True,  # Save the model after training
    project="card_identifier",  # Save in the card_identifier directory
    plots=True,
    single_cls=True,
    patience=10,
    cache=True,
    overlap_mask=False,   
    resume=True, # comment out if starting a new model
)