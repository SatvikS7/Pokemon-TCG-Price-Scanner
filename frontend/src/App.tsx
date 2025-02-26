import { useEffect, useRef, useState } from "react";
import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<string>("");

  // Start the camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (error) {
      console.error("Error accessing the camera:", error);
    }
  };

  // Stop the camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Load the model and detect Pokémon cards
  const detectCard = async () => {
    if (!videoRef.current) return;

    const model = await mobilenet.load();
    console.log("Model loaded!");

    const interval = setInterval(async () => {
      if (videoRef.current) {
        const predictions = await model.classify(videoRef.current);
        console.log(predictions);

        if (predictions.length > 0) {
          setPrediction(predictions[0].className);
        }
      }
    }, 1000); // Detect every second

    return () => clearInterval(interval);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (isCameraActive) {
      detectCard();
    }
  }, [isCameraActive]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Pokémon Card Detector</h1>

      {/* Camera Controls */}
      <div>
        {isCameraActive ? (
          <button
            onClick={stopCamera}
            className="px-4 py-2 bg-red-500 text-white rounded-lg mr-4"
          >
            Stop Camera
          </button>
        ) : (
          <button
            onClick={startCamera}
            className="px-4 py-2 bg-green-500 text-white rounded-lg mr-4"
          >
            Start Camera
          </button>
        )}
      </div>

      {/* Live Camera Feed */}
      <div className="mt-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-xl shadow-lg"
        />
      </div>

      {/* Prediction Output */}
      {prediction && (
        <div className="mt-4">
          <h2 className="text-xl">Detected: {prediction}</h2>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

export default App;
