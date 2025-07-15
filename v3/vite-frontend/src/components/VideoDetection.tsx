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
  const [cardInfo, setCardInfo] = useState<CardInfo[] | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const awaitingResponse = useRef(false);

  useEffect(() => {
    ws.onopen = () => console.log("✅ WebSocket connected");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      awaitingResponse.current = false;

      if (Array.isArray(data)) {
        setCardInfo(data);
      } else if (data.name) {
        setCardInfo([data]);
      } else {
        setCardInfo(null);
      }
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("🔌 WebSocket disconnected");
  }, []);

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

  const stopCamera = () => {
    setIsCameraActive(false);
    setCardInfo(null);
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
        <div className="confidence-section">
          <div className="prediction-info">
            {cardInfo?.map((card, idx) => (
              <div key={idx}>
                <h2>{card.name}</h2>
                <p>Set ID: {card.set_id}</p>
                <p>Score: {card.score.toFixed(2)}</p>
                <img src={card.image_url} alt={card.name} width="200" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default VideoDetection;
