import "./index.css";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import JourneySection from "./components/JourneySection";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="bg-hero-bg min-h-screen">
      <Navbar />
      <HeroSection />
      <JourneySection />
      <Footer />
    </div>
  );
}

export default App;
