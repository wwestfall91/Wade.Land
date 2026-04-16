import { useEffect, useState } from "react";
import "./Game.scss"

function Game() {
    const useMousePosition = () => {
       const [position, setPosition] = useState({x: 0, y: 0})

        useEffect(() => {
            const handleMouseMove = (e: any) => { setPosition({x: e.clientX, y: e.clientY}) }

            window.addEventListener('mousemove', handleMouseMove);

            return () => { window.removeEventListener('mousemove', handleMouseMove) }
        }, []);
    }
    
    const [dragging, setDragging] = useState();
    const {x , y} : any = useMousePosition();

    const handleDragStart = (e : DragEvent) => {
        setDragging(e.target as any);
    }

    return (
        <div id="Game">
            {x != undefined && y != undefined &&
                <div className="drag" draggable onDragStart={(e : any)=>handleDragStart(e)} style={{top: y, left:x}} ></div>
            }
        </div>
    );
}

export default Game;