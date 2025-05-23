import React, { useState } from "react";

// Helper to convert a base64 JPEG string into a Blob
function base64ToBlob(base64String: string, mimeType: string = "image/jpeg"): Blob {
  const byteString = atob(base64String);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  return new Blob([uint8Array], { type: mimeType });
}

export interface CardUploadProps {
  /** The base URL for your backend (e.g., "http://localhost:5000" or env var). */
  apiLink: string;
  /** Confidence threshold (e.g. 0.9). If /predict returns confidence < this, show error. */
  confidenceThreshold?: number;
}

const CardUpload: React.FC<CardUploadProps> = ({
  apiLink,
  confidenceThreshold = 0.9,
}) => {
  // Local state for preview, errors, and OCR response
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOcrData, setUploadOcrData] = useState<any | null>(null);
    const [processingStages, setProcessingStages] = useState<{
    gray?: string;
    blur?: string;
    edges?: string;
    dilated?: string;
    cropped?: string;
    card_name?: string;
    card_number?: string;
  }>({});

  /**
   * Called whenever the user drops or selects a file.
   * 1) Preview it
   * 2) POST to `${apiLink}/predict`
   * 3) If confidence ≥ threshold, convert data.card_number → Blob → POST to `${apiLink}/ocr`
   * 4) Store OCR JSON in state
   */
  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploadOcrData(null);

    // 1) Show a quick preview
    const previewURL = URL.createObjectURL(file);
    setUploadedPreview(previewURL);

    // 2) Send to /predict
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
        card_name: data.card_name && `data:image/jpeg;base64,${data.card_name}`,
        card_number: data.card_number && `data:image/jpeg;base64,${data.card_number}`,
      });

      const confidence = parseFloat(data.confidence);
      console.log("Predict response:", data);

      if (confidence < confidenceThreshold) {
        setUploadError(
          "Low confidence (< " +
            confidenceThreshold +
            ") - this might not be a Pokémon card."
        );
        return;
      }
      
      // 3) data.card_number is a base64 JPEG; convert to Blob
      if (!data.card_number) {
        setUploadError("Couldn’t extract the set-number region from this card.");
        return;
      }
      const cardNumberBlob = base64ToBlob(data.card_number);

      // 4) POST that Blob to /ocr
      const ocrForm = new FormData();
      ocrForm.append("images", cardNumberBlob, "card_number.jpg");

      const ocrRes = await fetch(`${apiLink}/ocr`, {
        method: "POST",
        body: ocrForm,
      });
      if (!ocrRes.ok) {
        throw new Error(`OCR endpoint returned ${ocrRes.status}`);
      }
      const ocrJson = await ocrRes.json();

      setUploadOcrData(ocrJson);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Unknown error during upload workflow.");
    }
  };

  // When a file is dropped onto the region
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

  // Prevent default so drop works
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // When the hidden <input type="file" /> changes
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
            <h3>OCR Results (set-number):</h3>
            <pre
              style={{
                background: "#000000",
                padding: "0.5rem",
                borderRadius: "4px",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(uploadOcrData, null, 2)}
            </pre>
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

    </div>
  );
};

export default CardUpload;
