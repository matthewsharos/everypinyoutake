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
  const [isAutoScroll, setIsAutoScroll] = useState(true); // Controls sidebar scrolling
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

  // Update pin position while dragging
  useEffect(() => {
    function handleMove(e) {
      if (!selectedPin) return;
      e.preventDefault();
      e.stopPropagation();
      
      // Get board position
      const boardRect = boardRef.current.getBoundingClientRect();
      let clientX, clientY;

      // Get exact touch/mouse coordinates
      if (e.type === "mousemove") {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      // Direct position calculation
      const posX = clientX - boardRect.left;
      const posY = clientY - boardRect.top;

      // Set position directly
      setPinPosition({
        x: posX,
        y: posY
      });
    }

    // Only attach move handlers
    const container = containerRef.current;
    container.addEventListener('mousemove', handleMove, { passive: false });
    container.addEventListener('touchmove', handleMove, { passive: false });

    return () => {
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('touchmove', handleMove);
    };
  }, [selectedPin]);

  const handleDrop = (e) => {
    if (!selectedPin) return;
    
    // Use the current pin position which tracks the finger exactly
    const boardRect = boardRef.current.getBoundingClientRect();
    
    // Check if the current position is within board boundaries
    const absoluteX = pinPosition.x + boardRect.left;
    const absoluteY = pinPosition.y + boardRect.top;
    
    if (
      absoluteX >= boardRect.left &&
      absoluteX <= boardRect.right &&
      absoluteY >= boardRect.top &&
      absoluteY <= boardRect.bottom
    ) {
      // Place pin exactly where it was being dragged
      setBoardPins((prev) => [
        ...prev,
        { ...selectedPin, position: { x: pinPosition.x, y: pinPosition.y } },
      ]);

      // Show sparkle at same exact position
      new Audio(pinSound).play();
      setSparklePosition({ x: pinPosition.x, y: pinPosition.y });
      setTimeout(() => setSparklePosition(null), 1000);
    } else {
      // Return to sidebar if dropped outside board area
      setAvailablePins((prev) => [...prev, selectedPin]);
    }

    // Clean up
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
          href="https://www.instagram.com/everypinyoutake/"
          target="_blank"
          rel="noopener noreferrer"
          className="instagram-link"
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
              animationPlayState: isDragging || !isAutoScroll ? "paused" : "running", // Pause animation when dragging
              pointerEvents: isDragging ? "none" : "auto", // Disable touch on sidebar when dragging
            }}
          >
            {availablePins.map((pin) => (
              <div
                key={pin.alt}
                className="pin-item"
                style={{ touchAction: "none" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Remove from sidebar
                  setAvailablePins(prev => prev.filter(p => p.alt !== pin.alt));
                  
                  // Set up dragging
                  setSelectedPin(pin);
                  setIsDragging(true);
                  
                  // Get mouse position and board position
                  const boardRect = boardRef.current.getBoundingClientRect();
                  
                  // Calculate board-relative position
                  const posX = e.clientX - boardRect.left;
                  const posY = e.clientY - boardRect.top;
                  
                  // Set pin position directly
                  setPinPosition({
                    x: posX,
                    y: posY
                  });
                  
                  if (sidebarRef.current) {
                    sidebarRef.current.style.touchAction = 'none';
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Remove from sidebar
                  setAvailablePins(prev => prev.filter(p => p.alt !== pin.alt));
                  
                  // Set up dragging
                  setSelectedPin(pin);
                  setIsDragging(true);
                  
                  // Get touch position and board position
                  const boardRect = boardRef.current.getBoundingClientRect();
                  const touch = e.touches[0];
                  
                  // Calculate board-relative position
                  const touchX = touch.clientX - boardRect.left;
                  const touchY = touch.clientY - boardRect.top;
                  
                  // Set pin position directly
                  setPinPosition({
                    x: touchX,
                    y: touchY
                  });
                  
                  if (sidebarRef.current) {
                    sidebarRef.current.style.touchAction = 'none';
                  }
                }}
              >
                <img src={pin.src} alt={pin.alt} className="pin-thumb" loading="lazy" />
              </div>
            ))}
          </div>
        </div>

        {/* Play toggle button (visible on desktop and tablet) */}
        <button className="play-toggle" onClick={() => setIsAutoScroll(!isAutoScroll)}>
          {isAutoScroll ? "Pause" : "Play"}
        </button>

        {/* Reset button (clears pins) */}
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
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Remove from board
                setBoardPins(prev => prev.filter(p => p.alt !== pin.alt));
                
                // Set up dragging
                setSelectedPin(pin);
                setIsDragging(true);
                
                // Get mouse position and board position
                const boardRect = boardRef.current.getBoundingClientRect();
                
                // Calculate board-relative position
                const posX = e.clientX - boardRect.left;
                const posY = e.clientY - boardRect.top;
                
                // Set pin position directly
                setPinPosition({
                  x: posX,
                  y: posY
                });
                
                if (sidebarRef.current) {
                  sidebarRef.current.style.touchAction = 'none';
                }
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Remove from board
                setBoardPins(prev => prev.filter(p => p.alt !== pin.alt));
                
                // Set up dragging
                setSelectedPin(pin);
                setIsDragging(true);
                
                // Get touch position and board position
                const boardRect = boardRef.current.getBoundingClientRect();
                const touch = e.touches[0];
                
                // Calculate board-relative position
                const touchX = touch.clientX - boardRect.left;
                const touchY = touch.clientY - boardRect.top;
                
                // Set pin position directly
                setPinPosition({
                  x: touchX,
                  y: touchY
                });
                
                if (sidebarRef.current) {
                  sidebarRef.current.style.touchAction = 'none';
                }
              }}
            >
              <img src={pin.src} alt={pin.alt} className="pin" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {/* Render dragging pin at fixed position */}
      {selectedPin && boardRef.current && (
        <div 
          className="dragging-pin"
          style={{ 
            position: "fixed",
            left: pinPosition.x + boardRef.current.getBoundingClientRect().left,
            top: pinPosition.y + boardRef.current.getBoundingClientRect().top,
            zIndex: 9999,
            touchAction: "none",
            pointerEvents: "none",
            transform: "translate(-50%, -50%)"
          }}
        >
          <img src={selectedPin.src} alt={selectedPin.alt} className="pin dragging" loading="lazy" />
        </div>
      )}
      
      {/* Render sparkle at fixed position */}
      {sparklePosition && boardRef.current && (
        <div 
          className="sparkle" 
          style={{ 
            position: "fixed",
            left: sparklePosition.x + boardRef.current.getBoundingClientRect().left,
            top: sparklePosition.y + boardRef.current.getBoundingClientRect().top,
            zIndex: 9998,
            pointerEvents: "none",
            transform: "translate(-50%, -50%)"
          }} 
        />
      )}

      {/* Footer with small text at the very bottom (scroll down to see) */}
      <footer className="page-footer">
        bring the magic
      </footer>
    </div>
  );
}

export default App;