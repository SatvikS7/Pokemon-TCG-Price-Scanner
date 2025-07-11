import asyncio
import websockets
import base64
import json
import numpy as np
import cv2
from ultralytics import YOLO
import torch
import util  

# Load YOLO model and move to GPU if available
model = YOLO("../models/best_v2.pt")
model.fuse()
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
model.to(device)

async def handle_connection(websocket):
    print("Client connected.")
    try:
        async for message in websocket:
            # Assume message is base64-encoded JPEG frame
            image_b64 = json.loads(message)["image"]
            if image_b64.startswith("data:image"):
                image_b64 = image_b64.split(",", 1)[1]

            image_bytes = base64.b64decode(image_b64)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            # Run inference
            match_info = util.recognize_card_from_frame(frame, model, conf=0.85)
            match_info_m = util.recognize_card_from_frame(frame, model, conf=0.85, flip=True)
            final_matches = []
            # Choose the match_info with the better score
            for i in range(len(match_info)):
                if match_info[i] and match_info_m[i]:
                    if match_info[i]['score'] <= match_info_m[i]['score']:
                        final_matches.append(match_info[i])
                    else:
                        final_matches.append(match_info_m[i])
                elif match_info_m[i]:
                    final_matches.append(match_info_m[i])
                else:
                    final_matches.append(match_info[i])
            await websocket.send(json.dumps(final_matches))
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected.")

async def main():
    async with websockets.serve(handle_connection, "0.0.0.0", 8765):
        print("WebSocket server running on ws://0.0.0.0:8765")
        await asyncio.Future()  


if __name__ == "__main__":
    asyncio.run(main())