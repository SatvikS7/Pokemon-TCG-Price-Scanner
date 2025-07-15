import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
//import PhotoDetection from "./components/PhotoDetection";
import VideoDetection from "./components/VideoDetection";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* <Route path="/photo" element={<PhotoDetection />} /> */}
      <Route path="/video" element={<VideoDetection />} />
    </Routes>
  );
}

export default App;