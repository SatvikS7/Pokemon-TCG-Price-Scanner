import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";

const ws = new WebSocket("ws://localhost:8765/ws"); // Adjust to your server

function App() {
  const webcamRef = useRef(null);
  const [cardInfo, setCardInfo] = useState(null);

  useEffect(() => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (Array.isArray(data)) {
        setCardInfo(data); 
      } else if (data.name) {
        setCardInfo([data]); 
      }
    };
  }, []);

  // Send frame every 200ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ image: imageSrc }));
        }
      }
    }, 200);
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
