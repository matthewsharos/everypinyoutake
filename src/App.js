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
      const containerRect = containerRef.current.getBoundingClientRect();
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
      const isMobile = window.innerWidth <= 767;
      const pinWidth = isMobile ? 120 : 200; // Match .dragging-pin CSS
      const pinHeight = isMobile ? 120 : 200;

      // Adjust offsets for better alignment
      setPinPosition({
        x: mouseX - pinWidth / 2 - (isMobile ? 20 : 40), // Shift left by 20px (mobile) or 40px (desktop)
        y: mouseY - pinHeight / 2 - (isMobile ? 200 : 0), // Shift up by 200px on mobile, no shift on desktop
      });
    }

    const container = containerRef.current;
    container.addEventListener("mousemove", handleMove);
    container.addEventListener("touchmove", handleMove, { passive: false }); // Prevent default touch scrolling
    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("touchmove", handleMove);
    };
  }, [selectedPin]);

  // Pick up a pin from sidebar or board (supporting both mouse and touch, with improved touch handling)
  const handlePickUp = (pin, origin) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    const isMobile = window.innerWidth <= 767;

    // Immediately handle touch events on mobile
    if (isMobile && e.type === "touchstart") {
      if (sidebarRef.current) {
        sidebarRef.current.style.touchAction = "none"; // Disable sidebar touch scrolling
      }
      if (origin === "sidebar") {
        setAvailablePins((prev) => prev.filter((p) => p.alt !== pin.alt));
      } else if (origin === "board") {
        setBoardPins((prev) => prev.filter((p) => p.alt !== pin.alt));
      }
      setSelectedPin(pin);
      setIsDragging(true); // Set dragging state to pause sidebar
      const containerRect = containerRef.current.getBoundingClientRect();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const mouseX = clientX - containerRect.left;
      const mouseY = clientY - containerRect.top;
      const pinWidth = 120; // Mobile pin size
      const pinHeight = 120;

      // Adjust offsets for better alignment on mobile
      setPinPosition({
        x: mouseX - pinWidth / 2 - 20, // Shift left by 20px
        y: mouseY - pinHeight / 2 - 200, // Shift up by 200px
      });
      return;
    }

    // Handle desktop/mouse events
    if (selectedPin) return;
    if (origin === "sidebar") {
      setAvailablePins((prev) => prev.filter((p) => p.alt !== pin.alt));
    } else if (origin === "board") {
      setBoardPins((prev) => prev.filter((p) => p.alt !== pin.alt));
    }
    setSelectedPin(pin);
    setIsDragging(true);
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const pinWidth = isMobile ? 120 : 200;
    const pinHeight = isMobile ? 120 : 200;

    setPinPosition({
      x: mouseX - pinWidth / 2 - (isMobile ? 20 : 40),
      y: mouseY - pinHeight / 2 - (isMobile ? 200 : 0),
    });
  };

  // Drop the selected pin on board (if within bounds) or back to sidebar (supporting both mouse and touch, with improved touch handling)
  const handleDrop = (e) => {
    if (!selectedPin) return;
    let clientX, clientY;
    const isMobile = window.innerWidth <= 767;

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
      const containerRect = containerRef.current.getBoundingClientRect();
      const dropX = clientX - boardRect.left - (isMobile ? 25 : 80); // Shift left by 20px on desktop, 30px on mobile
      const dropY = clientY - boardRect.top - (isMobile ? 40 : 100); // Shift up by 50px on mobile, 100px on desktop to align closer to mouse
      setBoardPins((prev) => [
        ...prev,
        { ...selectedPin, position: { x: dropX, y: dropY } }, // Drop pin exactly where the mouse/finger is, adjusted upward and left on desktop
      ]);
      new Audio(pinSound).play();
      const sparkleX = clientX - containerRect.left - (isMobile ? 40 : 150); // Align sparkle with pin center, shifted left
      const sparkleY = clientY - containerRect.top - (isMobile ? 260 : 40); // Align sparkle with pin center, shifted up on mobile
      setSparklePosition({ x: sparkleX, y: sparkleY });
      setTimeout(() => setSparklePosition(null), 1000);
    } else {
      setAvailablePins((prev) => [...prev, selectedPin]);
    }
    setSelectedPin(null);
    setIsDragging(false); // Reset dragging state to resume sidebar
    if (sidebarRef.current) {
      sidebarRef.current.style.touchAction = "auto"; // Re-enable sidebar touch scrolling
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
        onTouchStart={(e) => e.preventDefault()} // Prevent touch scrolling on container
        onTouchMove={(e) => e.preventDefault()} // Prevent touch scrolling on container
        style={{
          cursor: selectedPin
            ? `url(${mickeyHand}) 32 32, pointer`
            : "default",
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
                onMouseDown={handlePickUp(pin, "sidebar")}
                onTouchStart={handlePickUp(pin, "sidebar")}
                onTouchMove={(e) => e.preventDefault()} // Prevent touch scrolling on pin items
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
              onTouchMove={(e) => e.preventDefault()} // Prevent touch scrolling on pins
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