import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import pinBoard from "./images/pin-board.png";
import mickeyHand from "./images/mickey-hand.png";
import pinSound from "./sounds/pin-sound.mp3";

// Dynamically import all images from src/pins/ with lazy loading
function importAll(r) {
  return r.keys().map((key, index) => ({
    src: r(key),
    alt: `${key
      .split("/")
      .pop()
      .split(".")
      .shift()
      .replace(/[^a-zA-Z0-9-]/g, "-")}-${index}`,
    loading: "lazy", // Lazy-load images
  }));
}
const pinImages = importAll(require.context("./pins/", false, /\.(png|jpe?g|svg)$/));

function App() {
  const [boardPins, setBoardPins] = useState([]);
  const [availablePins, setAvailablePins] = useState(pinImages);
  const [selectedPin, setSelectedPin] = useState(null); // Pin currently being dragged
  const [pinPosition, setPinPosition] = useState({ x: 0, y: 0 }); // Drag position
  const [sparklePosition, setSparklePosition] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true); // Controls sidebar scrolling
  const [showFireworks, setShowFireworks] = useState(false); // Controls fireworks animation
  const [isDragging, setIsDragging] = useState(false); // Track dragging state for sidebar control

  const containerRef = useRef(null);
  const boardRef = useRef(null);
  const sidebarRef = useRef(null); // Ref for sidebar to control touch/animation

  // On initial load, check localStorage for saved boardPins & availablePins
  useEffect(() => {
    const storedBoardPins = localStorage.getItem("boardPins");
    const storedAvailablePins = localStorage.getItem("availablePins");
    if (storedBoardPins) {
      setBoardPins(JSON.parse(storedBoardPins));
    }
    if (storedAvailablePins) {
      setAvailablePins(JSON.parse(storedAvailablePins));
    }
  }, []);

  // Whenever boardPins changes, store in localStorage
  useEffect(() => {
    localStorage.setItem("boardPins", JSON.stringify(boardPins));
  }, [boardPins]);

  // Whenever availablePins changes, store in localStorage
  useEffect(() => {
    localStorage.setItem("availablePins", JSON.stringify(availablePins));
  }, [availablePins]);

  // Update pin position while dragging (supporting both mouse and touch, adjusting offset dynamically)
  useEffect(() => {
    function handleMove(e) {
      if (!selectedPin) return;
      e.preventDefault();
      e.stopPropagation();
      
      const boardRect = boardRef.current.getBoundingClientRect();
      let clientX, clientY;

      if (e.type === "mousemove") {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      setPinPosition({
        x: clientX - boardRect.left,
        y: clientY - boardRect.top
      });
    }

    function handleStart(e) {
      if (selectedPin) return;
      
      let target = e.target;
      // Find closest pin-item or pin-container
      while (target && !target.classList.contains('pin-item') && !target.classList.contains('pin-container')) {
        target = target.parentElement;
      }
      
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      let pin;
      const origin = target.classList.contains('pin-item') ? 'sidebar' : 'board';
      
      if (origin === 'sidebar') {
        const pinAlt = target.querySelector('img').alt;
        pin = availablePins.find(p => p.alt === pinAlt);
        setAvailablePins((prev) => prev.filter((p) => p.alt !== pinAlt));
      } else {
        const pinAlt = target.querySelector('img').alt;
        pin = boardPins.find(p => p.alt === pinAlt);
        setBoardPins((prev) => prev.filter((p) => p.alt !== pinAlt));
      }

      if (!pin) return;

      let clientX, clientY;
      if (e.type === "touchstart") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      setSelectedPin(pin);
      setIsDragging(true);
      if (sidebarRef.current) {
        sidebarRef.current.style.touchAction = "none";
      }

      const boardRect = boardRef.current.getBoundingClientRect();
      setPinPosition({
        x: clientX - boardRect.left,
        y: clientY - boardRect.top
      });
    }

    const container = containerRef.current;
    container.addEventListener("mousemove", handleMove, { passive: false });
    container.addEventListener("touchmove", handleMove, { passive: false });
    container.addEventListener("mousedown", handleStart, { passive: false });
    container.addEventListener("touchstart", handleStart, { passive: false });

    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("touchmove", handleMove);
      container.removeEventListener("mousedown", handleStart);
      container.removeEventListener("touchstart", handleStart);
    };
  }, [selectedPin, availablePins, boardPins]);

  const handleDrop = (e) => {
    if (!selectedPin) return;
    
    let clientX, clientY;
    if (e.type === "mouseup") {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.type === "touchend") {
      // For touchend, use the last known pin position since we don't get coordinates
      const boardRect = boardRef.current.getBoundingClientRect();
      clientX = boardRect.left + pinPosition.x;
      clientY = boardRect.top + pinPosition.y;
    }

    const boardRect = boardRef.current.getBoundingClientRect();

    if (
      clientX >= boardRect.left &&
      clientX <= boardRect.right &&
      clientY >= boardRect.top &&
      clientY <= boardRect.bottom
    ) {
      setBoardPins((prev) => [
        ...prev,
        { ...selectedPin, position: { x: pinPosition.x, y: pinPosition.y } },
      ]);

      // Use the final pin position for the sparkle
      new Audio(pinSound).play();
      setSparklePosition({ x: pinPosition.x, y: pinPosition.y });
      setTimeout(() => setSparklePosition(null), 1000);
    } else {
      setAvailablePins((prev) => [...prev, selectedPin]);
    }

    setSelectedPin(null);
    setIsDragging(false);
    if (sidebarRef.current) {
      sidebarRef.current.style.touchAction = "auto";
    }
    setPinPosition({ x: 0, y: 0 });
  };

  // "Reset" button: clear boardPins, restore original pinImages to sidebar,
  // update localStorage, and trigger fireworks animation.
  const handleResetBoard = () => {
    setBoardPins([]);
    setAvailablePins(pinImages);
    localStorage.removeItem("boardPins");
    localStorage.removeItem("availablePins");

    // Trigger fireworks for 1.5 seconds
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 1500);
  };

  return (
    <div className="App">
      {/* Page header with title, count, and Instagram link */}
      <header className="page-header">
        <h1 className="page-title">Every Pin You Take</h1>
        <div className="board-count">Pins on Board: {boardPins.length}</div>
        <a
          className="instagram-link"
          href="https://instagram.com/everypinyoutake"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Every Pin You Take on Instagram"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            fill="#E1306C"
            viewBox="0 0 24 24"
          >
            <path d="M7.75 2h8.5A5.76 5.76 0 0122 7.75v8.5A5.76 5.76 0 0116.25 22h-8.5A5.76 5.76 0 012 16.25v-8.5A5.76 5.76 0 017.75 2zm0 2A3.75 3.75 0 004 7.75v8.5A3.75 3.75 0 007.75 20h8.5A3.75 3.75 0 0020 16.25v-8.5A3.75 3.75 0 0016.25 4h-8.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm4.75-3a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
          </svg>
        </a>
      </header>

      <div
        className={`container ${selectedPin ? "dragging" : ""}`}
        ref={containerRef}
        onMouseUp={handleDrop}
        onTouchEnd={handleDrop}
        style={{
          cursor: selectedPin ? `url(${mickeyHand}) 32 32, pointer` : "default",
          touchAction: "none"
        }}
      >
        {/* Sidebar with rolling pin thumbnails (horizontal on mobile), disable touch/animation when dragging */}
        <div className="pin-sidebar" ref={sidebarRef}>
          <div
            className="pin-scroll"
            style={{
              animationPlayState: isDragging || !isPlaying ? "paused" : "running", // Pause animation when dragging
              pointerEvents: isDragging ? "none" : "auto", // Disable touch on sidebar when dragging
            }}
          >
            {availablePins.map((pin) => (
              <div
                key={pin.alt}
                className="pin-item"
                style={{ touchAction: "none" }}
              >
                <img src={pin.src} alt={pin.alt} className="pin-thumb" loading="lazy" />
              </div>
            ))}
          </div>
        </div>

        {/* Pause/Play button above the sidebar */}
        <button className="play-toggle" onClick={() => setIsPlaying((prev) => !prev)}>
          {isPlaying ? "Pause" : "Play"}
        </button>

        {/* Reset button (labeled "reset") */}
        <button className="reset-button" onClick={handleResetBoard}>
          Reset
        </button>

        {/* Fireworks container (shown when fireworks are triggered) */}
        {showFireworks && (
          <div className="fireworks">
            <div className="firework-burst" />
            <div className="firework-burst" />
            <div className="firework-burst" />
          </div>
        )}

        {/* Pin board */}
        <div className="pin-board" ref={boardRef}>
          <img src={pinBoard} alt="Mickey Head Pin Board" className="board-image" loading="lazy" />
          {boardPins.map((pin) => (
            <div
              key={pin.alt}
              className="pin-container"
              style={{ 
                left: pin.position.x,
                top: pin.position.y,
                touchAction: "none"
              }}
            >
              <img src={pin.src} alt={pin.alt} className="pin" loading="lazy" />
            </div>
          ))}
          {selectedPin && (
            <div 
              className="dragging-pin" 
              style={{ 
                left: pinPosition.x,
                top: pinPosition.y,
                touchAction: "none",
                position: "absolute"
              }}
            >
              <img src={selectedPin.src} alt={selectedPin.alt} className="pin dragging" loading="lazy" />
            </div>
          )}
          {sparklePosition && (
            <div 
              className="sparkle" 
              style={{ 
                left: sparklePosition.x,
                top: sparklePosition.y,
                position: "absolute"
              }} 
            />
          )}
        </div>
      </div>

      {/* Footer with small text at the very bottom (scroll down to see) */}
      <footer className="page-footer">
        bring the magic
      </footer>
    </div>
  );
}

export default App;