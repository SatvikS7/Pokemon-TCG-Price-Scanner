import { Routes, Route, Link } from "react-router-dom";
import LandingPage from "./components/LandingPage";
//import PhotoDetection from "./components/PhotoDetection";
import VideoDetection from "./components/VideoDetection";

function App() {
  return (
    <div className="body">
      {/* ─── Header with Debug toggle ─── */}
      <div className="header">
        <Link to="/" style={{ textDecoration: "none" }}>
          <h1 className="header-text">Pokémon Price Scanner</h1>
        </Link>
      </div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* <Route path="/photo" element={<PhotoDetection />} /> */}
        <Route path="/video" element={<VideoDetection />} />
      </Routes>
    </div>
  );
}

export default App;