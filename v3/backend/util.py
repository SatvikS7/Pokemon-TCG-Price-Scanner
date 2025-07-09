# --------------------------------------------------------------------------- #
#  Image‑hash lookup utilities                                                #
# --------------------------------------------------------------------------- #
import sqlite3
from pathlib import Path
import imagehash
from PIL import Image
import cv2
import numpy as np

DB_PATH = Path("../database/pokemon_hash_db.sqlite")     
TABLE   = "card_hashes"                        
PH_COL, DH_COL = "phash", "dhash"      

def bgr_to_pil(bgr: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR image to a PIL RGB image."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)

def compute_hashes(card_bgr: np.ndarray) -> tuple[str, str]:
    """Return (phash_hex, dhash_hex) for a 320×320 portrait card."""
    pil_img = bgr_to_pil(card_bgr)
    phash   = imagehash.phash(pil_img)     # 64‑bit perceptual hash
    dhash   = imagehash.dhash(pil_img)     # 64‑bit difference hash
    return str(phash), str(dhash)          # hex strings

def hamming_dist(hex1: str, hex2: str) -> int:
    """Fast Hamming distance between two equal‑length hex strings."""
    return (int(hex1, 16) ^ int(hex2, 16)).bit_count()

def find_best_match(ph: str, dh: str, db_path: Path = DB_PATH) -> tuple|None:
    """Return (row_dict, total_dist) with smallest combined distance, or None."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(f"""
            SELECT id, {PH_COL}, {DH_COL}, name, set_id, image_url
            FROM {TABLE}
        """)

        best_row, best_score = None, float("inf")
        for row in cur:
            d  = (hamming_dist(ph, row[PH_COL])
                + hamming_dist(dh, row[DH_COL]))
            if d < best_score:
                best_score, best_row = d, row

    return (best_row, best_score) if best_row else None

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
                          flip: bool = False) -> np.ndarray | None:
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

    # flip 180 degrees if flip is True
    if flip:
        warped = cv2.flip(warped, -1)

    return warped

def recognize_card_from_frame(frame, model, conf=0.85, flip=False):
    """
    Takes a frame, runs YOLO-seg inference, extracts card(s), computes hashes,
    and finds the best match in the database.

    Returns:
        dict or None: Match information as a dictionary, or None if no match.
    """
    results = model(frame, imgsz=640, conf=conf)[0]

    if results.masks is not None:
        for m in results.masks.data.cpu().numpy():
            card = perspective_transform(frame, m, flip=flip)
            if card is not None:
                phash, dhash = compute_hashes(card)
                match = find_best_match(phash, dhash)
                if match:
                    row, score = match
                    return {
                        "name": row["name"],
                        "set_id": row["set_id"],
                        "image_url": row["image_url"],
                        "score": score
                    }
    return None
