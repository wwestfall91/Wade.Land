import { useRef, useState } from "react";
import Draggable from "./Draggable";
import "./Game.scss";

function Game() {
    const gameRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRef = useRef<HTMLDivElement | null>(null);
    const [draggablePositions, setDraggablePositions] = useState([]);

    return (
        <div id="Game" ref={gameRef} style={{ position: "relative", width: "100%", height: "100%" }} >
            
            <Draggable
                key={`draggable${document.getElementsByClassName('drag').length}`}
                containerRef={gameRef}
                dropZoneRef={dropZoneRef}
                initialPosition={{x: -50, y: -50}}
            />

            <Draggable
                key={`draggable${document.getElementsByClassName('drag').length}`}
                containerRef={gameRef}
                dropZoneRef={dropZoneRef}
                initialPosition={{x: 100, y: 100}}
            />

            <Draggable
                key={`draggable${document.getElementsByClassName('drag').length}`}
                containerRef={gameRef}
                dropZoneRef={dropZoneRef}
                initialPosition={{x: 200, y: 150}}
            />

            <div id="drop-zone" className="drop-zone" ref={dropZoneRef} />
        </div>
    );
}

export default Game;