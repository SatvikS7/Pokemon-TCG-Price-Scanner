// src/components/LandingPage.tsx
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "2rem",
      }}
    >
      <h2 style={{ fontSize: "2rem", margin: 0 }}>Choose Your Scanner Mode:</h2>
      <div style={{ display: "flex", gap: "1.5rem" }}>
        <Link to="/video">
          <button
            style={{
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              borderRadius: "8px",
              border: "none",
              color: "black",
              cursor: "pointer",
            }}
          >
            Scan with Camera
          </button>
        </Link>
        <Link to="/photo">
          <button
            style={{
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              borderRadius: "8px",
              border: "none",
              color: "black",
              cursor: "pointer",
            }}
          >
            Upload Photo
          </button>
        </Link>
      </div>
    </div>
  );
};

export default LandingPage;
