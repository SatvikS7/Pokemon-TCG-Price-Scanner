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

# Demo
![](media/Card_Identification_Test.mp4)
