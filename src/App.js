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

  const containerRef = useRef(null);
  const boardRef = useRef(null);

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

  // Update pin position while dragging (supporting both mouse and touch, adjusting offset for mobile)
  useEffect(() => {
    function handleMove(e) {
      if (!selectedPin) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const isMobile = e.type === "touchmove";
      let clientX, clientY;

      if (e.type === "mousemove") {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      const mouseX = clientX - containerRect.left;
      const mouseY = clientY - containerRect.top;
      const pinWidth = isMobile ? 120 : 200; // Match CSS .dragging-pin sizes
      const pinHeight = isMobile ? 120 : 200;
      setPinPosition({
        x: mouseX - pinWidth / 2, // Center horizontally
        y: mouseY - pinHeight / 2, // Center vertically
      });
    }

    const container = containerRef.current;
    container.addEventListener("mousemove", handleMove);
    container.addEventListener("touchmove", handleMove, { passive: false });
    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("touchmove", handleMove);
    };
  }, [selectedPin]);

  // Pick up a pin from sidebar or board (supporting both mouse and touch)
  const handlePickUp = (pin, origin) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (selectedPin) return;
    if (origin === "sidebar") {
      setAvailablePins((prev) => prev.filter((p) => p.alt !== pin.alt));
    } else if (origin === "board") {
      setBoardPins((prev) => prev.filter((p) => p.alt !== pin.alt));
    }
    setSelectedPin(pin);
    const containerRect = containerRef.current.getBoundingClientRect();
    const isMobile = e.type === "touchstart";
    let clientX, clientY;

    if (e.type === "mousedown") {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.type === "touchstart") {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;
    const pinWidth = isMobile ? 120 : 200;
    const pinHeight = isMobile ? 120 : 200;
    setPinPosition({
      x: mouseX - pinWidth / 2,
      y: mouseY - pinHeight / 2,
    });
  };

  // Drop the selected pin on board (if within bounds) or back to sidebar (supporting both mouse and touch)
  const handleDrop = (e) => {
    if (!selectedPin) return;
    let clientX, clientY;
    const isMobile = e.type === "touchend";

    if (e.type === "mouseup") {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.type === "touchend") {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }

    const boardRect = boardRef.current.getBoundingClientRect();
    if (
      clientX >= boardRect.left &&
      clientX <= boardRect.right &&
      clientY >= boardRect.top &&
      clientY <= boardRect.bottom
    ) {
      const dropX = clientX - boardRect.left;
      const dropY = clientY - boardRect.top;
      const pinWidth = isMobile ? 100 : 180; // Match .pin-container sizes
      const pinHeight = isMobile ? 100 : 180;
      const finalX = dropX - pinWidth / 2;
      const finalY = dropY - pinHeight / 2;
      setBoardPins((prev) => [
        ...prev,
        { ...selectedPin, position: { x: finalX, y: finalY } },
      ]);
      new Audio(pinSound).play();
      const containerRect = containerRef.current.getBoundingClientRect();
      const sparkleX = clientX - containerRect.left - (isMobile ? 50 : 100);
      const sparkleY = clientY - containerRect.top - (isMobile ? 50 : 100);
      setSparklePosition({ x: sparkleX, y: sparkleY });
      setTimeout(() => setSparklePosition(null), 1000);
    } else {
      setAvailablePins((prev) => [...prev, selectedPin]);
    }
    setSelectedPin(null);
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
          cursor: selectedPin
            ? `url(${mickeyHand}) 32 32, pointer`
            : "default",
        }}
      >
        {/* Sidebar with rolling pin thumbnails (horizontal on mobile) */}
        <div className="pin-sidebar">
          <div
            className="pin-scroll"
            style={{ animationPlayState: isPlaying ? "running" : "paused" }}
          >
            {availablePins.map((pin) => (
              <div
                key={pin.alt}
                className="pin-item"
                onMouseDown={handlePickUp(pin, "sidebar")}
                onTouchStart={handlePickUp(pin, "sidebar")}
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
              style={{ left: pin.position.x, top: pin.position.y }}
              onMouseDown={handlePickUp(pin, "board")}
              onTouchStart={handlePickUp(pin, "board")}
            >
              <img src={pin.src} alt={pin.alt} className="pin" loading="lazy" />
            </div>
          ))}
          {selectedPin && (
            <div className="dragging-pin" style={{ left: pinPosition.x, top: pinPosition.y }}>
              <img src={selectedPin.src} alt={selectedPin.alt} className="pin dragging" loading="lazy" />
            </div>
          )}
          {sparklePosition && (
            <div className="sparkle" style={{ left: sparklePosition.x, top: sparklePosition.y }} />
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