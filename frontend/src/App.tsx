// src/App.tsx
import { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import LandingPage from "./components/LandingPage.tsx";
import VideoDetection from "./components/VideoDetection.tsx";
import PhotoDetection from "./components/PhotoDetection.tsx";

function App() {
  // Toggle for “show every processing stage” vs. “only cropped + price”
  const [debugMode, setDebugMode] = useState(false);

  // Because both VideoDetection and PhotoDetection need the same API base URL:
  const apiLink = import.meta.env.VITE_API_LINK;
  const CONFIDENCE_THRESHOLD = 0.9

  return (
    <div className="body">
      {/* ─── Header with Debug toggle ─── */}
      <div className="header">
        <Link to="/" style={{ textDecoration: "none" }}>
          <h1 className="header-text">Pokémon Price Scanner</h1>
        </Link>
        <button
          onClick={() => setDebugMode((prev) => !prev)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: debugMode ? "#ff4d4f" : "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          {debugMode ? "Disable Debug" : "Enable Debug"}
        </button>
      </div>

      {/* ─── Route Definitions ─── */}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/live"
          element={<VideoDetection debugMode={debugMode} confidenceThreshold={CONFIDENCE_THRESHOLD} apiLink={apiLink} />}
        />
        <Route
          path="/upload"
          element={<PhotoDetection debugMode={debugMode} confidenceThreshold={CONFIDENCE_THRESHOLD} apiLink={apiLink} />}
        />
      </Routes>
    </div>
  );
}

export default App;
