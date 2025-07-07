# --------------------------------------------------------------------------- #
#  Image‑hash lookup utilities                                                #
# --------------------------------------------------------------------------- #
import sqlite3
from pathlib import Path
import imagehash
from PIL import Image
import cv2
import numpy as np

DB_PATH = Path("pokemon_hash_db.sqlite")     
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