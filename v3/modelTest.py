#!/usr/bin/env python
"""
Real‑time YOLO‑seg inference + perspective‑corrected card extraction.
• Press  q  in the main video window to quit.
"""

import argparse
import cv2
import numpy as np
import torch
from ultralytics import YOLO
import webbrowser
import util
# --------------------------------------------------------------------------- #
#  Perspective‑transform helpers (your code, slightly tidied)                 #
# --------------------------------------------------------------------------- #

def reorder_points(points: np.ndarray) -> np.ndarray:
    """Return points ordered TL, TR, BR, BL (clockwise)."""
    centroid = np.mean(points, axis=0)
    return np.array(
        sorted(points, key=lambda p: np.arctan2(p[0][1] - centroid[0][1],
                                                p[0][0] - centroid[0][0]))
    )

def get_card_dimensions(corners: np.ndarray) -> tuple:
    """Compute card width and height from 4‑corner quadrilateral."""
    width  = np.linalg.norm(corners[0] - corners[1])
    height = np.linalg.norm(corners[1] - corners[2])
    return width, height

def perspective_transform(image: np.ndarray, mask: np.ndarray,
                          mirror: bool = False) -> np.ndarray | None:
    """
    Isolate the card in `image` using `mask`, correct its perspective,
    return a 320×320 portrait card image (or None on failure).
    """
    mask_u8 = (mask.astype(np.uint8) * 255)

    contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # largest contour = card outline
    contour = max(contours, key=cv2.contourArea)

    # polygonal approximation
    approx = cv2.approxPolyDP(contour, 0.1 * cv2.arcLength(contour, True), True)
    if len(approx) != 4:
        return None  # not a quadrilateral – discard

    approx = reorder_points(approx).astype(np.float32)

    # destination rectangle
    w, h = get_card_dimensions(approx)
    dst  = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]],
                    dtype=np.float32)

    M = cv2.getPerspectiveTransform(approx, dst)
    warped = cv2.warpPerspective(image, M, (int(w), int(h)))

    # rotate to portrait if needed
    if warped.shape[1] > warped.shape[0]:
        warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)

    # uniform canvas
    warped = cv2.resize(warped, (320, 320), interpolation=cv2.INTER_AREA)

    if mirror:
        warped = cv2.flip(warped, 1)

    return warped


# --------------------------------------------------------------------------- #
#  Main live‑camera application                                               #
# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default="best.pt", help="path to model weights")
    ap.add_argument("--device",  default="0",      help="CUDA device (0/1) or cpu")
    ap.add_argument("--conf",    type=float, default=0.85, help="confidence threshold")
    ap.add_argument("--imgsz",   type=int,   default=640,  help="inference image size")
    ap.add_argument("--camera",  type=int,   default=0,    help="webcam index")
    ap.add_argument("--mirror",  action="store_true",      help="mirror warped card")
    args = ap.parse_args()

    model = YOLO(args.weights)
    model.fuse()
    dev   = (torch.device(f"cuda:{args.device}")
             if torch.cuda.is_available() and args.device != "cpu"
             else torch.device("cpu"))
    model.to(dev)

    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise RuntimeError("❌ Could not open camera")

    print("⚡ Press  q  in the main video window to quit")
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        res = model(frame, imgsz=args.imgsz, conf=args.conf,
                    device=args.device, stream=False)[0]
        annotated = res.plot()

        if res.masks is not None:
            for i, m in enumerate(res.masks.data.cpu().numpy()):
                card = perspective_transform(frame, m, mirror=args.mirror)
                if card is not None:
                    cv2.imshow(f"Card {i}", card)
                    ph, dh = util.compute_hashes(card)              # ① compute hashes
                    match = util.find_best_match(ph, dh)            # ② DB lookup
                    if match:
                        row, score = match
                        print(f"Match ➜ {row['name']} ({row['set_id']})  "
                            f"distance={score}")
                        webbrowser.open(row["image_url"])

        cv2.imshow("YOLO‑seg live", annotated)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
