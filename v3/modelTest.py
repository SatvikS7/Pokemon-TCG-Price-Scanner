#!/usr/bin/env python
"""
Real‑time YOLO‑seg inference on a webcam stream.
• Press  q  in the video window to quit.
• Adjust --weights and --device as needed.
"""

import argparse
import cv2
from ultralytics import YOLO     # pip install ultralytics>=8.1
import torch                     # makes sure CUDA is visible if available

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="best.pt", help="path to model weights")
    parser.add_argument("--device",  default="0",      help="CUDA device, i.e. 0 or cpu")
    parser.add_argument("--conf",    type=float, default=0.85, help="confidence threshold")
    parser.add_argument("--imgsz",   type=int,   default=640,  help="inference image size")

    args = parser.parse_args()

    # Load model once
    model = YOLO(args.weights)
    model.fuse()                              # optional: MXNet-style layer fusion for ~5‑10 % speedup
    if torch.cuda.is_available() and args.device != "cpu":
        device = torch.device(f"cuda:{args.device}")
    else:
        device = torch.device("cpu")    
    model.to(device)

    # Open default camera (0) — change to 1,2,… if you have multiple cams
    cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)  # CAP_DSHOW avoids auto‑exposure lag on Windows
    if not cap.isOpened():
        raise RuntimeError("❌ Could not open camera")

    print("⚡ Press  q  in the video window to quit")
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Inference (returns a Results list; we take index 0 because batch=1)
        results = model(
            frame,
            imgsz=args.imgsz,
            conf=args.conf,
            device=args.device,
            stream=False          # synchronous; change to True for generator style
        )
        annotated = results[0].plot()  # draws boxes, masks, labels

        cv2.imshow("YOLOv11‑seg live", annotated)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()