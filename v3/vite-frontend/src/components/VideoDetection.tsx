import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";

interface CardInfo {
  name: string;
  set_id: string;
  score: number;
  image_url: string;
}

const ws = new WebSocket("ws://localhost:8765/ws");

function VideoDetection() {
  const webcamRef = useRef<Webcam>(null);
  const [recentDetections, setRecentDetections] = useState<CardInfo[][]>([]);
  const [topCards, setTopCards] = useState<CardInfo[]>([]);
  const [cardPrices, setCardPrices] = useState<Record<string, number>>({});  
  const [isCameraActive, setIsCameraActive] = useState(true);
  const awaitingResponse = useRef(false);

  useEffect(() => {
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

    const sorted = [...freqMap.values()].sort((a, b) => b.count - a.count);
    const topCards = sorted.map((entry) => entry.card);

    setTopCards(topCards);
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
    }, 150);

    return () => clearInterval(interval);
  }, [isCameraActive]);

  useEffect(() => {
    if (topCards.length === 0) return;

    const payload = topCards.map((card) => ({
      name: card.name,
      set_id: card.set_id,
    }));

    fetch("http://localhost:8000/price/batch", {
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

  const stopCamera = () => {
    setIsCameraActive(false);
    setRecentDetections([]);
    setTopCards([]);
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
