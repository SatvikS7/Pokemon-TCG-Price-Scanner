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

  // Capture current video frame and send to backend
  const captureAndSendFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const res = await fetch("http://localhost:3001/predict", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        setPrediction(data.prediction);
      } catch (err) {
        console.error("Prediction request failed:", err);
      }
    }, "image/jpeg");
  };

  // Start prediction interval when camera is active
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isCameraActive) {
      interval = setInterval(() => {
        captureAndSendFrame();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isCameraActive]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

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
