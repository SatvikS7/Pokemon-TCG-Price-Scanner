import { useEffect, useRef, useState } from "react";
import SetSelector from "./setSelector";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<string>("");
  // Uncomment for debugging
  const [capturedImage, setCapturedImage] = useState<string | null>(null);  // To hold the captured image
  const [label, setLabel] = useState<string | null>(null);
  const [confidenceBuffer, setConfidenceBuffer] = useState<number[]>([]);
  const [cardDetected, setCardDetected] = useState<boolean>(false);
  const [imageBuffer, setImageBuffer] = useState<Blob[]>([]);



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
    setConfidenceBuffer([]);
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

    // Convert the canvas to a base64 image string
    const imageData = canvas.toDataURL("image/jpeg");
    //Uncomment for debugging
    //setCapturedImage(imageData);  // Set captured image for display

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      setImageBuffer(prev => {
        const updated = [...prev, blob];
        if (updated.length > 10) updated.shift(); // keep last 10
        return updated;
      });

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const res = await fetch("http://localhost:3001/predict", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        const confidence = parseFloat(data.confidence);
          // Display returned annotated image
        if (data.annotated_image) {
          setCapturedImage(`data:image/jpeg;base64,${data.annotated_image}`);
        } else {
          setCapturedImage(imageData); 
        }

        setConfidenceBuffer((prev) => {
          const updated = [...prev, confidence];
          if (updated.length > 10) updated.shift(); // keep last 10 only
  
          const avg = updated.reduce((sum, val) => sum + val, 0) / updated.length;
          setPrediction(avg.toFixed(2));
          setLabel(avg >= 0.69 ? "Pokemon Card" : "Not a Pokemon Card");

          if(avg >= 0.69) { setCardDetected(true); } else { setCardDetected(false); }
  
          return updated;
        });      } catch (err) {
        console.error("Prediction request failed:", err);
      }
    }, "image/jpeg");
  };

  // Start prediction interval when camera is active and card is not detected
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isCameraActive && !cardDetected) {
      interval = setInterval(() => {
        captureAndSendFrame();
      }, 700);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, cardDetected]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (cardDetected && imageBuffer.length === 10) {
      console.log("10 images found");
      const formData = new FormData();
      imageBuffer.forEach((imgBlob, index) => {
        formData.append("images", imgBlob, `frame_${index}.jpg`);
      });
  
      fetch("http://localhost:3001/ocr", {
        method: "POST",
        body: formData,
      })
      .then(res => res.json())
      .then(data => {
        console.log("OCR Results:", data);
        // You can now use the OCR results for narrowing card candidates
      })
      .catch(err => console.error("OCR request failed", err));
    }
  }, [cardDetected, imageBuffer]);
  

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

      {/* Display Captured Image */}
      {capturedImage && (
        <div className="mt-4">
          <h2 className="text-xl">Captured Image:</h2>
          <img src={capturedImage} alt="Captured" className="border rounded-lg mt-2" />
        </div>
      )}

      {/* Display all images in the imageBuffer */}
      {imageBuffer.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl mb-2">Buffered Images:</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {imageBuffer.map((blob, index) => {
              const url = URL.createObjectURL(blob);
              return (
                <div key={index} className="border p-2 rounded-lg shadow">
                  <img src={url} alt={`Buffered ${index}`} className="rounded" />
                  <p className="text-center text-xs mt-1">Image {index + 1}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Prediction Output */}
      {prediction && (
        <div className="mt-4">
          <h2 className="text-xl">Detected: {prediction}</h2>
        </div>
      )}

      {/* Label Output */}
      {label && (
        <div className="text-lg font-semibold mt-4 text-white">
          Predicted Label: <span className="text-yellow-300">{label}</span>
        </div>
      )}

      {/* Rolling Confidence Buffer */}
      {confidenceBuffer.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl mb-2">Confidence Buffer:</h2>
          <div className="flex flex-wrap gap-2">
            {confidenceBuffer.map((conf, index) => (
              <div
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg shadow"
              >
                {conf.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}

      <SetSelector onSelect={(set) => {
        console.log("Selected set:", set);
        // Pass set.id or set.name to your card search logic
      }} />

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

export default App;

  // Use to display captured image
  //
  //{/* Display Captured Image */}
  //{capturedImage && (
  //  <div className="mt-4">
  //    <h2 className="text-xl">Captured Image:</h2>
  //    <img src={capturedImage} alt="Captured" className="border rounded-lg mt-2" />
  //  </div>
  //)}