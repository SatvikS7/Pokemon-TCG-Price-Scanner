import React, { useEffect, useState } from "react";
import SetSelector from "./setSelector";  

export interface PhotoDetectionProps {
  apiLink: string;
  confidenceThreshold?: number;
  debugMode: boolean;
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


const PhotoDetection: React.FC<PhotoDetectionProps> = ({
  apiLink,
  confidenceThreshold = 0.9,
  debugMode,
}) => {
  // Local state for preview, errors, and OCR response
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOcrData, setUploadOcrData] = useState<any | null>(null);
  const [cardData, setCardData] = useState<any[]>([]);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [processingStages, setProcessingStages] = useState<ProcessingStages>({});
  const [usdPrice, setUsdPrice] = useState<string | null>(null);
  const [setSize, setSetSize] = useState<number>(0);

  const convert = (from: string, to: string, amount: number) => {
    fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
      .then((resp) => resp.json())
      .then((data) => {
        const convertedAmount = (amount * data.rates[to]).toFixed(2);
        setUsdPrice(convertedAmount);
      })
      .catch(err => console.error("Conversion failed:", err));
  };


  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploadOcrData(null);
    setProcessingStages({});
    setCardData([]);
    setUploadedPreview(null);
    setUsdPrice(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file.");
      return;
    }

    const previewURL = URL.createObjectURL(file);
    setUploadedPreview(previewURL);

    const predictForm = new FormData();
    predictForm.append("file", file, file.name);

    try {
      const predictRes = await fetch(`${apiLink}/predict?debug=${debugMode}`, {
        method: "POST",
        body: predictForm,
      });
      if (!predictRes.ok) {
        throw new Error(`Predict endpoint returned ${predictRes.status}`);
      }
      const data = await predictRes.json();

      const stages: ProcessingStages = {};
      if (debugMode) {
        if (data.gray) stages.gray = `data:image/jpeg;base64,${data.gray}`;
        if (data.blur) stages.blur = `data:image/jpeg;base64,${data.blur}`;
        if (data.edges) stages.edges = `data:image/jpeg;base64,${data.edges}`;
        if (data.dilated) stages.dilated = `data:image/jpeg;base64,${data.dilated}`;
        if (data.card_number)
          stages.card_number = `data:image/jpeg;base64,${data.card_number}`;
      }
      if (data.cropped_image) {
        stages.cropped = `data:image/jpeg;base64,${data.cropped_image}`;
      }

      setProcessingStages(stages);

      const confidence = parseFloat(data.confidence);
      if (confidence < confidenceThreshold) {
        setUploadError(
          "Low confidence (< " +
            confidenceThreshold +
            ") - this might not be a Pokémon card."
        );
        return;
      }

      let ocrRes = data.card_number_text.split('/')[0];
      if (ocrRes.length >= 3) {
        ocrRes = ocrRes.substring(0, 3);
      } 
      if (parseInt(ocrRes) > setSize) { 
        ocrRes = ocrRes.substring(0, 2)
      }
      setUploadOcrData(ocrRes);      
      console.log("OCR Result:", ocrRes);
      const set = selectedSet ? selectedSet : "";
      if(ocrRes) {
        fetchCardData(set, ocrRes)
          .then(data => {
            setCardData(data);
          })
          .catch(err => console.error("Failed to fetch:", err));
          //console.log("Card Data:", data);
      } else {
        setUploadError("No card number detected. Please try another image.");
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Unknown error during upload workflow.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUploadError(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) {
      setUploadError("Please drop a valid image file.");
      return;
    }
    handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file.");
      return;
    }
    handleFileUpload(file);
  };

  const handleRemoveImage = () => {
    setUploadedPreview(null);
    setUploadError(null);
    setCardData([]);
    setUsdPrice(null);
    setProcessingStages({});
  };

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

    useEffect(() => {
      if (cardData.length != 0) {
        console.log("Euro Price:", cardData[0].cardmarket.prices.avg30);
      }
    }, [cardData]);

    useEffect(() => {
      if (cardData.length !== 0) {
        const euroPrice = cardData[0]?.cardmarket?.prices?.avg30;
        if (euroPrice) {
          convert("EUR", "USD", euroPrice);
        }
      }
    }, [cardData]);

    

  return (
    <div className="body">
      <main className="main-container">
        <div className="photo-upload-container">
          {/* ──── DROPZONE BOX ──── */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="dropzone-box"

            onClick={() => {
              const inputEl = document.getElementById("cardFileInput");
              if (inputEl) (inputEl as HTMLInputElement).click();
            }}
          >
            <input
              id="cardFileInput"
              type="file"
              accept="image/*"
              className="hidden-file-input"
              onChange={handleFileInputChange}
            />
            <p>Drag &amp; drop a card image here, or click to select a file</p>
            {uploadedPreview && (
              <div className="preview-container">
                <img
                  src={uploadedPreview}
                  alt="preview"
                  className="preview-image"
                />
                <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage();
                }}
                className="remove-button"
              >
                Remove Image
              </button>
              </div>
            )}

            {uploadError && (
              <p className="error-text">{uploadError}</p>
            )}

            {uploadOcrData && (
              <div className="price-container">
                <h3>Price of Card (in USD): ${usdPrice}</h3>
              </div>
            )}
          </div>
          <div className="setting-container">
            <SetSelector onSelect={(set) => {
              console.log("Selected set:", set);
              setSelectedSet(set.id);
              setSetSize(set.total);
              console.log("Set Size:", set.total);  
            }} />
          </div>
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

        </div>
      </main>
    </div>
  );
};

export default PhotoDetection;
