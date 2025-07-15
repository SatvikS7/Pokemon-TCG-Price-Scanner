import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";

const ws = new WebSocket("ws://localhost:8765/ws"); // Adjust to your server

function App() {
  const webcamRef = useRef(null);
  const [cardInfo, setCardInfo] = useState(null);
  const awaitingResponse = useRef(false);

  useEffect(() => {
    ws.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      awaitingResponse.current = false;

      if (Array.isArray(data)) {
        setCardInfo(data);
      } else if (data.name) {
        setCardInfo([data]);
      } else {
        setCardInfo(null); // no match
      }
    };

    ws.onerror = (err) => {
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

    const interval = setInterval(sendFrame, 100); // adjustable (100–300ms)
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Pokémon Card Detector</h1>
      <Webcam ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{
        facingMode: "user" // "user" = front camera, "environment" = rear camera
      }}/>
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
