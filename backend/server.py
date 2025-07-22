from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from utils.price_cache import get_card_price
import utils.card_handler as card_handler
from ultralytics import YOLO
import numpy as np
import base64
import torch
import cv2
import logging
import os
import json

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "https://pokemon-tcg-price-scanner-1.onrender.com"],  # or ["*"] for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("database/best_v2.pt")
model.fuse()
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
model.to(device)

class CardRequest(BaseModel):
    name: str
    set_id: str

@app.post("/price/batch")
def get_prices(cards: List[CardRequest]):
    results = []
    for card in cards:
        key = f"{card.name}-{card.set_id}"
        try: 
            price = get_card_price(key, card.set_id)
        except Exception as e:
            price = 0.0
            logging.error(f"Error fetching price for {key}: {e}")
        results.append({
            "name": card.name,
            "set_id": card.set_id,
            "price": price
        })
    return results

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logging.info("WebSocket client connected.")
    try:
        while True:
            message = await websocket.receive_text()
            image_b64 = json.loads(message)["image"]
            if image_b64.startswith("data:image"):
                image_b64 = image_b64.split(",", 1)[1]

            image_bytes = base64.b64decode(image_b64)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            # Run inference
            match_info = card_handler.recognize_card_from_frame(frame, model, conf=0.85)
            match_info_m = card_handler.recognize_card_from_frame(frame, model, conf=0.85, flip=True)
            final_matches = []

            for i in range(len(match_info)):
                if match_info[i] and match_info_m[i]:
                    final_matches.append(
                        match_info[i] if match_info[i]['score'] <= match_info_m[i]['score'] else match_info_m[i]
                    )
                elif match_info_m[i]:
                    final_matches.append(match_info_m[i])
                else:
                    final_matches.append(match_info[i])

            await websocket.send_text(json.dumps(final_matches))
    except WebSocketDisconnect:
        logging.info("WebSocket client disconnected.")

@app.get("/")
def read_root():
    return {"status": "ok"}