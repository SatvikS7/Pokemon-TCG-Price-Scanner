# Pokemon TCG Price Scanner
Real-time webcam-based Pokémon card detection with live price lookups using TCGPlayer.

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
backend/
  ├── server.py            # WebSocket for frame processing
  ├── api.py               # FastAPI for price lookup
  └── utils/               # Utility functions
      ├── card_handler.py  # Handles processing from frame to matched cards 
      └── price_cache.py   # Handles TTLCache and does api calls to PokémonTCG
frontend/
  └── src/            
      ├── App.tsx          # Contains shared elements for all pages
      ├── app.css          # All stylings for the website
      ├── main.tsx         # Root of website
      └── Componenets/
          ├── LandingPage.tsx     # Landing page of the website to navigate to other pages
          ├── PhotoDetection.tsx  # TODO, future feature to upload photos of cards
          └── VideoDetection.tsx  # Contains all logic for live scanning + api calls to backend

# How to use
TODO

# Future Improvements
This service is currently under active development, with plans for deployment to a production environment in the near future. Ongoing improvements include more robust tracking of the cumulative card price total, as the current implementation may yield inconsistent results (as of 7/16). Additionally, a user authentication system is planned, enabling individual accounts where users can maintain a history of scanned cards and associated price data.

A longer-term objective is the integration of a PSA grade prediction system. PSA grading assigns a numerical score from 1 to 10 to evaluate a card's condition, with 10 representing a gem mint state. These grades significantly influence a card's market value. Giving users an option to estimate the grade of a card before paying money to send it to a grading service is a powerful tool that can save money for all Pokémon collectors.

# License
