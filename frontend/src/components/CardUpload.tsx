import React, { useEffect, useState } from "react";

export interface CardUploadProps {
  apiLink: string;
  confidenceThreshold?: number;
  setID: string | null;
}

const CardUpload: React.FC<CardUploadProps> = ({
  apiLink,
  confidenceThreshold = 0.9,
  setID,
}) => {
  // Local state for preview, errors, and OCR response
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOcrData, setUploadOcrData] = useState<any | null>(null);
  const [cardData, setCardData] = useState<any[]>([]);
  const [processingStages, setProcessingStages] = useState<{
    gray?: string;
    blur?: string;
    edges?: string;
    dilated?: string;
    cropped?: string;
    card_number?: string;
    card_number_text?: string;
  }>({});

    const [usdPrice, setUsdPrice] = useState<string | null>(null);

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

    const previewURL = URL.createObjectURL(file);
    setUploadedPreview(previewURL);

    const predictForm = new FormData();
    predictForm.append("file", file, file.name);

    try {
      const predictRes = await fetch(`${apiLink}/predict`, {
        method: "POST",
        body: predictForm,
      });
      if (!predictRes.ok) {
        throw new Error(`Predict endpoint returned ${predictRes.status}`);
      }
      const data = await predictRes.json();

      setProcessingStages({
        gray: data.gray && `data:image/jpeg;base64,${data.gray}`,
        blur: data.blur && `data:image/jpeg;base64,${data.blur}`,
        edges: data.edges && `data:image/jpeg;base64,${data.edges}`,
        dilated: data.dilated && `data:image/jpeg;base64,${data.dilated}`,
        cropped: data.cropped_image && `data:image/jpeg;base64,${data.cropped_image}`,
        card_number: data.card_number && `data:image/jpeg;base64,${data.card_number}`,
      });

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
      if (parseInt(ocrRes) > 300) { 
        ocrRes = ocrRes.substring(0, 2)
      }
      setUploadOcrData(data.card_number_text.split('/')[0]);      
      console.log("OCR Result:", ocrRes);
      const set = setID ? setID : "";
      
      fetchCardData(set, ocrRes)
        .then(data => {
          setCardData(data);
        })
        .catch(err => console.error("Failed to fetch:", err));
      console.log("Card Data:", data);
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
    setUploadOcrData(null);
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
    <div style={{ marginBottom: "1.5rem" }}>
      {/* ──── DROPZONE BOX ──── */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: "2px dashed #555",
          borderRadius: "8px",
          padding: "1rem",
          textAlign: "center",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => {
          const inputEl = document.getElementById("cardFileInput");
          if (inputEl) (inputEl as HTMLInputElement).click();
        }}
      >
        <input
          id="cardFileInput"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
        <p>Drag &amp; drop a card image here, or click to select a file</p>

        {uploadedPreview && (
          <div style={{ marginTop: "1rem" }}>
            <img
              src={uploadedPreview}
              alt="preview"
              style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "4px" }}
            />
            <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#ff4d4f",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Remove Image
          </button>
          </div>
        )}

        {uploadError && (
          <p style={{ color: "red", marginTop: "0.5rem" }}>{uploadError}</p>
        )}

        {uploadOcrData && (
          <div style={{ marginTop: "1rem", textAlign: "left" }}>
            <h3>Price of Card (in USD): ${usdPrice}</h3>
          </div>
        )}
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
  );
};

export default CardUpload;
