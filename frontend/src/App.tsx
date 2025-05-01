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
  const [processingStages, setProcessingStages] = useState<{
    gray?: string;
    blur?: string;
    edges?: string;
    dilated?: string;
    cropped?: string;
  }>({});



  // Start the camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
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
    setCardDetected(false);
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

        setProcessingStages({
          gray: data.gray && `data:image/jpeg;base64,${data.gray}`,
          blur: data.blur && `data:image/jpeg;base64,${data.blur}`,
          edges: data.edges && `data:image/jpeg;base64,${data.edges}`,
          dilated: data.dilated && `data:image/jpeg;base64,${data.dilated}`,
          cropped: data.cropped_image && `data:image/jpeg;base64,${data.cropped_image}`,
        });

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
      }, 150);
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
    <div className="body">
      <div className="header">
        <h1 className="text-2xl font-bold mb-4">Pokémon Card Detector</h1>
      </div>
      <main className="main-container">
        {/* Live Camera Feed */}
        <div className="video-section">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="video-feed"
          />
          <div className="setting-container">
            <SetSelector onSelect={(set) => {
              console.log("Selected set:", set);
              // Pass set.id or set.name to your card search logic
            }} />

            {/* Camera Controls*/}
            <div className="button-container">
              <button
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`vid-button ${isCameraActive ? 'pause' : 'play'}`}
              >
                {isCameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>
            </div>
          </div>
        </div>

        {/* Rolling Confidence Buffer */}
        {confidenceBuffer.length > 0 && (
          <div className="confidence-section">
            <div className="confidence-scroller">
              {confidenceBuffer.map((conf, index) => (
                <div key={index} className="confidence-item">
                  {conf.toFixed(2)}
                </div>
              ))}
            </div>


            {/* Prediction Output */}
            <div className="prediction-info">
              {prediction && <h2>Detected: {prediction}</h2>}

              {/* Label Output */}
              {label && (
                <p>
                  Predicted Label: <span className="highlight">{label}</span>
                </p>
              )}

            </div>
          </div>
        )}

        {/* Display Captured Image */}
        {capturedImage && (
          <div className="captured-section">
            <h2>Captured Image:</h2>
            <img src={capturedImage} alt="Captured" className="captured-img" />
          </div>
        )}

        {/* Image Processing Stages */}
        {Object.values(processingStages).some(Boolean) && (
          <div className="processing-grid">
            {processingStages.gray && (
              <div className="grid-item">
                <p>Grayscale</p>
                <img src={processingStages.gray} className="Grayscale" />
              </div>
            )}
            {processingStages.blur && (
              <div className="grid-item">
                <p>Blurred</p>
                <img src={processingStages.blur} className="Blurred" />
              </div>
            )}
            {processingStages.edges && (
              <div className="grid-item">
                <p>Edges</p>
                <img src={processingStages.edges} className="Edges" />
              </div>
            )}
            {processingStages.dilated && (
              <div className="grid-item">
                <p>Dilated</p>
                <img src={processingStages.dilated} className="Dilated" />
              </div>
            )}
            {processingStages.cropped && (
              <div className="grid-item">
                <p>Cropped</p>
                <img src={processingStages.cropped} className="Cropped" />
              </div>
            )}
          </div>
        )}
      </main>
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