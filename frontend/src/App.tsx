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
  const [ocrTriggered, setOcrTriggered] = useState<boolean>(false);
  const [ocrNumTriggered, setOcrNumTriggered] = useState<boolean>(false);
  const [cardNameBuffer, setCardNameBuffer] = useState<Blob[]>([]);
  const [cardNumberBuffer, setCardNumberBuffer] = useState<Blob[]>([]);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [majorityVoteName, setMajorityVoteName] = useState<string | null>(null);
  const [majorityVoteHp, setMajorityVoteHp] = useState<string | null>(null);
  const [cardResults, setCardResults] = useState<any[]>([]);
  //const [imageBuffer, setImageBuffer] = useState<Blob[]>([]);
  const [processingStages, setProcessingStages] = useState<{
    gray?: string;
    blur?: string;
    edges?: string;
    dilated?: string;
    cropped?: string;
    card_name?: string;
    card_number?: string;
  }>({});

  // Environment variables
  const apiLink = import.meta.env.VITE_API_LINK;

  const IMAGE_BUFFER_SIZE = 10;
  const CONFIDENCE = 0.9;

  // Helper Functions
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
    setOcrTriggered(false);
    setOcrNumTriggered(false);
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
      /*
      setImageBuffer(prev => {
        const updated = [...prev, blob];
        if (updated.length > IMAGE_BUFFER_SIZE) updated.shift();
        return updated;
      });*/

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      try {
        const res = await fetch(`${apiLink}/predict`, {
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
          card_name: data.card_name && `data:image/jpeg;base64,${data.card_name}`,
          card_number: data.card_number && `data:image/jpeg;base64,${data.card_number}`,
        });

        if (data.card_name) {
          const cardNameBlob = base64ToBlob(data.card_name);
          updateBuffer(setCardNameBuffer, cardNameBlob, IMAGE_BUFFER_SIZE);
        }

        if (data.card_number) {
          const cardNumberBlob = base64ToBlob(data.card_number);
          updateBuffer(setCardNumberBuffer, cardNumberBlob, IMAGE_BUFFER_SIZE);
        }

        setConfidenceBuffer((prev) => {
          const updated = [...prev, confidence];
          if (updated.length > IMAGE_BUFFER_SIZE) updated.shift();
  
          const avg = updated.reduce((sum, val) => sum + val, 0) / updated.length;
          setPrediction(avg.toFixed(2));
          setLabel(avg >= CONFIDENCE ? "Pokemon Card" : "Not a Pokemon Card");

          if(avg >= CONFIDENCE) { setCardDetected(true); } else { setCardDetected(false); }
  
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
      }, 250);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, cardDetected]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (cardDetected && cardNameBuffer.length === IMAGE_BUFFER_SIZE && !ocrTriggered) {
      console.log(`${IMAGE_BUFFER_SIZE} images found`);
      setOcrTriggered(true);

      const formData = new FormData();
      cardNameBuffer.forEach((imgBlob, index) => {
        formData.append("images", imgBlob, `card_name_frame_${index}.jpg`);
      });
  
      fetch(`${apiLink}/ocr`, {
        method: "POST",
        body: formData,
      })
      .then(res => res.json())
      .then(data => { 
        console.log("OCR Results:", data);
        setMajorityVoteName(data.majority_vote.name); 
        setMajorityVoteHp(data.majority_vote.hp);
        // You can now use the OCR results for narrowing card candidates
      })
      .catch(err => console.error("OCR request failed", err));
    }
  }, [cardDetected, cardNameBuffer]);

  useEffect(() => {
    if (cardDetected && cardNumberBuffer.length === IMAGE_BUFFER_SIZE && !ocrNumTriggered) {
      console.log(`${IMAGE_BUFFER_SIZE} images found`);
      setOcrNumTriggered(true);

      const formData = new FormData();
      cardNumberBuffer.forEach((imgBlob, index) => {
        formData.append("images", imgBlob, `card_number_frame_${index}.jpg`);
      });
  
      fetch(`${apiLink}/ocr`, {
        method: "POST",
        body: formData,
      })
      .then(res => res.json())
      .then(data => { 
        console.log("OCR Results:", data);
      })
      .catch(err => console.error("OCR request failed", err));
    }
  }, [cardDetected, cardNumberBuffer]);

    const fetchCardData = async (
      pokemonName: string,
      hp: string,
      setId: string
    ) => {
      const query = encodeURIComponent(`name:"${pokemonName}" hp:${hp} set.id:${setId}`);
      const url = `https://api.pokemontcg.io/v2/cards?q=${query}`;
      console.log("Fetching card data from URL:", url);
    
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch card data");
    
      const data = await res.json();
      return data.data;  
    };
  

  useEffect(() => {
    if (majorityVoteName && majorityVoteHp && selectedSet) {
      fetchCardData(majorityVoteName, majorityVoteHp, selectedSet)
        .then(data => {
          setCardResults(data);
        })
        .catch(err => console.error("Failed to fetch:", err));
    }
  }, [majorityVoteName, majorityVoteHp, selectedSet]);

  useEffect(() => {
    if (cardResults) {
      console.log("Updated cardResults:", cardResults);
    }
  }, [cardResults]);
  

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
            {processingStages.card_name && (
              <div className="grid-item">
                <p>Card Name</p>
                <img src={processingStages.card_name} className="Name" />
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