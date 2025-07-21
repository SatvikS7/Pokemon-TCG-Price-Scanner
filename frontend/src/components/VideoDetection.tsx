import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";

interface CardInfo {
  name: string;
  set_id: string;
  score: number;
  image_url: string;
}
const API_BASE = import.meta.env.VITE_API_URL;

const ws = new WebSocket(API_BASE+"ws");

function VideoDetection() {
  const webcamRef = useRef<Webcam>(null);
  const [recentDetections, setRecentDetections] = useState<CardInfo[][]>([]);
  const [topCards, setTopCards] = useState<CardInfo[]>([]);
  const [cardPrices, setCardPrices] = useState<Record<string, number>>({});  
  const [isCameraActive, setIsCameraActive] = useState(true);
  const awaitingResponse = useRef(false);
  const seenCards = useRef<Map<string, { count: number; lastFrame: number }>>(new Map());
  const confirmedCards = useRef<Set<string>>(new Set());
  const [totalPrice, setTotalPrice] = useState(0);
  const frameIndex = useRef(0);

  useEffect(() => {
    console.log(API_BASE+"ws");
    ws.onopen = () => console.log("✅ WebSocket connected");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      awaitingResponse.current = false;

      if (Array.isArray(data)) {
        setRecentDetections((prev) => [...prev, data].slice(-5));
      } else if (data?.name) {
        const cardList = [data];
        setRecentDetections((prev) => [...prev, cardList].slice(-5));
      }
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("🔌 WebSocket disconnected");
  }, []);

  useEffect(() => {
    if (recentDetections.length === 0) return;

    // Flatten and count most frequent card
    const allDetections = recentDetections.flat();
    const freqMap = new Map<string, { card: CardInfo; count: number }>();

    allDetections.forEach((card) => {
      const key = `${card.name}-${card.set_id}`;
      if (!freqMap.has(key)) {
        freqMap.set(key, { card, count: 1 });
      } else {
        freqMap.get(key)!.count += 1;
      }
    });

    const filtered = [...freqMap.values()].filter(({ count }) => count >= 3);
    const sorted = filtered.sort((a, b) => b.count - a.count);
    const maxCardsInFrame = Math.max(...recentDetections.map(frame => frame.length));
    const topN = sorted.slice(0, maxCardsInFrame).map((entry) => entry.card);

    setTopCards(topN);
  }, [recentDetections]);


  useEffect(() => {
    const interval = setInterval(() => {
      if (
        isCameraActive &&
        !awaitingResponse.current &&
        webcamRef.current &&
        ws.readyState === WebSocket.OPEN
      ) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          awaitingResponse.current = true;
          ws.send(JSON.stringify({ image: imageSrc }));
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isCameraActive]);

  // debugging logs
  /*
  useEffect(() => {
    console.log("Top cards updated:", topCards);
  }, [topCards]);

  useEffect(() => {
    console.log("recentDetections updated:", recentDetections);
  }, [recentDetections]);
  */

  useEffect(() => {
    if (topCards.length === 0) return;

    const payload = topCards.map((card) => ({
      name: card.name,
      set_id: card.set_id,
    }));

    fetch(`${API_BASE}price/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((prices) => {
        const newPrices: Record<string, number> = {};
        prices.forEach((card: { name: string; set_id: string; price: number }) => {
          const key = `${card.name}-${card.set_id}`;
          newPrices[key] = card.price;
        });
        setCardPrices(newPrices);
      })
      .catch((err) => {
        console.error("Price fetch error:", err);
      });
  }, [topCards]);

  useEffect(() => {
    if (topCards.length === 0) return;

    frameIndex.current += 1;

    const currFrame = frameIndex.current;
    const minConfirmFrames = 3;       // How many frames before a card is "confirmed"
    const forgetThreshold = 40;       // Frames after which a missing card can be re-counted

    for (const card of topCards) {
      const key = `${card.name}-${card.set_id}`;
      const record = seenCards.current.get(key);
      const price = cardPrices[key];

      // Skip if no price available
      if (price === undefined) {
        continue;
      }

      if (record) {        // Already seen before
        record.count += 1;
        record.lastFrame = currFrame;
      } else {        // First time seeing this card
        seenCards.current.set(key, { count: 1, lastFrame: currFrame });
      }

      // Promote to confirmed if seen enough times and not already counted
      if (!confirmedCards.current.has(key) && seenCards.current.get(key)!.count >= minConfirmFrames) {
        confirmedCards.current.add(key);
        if (price) {
          setTotalPrice((prev) => prev + price);
        }
      }
    }

    // Cleanup logic: allow cards to be re-counted after being gone
    for (const [key, value] of seenCards.current.entries()) {
      if (currFrame - value.lastFrame > forgetThreshold) {
        seenCards.current.delete(key);
        confirmedCards.current.delete(key);
      }
    }
  }, [topCards, cardPrices]);

  const stopCamera = () => {
    setIsCameraActive(false);
    setRecentDetections([]);
    setTopCards([]);
    setCardPrices({});
    seenCards.current.clear();
    confirmedCards.current.clear();
    setTotalPrice(0);
    frameIndex.current = 0;
    awaitingResponse.current = false;
  };

  const startCamera = () => {
    setIsCameraActive(true);
  };

  return (
    <div className="body">
      <main className="main-container">
        {/* Live Camera Feed */}
        <div className="video-section">
          {isCameraActive && (
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
            />
          )}
        </div>
        <div className="setting-container">
          <div className="button-container">
              <button
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`vid-button ${isCameraActive ? 'pause' : 'play'}`}
              >
                {isCameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>
            </div>
        </div>
        <h1>Recent Detections</h1>
        <h2>Total Price: ${totalPrice.toFixed(2)}</h2>
        <div className="processing-grid">
          {topCards.map((card, idx) => {
            const key = `${card.name}-${card.set_id}`;
            const price = cardPrices[key];
            return (
              <div key={idx}>
                <h2>{card.name}</h2>
                <p>Set ID: {card.set_id}</p>
                <p>Score: {card.score.toFixed(2)}</p>
                {price !== undefined ? (
                  <p>Price: ${price.toFixed(2)}</p>
                ) : (
                  <p>Loading price...</p>
                )}
                <img src={card.image_url} alt={card.name} width='200'/>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default VideoDetection;
