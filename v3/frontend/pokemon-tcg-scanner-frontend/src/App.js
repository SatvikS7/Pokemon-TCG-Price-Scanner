import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";

const ws = new WebSocket("ws://localhost:8765/ws"); // Adjust to your server

function App() {
  const webcamRef = useRef(null);
  const [cardInfo, setCardInfo] = useState(null);

  useEffect(() => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.name) {
        setCardInfo(data);
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
      {cardInfo && (
        <div style={{ marginTop: 20 }}>
          <h2>{cardInfo.name}</h2>
          <p>Set ID: {cardInfo.set_id}</p>
          <p>Score: {cardInfo.score.toFixed(2)}</p>
          <img src={cardInfo.image_url} alt={cardInfo.name} width="200" />
        </div>
      )}
    </div>
  );
}

export default App;
