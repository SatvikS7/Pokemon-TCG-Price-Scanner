# Pokemon TCG Price Scanner
Real-time webcam-based Pokémon card detection with live price lookups using TCGPlayer. <br>
The site is live at [THIS LINK](https://pokemon-tcg-price-scanner-1.onrender.com). Note that this is served on Render's free plan, so there is a lack of compute power for the service and is essentially unusable. <br>

UPDATE (11/3/25): The PokemonTCG API has recently updated its services to be fully paid for its v3 API. This app currently runs on the v2 API, which has been deprecated and has no further support, so this app effectively no longer works. I do have plans to revisit this at a future date, but that is TBD. 

# Features
- Real-time webcam detection (YOLOv11-seg)
- Multi-card support
- Confidence filtering & debounced display
- Price lookup from TCGPlayer with caching (LRU)
- WebSocket-powered backend for fast frame streaming
- FastAPI server for efficient batch price queries
- Image hashing for robust card matching

# Demo + How it works
The demo showcased below highlights the core card recognition and matching functionality implemented entirely with Python and OpenCV. Each incoming frame is analyzed in real time by a segmentation model to determine whether any Pokémon cards are present. When detected, the model returns a bounding box, segmentation mask, and confidence score, all of which are visually overlaid on the original frame to aid interpretability.

Once a card is confirmed in the frame, OpenCV is used to extract and isolate the card from the background using the mask. To ensure consistency during downstream matching, a perspective transform is applied to correct for any skew or rotation in the camera's viewpoint—effectively normalizing the card’s orientation. These rectified card views are rendered live in separate display windows titled "Card #", allowing visual inspection of the transformed inputs.

For identification, the rectified card images are hashed using perceptual hashing, and a Hamming distance comparison is performed against a local database of known cards. The closest match is displayed in the "DB Card" window.

While the demo may appear visually laggy due to the high number of simultaneously rendered OpenCV windows (main camera, annotated frames, individual cards, and matched database entries), the underlying recognition pipeline performs efficiently in real-time conditions, free of UI overhead.

![Card_Identification_Test](media/Card_Identification_Test.gif)

Below is a demo of the website in development. The service is built on a decoupled frontend-backend architecture to ensure scalability, responsiveness, and clear separation of concerns. The frontend, built with React and TypeScript, is responsible for interfacing with the user's webcam, capturing video frames, and managing the display of identified cards and their prices. It leverages WebSockets to stream selected frames in near real-time to the backend, minimizing latency compared to traditional HTTP polling.

On the backend, a combination of FastAPI and Python WebSocket servers powers the system's core logic. The WebSocket server handles incoming frame data and performs inference using YOLOv8-seg, while FastAPI provides a REST endpoint (```/price/batch```) for efficient batch price lookups.

To ensure high throughput and low latency, several performance features are integrated (briefly mentioned in the [Features](#Features) section) :
- Batching: When multiple cards are detected in a frame, their price data is fetched in a single API request, reducing overhead and API throttling issues.
- LRU Caching with TTL: Prices for previously seen cards are cached using an in-memory LRU (Least Recently Used) cache with expiration to prevent redundant API calls and reduce external dependency load.
- Debouncing & Confirmation Logic: A multi-frame frequency tracking system filters out short-lived or incorrect identifications. Only cards that persist across multiple frames are considered confirmed and displayed, improving visual consistency and price accuracy.
- Concurrency: The backend handles concurrent WebSocket sessions and API requests with asyncio, allowing smooth operation even under load.
- Hashed Image Lookup: Instead of relying solely on OCR or text metadata, the backend uses perceptual image hashing to quickly match cards to existing known examples with low computational cost.
Together, these design choices create a robust, real-time application that remains performant even when processing a continuous stream of data under fluctuating conditions.

![Website_Demo](media/Website_Demo.gif)

# Tech Stack
- Frontend: React, TypeScript, react-webcam, WebSocket
- Backend: Python, FastAPI, WebSockets, OpenCV
- ML Model: YOLOv11-seg (Ultralytics)
- APIs: PokemonTCG

# Folder Structure
backend/ <br>
&nbsp;&nbsp;├── server.py &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# FastAPI app to handle websocket connection, frame processing, card matching, and price fetching  <br>
&nbsp;&nbsp;└── utils/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Utility functions <br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── card_handler.py &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Handles processing from frame to matched cards  <br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── price_cache.py &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Handles TTLCache and does api calls to PokémonTCG <br>
&nbsp;&nbsp;└── databse &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Folder for database and model storage <br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── pokemon_hash_dp.sqlite &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Stores phash and dhash for every Pokemon card <br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── model.pt &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Custom-trained YOLO segmentation model <br>
frontend/<br>
&nbsp;&nbsp;└── src/           
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── App.tsx &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Contains shared elements for all pages<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── app.css &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# All stylings for the website<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── main.tsx &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Root of website<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── Componenets/<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── LandingPage.tsx &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Landing page of the website to navigate to other pages<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── PhotoDetection.tsx &nbsp;&nbsp;&nbsp;&nbsp;# TODO, future feature to upload photos of cards<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── VideoDetection.tsx &nbsp;&nbsp;&nbsp;&nbsp;# Contains all logic for live scanning + api calls to backend<br>

# How to use
TODO

# Future Improvements
In the future, I plan to implement a user authentication system that allows individual accounts, enabling users to maintain a history of scanned cards and associated price data. A longer-term objective is the integration of a PSA grade prediction system. PSA grading assigns a numerical score from 1 to 10 to evaluate a card's condition, with 10 representing a gem mint state. These grades significantly influence a card's market value. Giving users an option to estimate the grade of a card before paying money to send it to a grading service is a powerful tool that can save money for all Pokémon collectors.

# License
MIT License

Copyright (c) 2025 Satvik Sriram

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
