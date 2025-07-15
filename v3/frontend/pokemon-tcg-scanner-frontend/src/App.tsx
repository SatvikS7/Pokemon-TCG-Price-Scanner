import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";

// TypeScript interface for card match info
interface CardMatch {
  name: string;
  set_id: string;
  image_url: string;
  score: number;
}

const ws = new WebSocket("ws://localhost:8765/ws"); // Adjust to your server

function App(): JSX.Element {
  const webcamRef = useRef<Webcam>(null);
  const [cardInfo, setCardInfo] = useState<CardMatch[] | null>(null);
  const awaitingResponse = useRef<boolean>(false);

  useEffect(() => {
    ws.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      awaitingResponse.current = false;

      if (Array.isArray(data)) {
        setCardInfo(data as CardMatch[]);
      } else if (data.name) {
        setCardInfo([data as CardMatch]);
      } else {
        setCardInfo(null); // no match
      }
    };

    ws.onerror = (err: Event) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };
  }, []);

  useEffect(() => {
    const sendFrame = () => {
      if (
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
    };

    const interval = setInterval(sendFrame, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Pokémon Card Detector</h1>
      <Webcam
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "user" }}
      />
      {cardInfo && cardInfo.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {cardInfo.map((card, idx) => (
            <div key={idx}>
              <h2>{card.name}</h2>
              <p>Set ID: {card.set_id}</p>
              <p>Score: {card.score.toFixed(2)}</p>
              <img src={card.image_url} alt={card.name} width="200" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
