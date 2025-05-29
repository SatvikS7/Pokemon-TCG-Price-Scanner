import { useEffect, useRef, useState } from "react";
import SetSelector from "./setSelector";

export interface VideoDetectionProps {
  debugMode: boolean;
  confidenceThreshold?: number;
  apiLink: string;
}

interface ProcessingStages {
  gray?: string;
  blur?: string;
  edges?: string;
  dilated?: string;
  cropped?: string;
  card_number?: string;
  card_number_text?: string;
}


const VideoDetection: React.FC<VideoDetectionProps> = ({ 
    debugMode, 
    confidenceThreshold = 0.9,
    apiLink 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);  
  const [label, setLabel] = useState<string | null>(null);
  const [confidenceBuffer, setConfidenceBuffer] = useState<number[]>([]);
  const [cardDetected, setCardDetected] = useState<boolean>(false);
  const [cardNumberBuffer, setCardNumberBuffer] = useState<Blob[]>([]);
  const [cardNumberTextBuffer, setCardNumberTextBuffer] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [majorityVoteSetNum, setMajorityVoteSetNum] = useState<string | null>(null);
  const [cardResults, setCardResults] = useState<any[]>([]);
  const [processingStages, setProcessingStages] = useState<ProcessingStages>({});
  const [usdPrice, setUsdPrice] = useState<string | null>(null);


  // Environment variables
  const IMAGE_BUFFER_SIZE = 10;

  // Helper Functions
  const convert = (from: string, to: string, amount: number) => {
    fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
      .then((resp) => resp.json())
      .then((data) => {
        const convertedAmount = (amount * data.rates[to]).toFixed(2);
        setUsdPrice(convertedAmount);
      })
      .catch(err => console.error("Conversion failed:", err));
  };

  function base64ToBlob(base64String: string, mimeType: string = "image/jpeg"): Blob {
    const byteString = atob(base64String);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    return new Blob([uint8Array], { type: mimeType });
  }

  function updateBuffer(setter: React.Dispatch<React.SetStateAction<Blob[]>>, blob: Blob, maxSize: number): void {
    setter((prev) => {
      const updated = [...prev, blob];
      if (updated.length > maxSize) updated.shift();
      return updated;
    });
  }

  function updateTextBuffer(text: string) {
    setCardNumberTextBuffer((prev) => {
      const updated = [...prev, text];
      if (updated.length > IMAGE_BUFFER_SIZE) updated.shift();
      return updated;
    });
  }

  function majorityVoteString(arr: string[]): string | null {
    const count: Record<string, number> = {};
    for (const item of arr) {
      if (!item) continue; 
      count[item] = (count[item] || 0) + 1;
    }
    let top: string | null = null;
    let maxCount = 0;
    for (const [key, val] of Object.entries(count)) {
      if (val > maxCount) {
        maxCount = val;
        top = key;
      }
    }
    return top;
  }

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
    setIsCameraActive(false);
    setConfidenceBuffer([]);
    setCardDetected(false);
    setCardNumberBuffer([]);
    setProcessingStages({});
    setPrediction("");
    setLabel("");
    setCardResults([]);
    setUsdPrice(null);;
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

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const res = await fetch(`${apiLink}/predict?debug=${debugMode}`, {
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

        const stages: ProcessingStages = {};
        if (debugMode) {
          if (data.gray) stages.gray = `data:image/jpeg;base64,${data.gray}`;
          if (data.blur) stages.blur = `data:image/jpeg;base64,${data.blur}`;
          if (data.edges) stages.edges = `data:image/jpeg;base64,${data.edges}`;
          if (data.dilated) stages.dilated = `data:image/jpeg;base64,${data.dilated}`;
          if (data.card_number) stages.card_number = `data:image/jpeg;base64,${data.card_number}`;
        }
        if (data.cropped_image) {
          stages.cropped = `data:image/jpeg;base64,${data.cropped_image}`;
        }
        setProcessingStages(stages);

        if (data.card_number) {
          const cardNumberBlob = base64ToBlob(data.card_number);
          updateBuffer(setCardNumberBuffer, cardNumberBlob, IMAGE_BUFFER_SIZE);
        }

        if (data.card_number_text) {
          let ocrRes = data.card_number_text.split('/')[0];
          if (ocrRes.length >= 3) ocrRes = ocrRes.substring(0, 3);
          if (parseInt(ocrRes) > 300) ocrRes = ocrRes.substring(0, 2)
          updateTextBuffer(ocrRes);
        } else {
          updateTextBuffer("");
        }

        setConfidenceBuffer((prev) => {
          const updated = [...prev, confidence];
          if (updated.length > IMAGE_BUFFER_SIZE) updated.shift();
  
          const avg = updated.reduce((sum, val) => sum + val, 0) / updated.length;
          setPrediction(avg.toFixed(2));
          setLabel(avg >= confidenceThreshold ? "Pokemon Card" : "Not a Pokemon Card");
          setCardDetected(avg >= confidenceThreshold);
          return updated;
        });      
      } catch (err) {
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
      }, 250);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, cardDetected]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const fetchCardData = async (
    setId: string,
    setNum: string
  ) => {
    const query = encodeURIComponent(`set.id:${setId} number:${setNum}`);
    const url = `https://api.pokemontcg.io/v2/cards?q=${query}`;
    console.log("Fetching card data from URL:", url);
  
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch card data");
  
    const data = await res.json();
    return data.data;  
  };
  
  /*
  useEffect(() => {
    if (majorityVoteSetNum && selectedSet) {
      fetchCardData(selectedSet, majorityVoteSetNum)
        .then(data => {
          setCardResults(data);
        })
        .catch(err => console.error("Failed to fetch:", err));
    }
  }, [selectedSet, majorityVoteSetNum]);
*/
  useEffect(() => {
    if (cardDetected && cardNumberTextBuffer.length === IMAGE_BUFFER_SIZE && selectedSet) {
      const votedSetNum = majorityVoteString(cardNumberTextBuffer);
      console.log("Card number text buffer:", cardNumberTextBuffer);
      console.log("Majority‐voted set ID:", votedSetNum);
      if (votedSetNum) {
        fetchCardData(selectedSet, votedSetNum).catch((err) =>
          console.error("Failed to fetch card data:", err)
        );
      }
    }
  }, [cardDetected, cardNumberTextBuffer, selectedSet]);

  useEffect(() => {
    if (cardResults.length > 0) {
      const euroPrice = cardResults[0]?.cardmarket?.prices?.avg30;
      if (euroPrice) {
        convert("EUR", "USD", euroPrice);
      }
    }
  }, [cardResults]);

  return (
    <div className="body">
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
              setSelectedSet(set.id);
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
            {processingStages.card_number && (
              <div className="grid-item">
                <p>Card Number</p>
                <img src={processingStages.card_number} className="Number" />
              </div>
            )}
          </div>
        )}

        {/* Display Final 10 Card Number Images */}
        {cardDetected && cardNumberBuffer.length === IMAGE_BUFFER_SIZE && (
          <div className="captured-section">
            <h2>Final 10 Card Number Images:</h2>
            <div className="processing-grid">
              {cardNumberBuffer.map((blob, index) => (
                <div key={index} className="grid-item">
                  <p>image_{index + 1}.png</p>
                  <img src={URL.createObjectURL(blob)} alt={`image_${index + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

export default VideoDetection;