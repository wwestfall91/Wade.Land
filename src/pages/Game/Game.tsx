import { useEffect, useRef, useState } from "react";
import "./Game.scss"

function Game() {    
    type ObjectPosition = {
        object: HTMLDivElement | undefined,
        positionX: number,
        positionY: number
    }

    const [dragging, setDragging] = useState<HTMLDivElement>();
    const [mouseX, setMouseX] = useState<number>(0);
    const [mouseY, setMouseY] = useState<number>(0);
    const [objectPositions, setObjectPositions] = useState<ObjectPosition[]>([{object: undefined, positionX: 0, positionY: 0}]);
    const elementRef = useRef(null);

    const handleClick = (e: any) => {
        e.stopPropagation();
        setDragging(e.target)
    }

    const handleDrop = (event: any) => {
        const positions = objectPositions;
        positions?.push({object: dragging, positionX: mouseX, positionY: mouseY})
        setObjectPositions(positions)

        setDragging(undefined);
    }

    // const handleDropCanvas = (event: React.DragEvent<HTMLDivElement>) => {
    //     event.preventDefault(); // prevent default action (Open as a link for some elements)    

    //     setDragging(undefined);
    // }

    // const handleDragOver = (event: any) => {
    //     event.preventDefault();
    // }

    addEventListener("mousemove", (e : any) => {
        if(mouseX == undefined || mouseY == undefined)
            return;

        setMouseX(e.clientX);
        setMouseY(e.clientY);
        //console.log(`X: ${mouseX} Y: ${mouseY}`)
    })

    const isDragging = () => {
        return elementRef.current == dragging;
    }

    return (
        //onDrop={handleDropCanvas}
        <div id="Game" onClick={handleDrop}>
            <div ref ={elementRef} className="drag" onClick={handleClick} 
                style={isDragging() ? 
                    {top:mouseY - 20, left:mouseX - 20, pointerEvents:"none"} : 
                    {top:objectPositions[0].positionX, left:objectPositions[0].positionY, pointerEvents:"auto"}} 
            />
            <div id="drop-zone" className="drop-zone" onClick={handleDrop}/> 
        </div>
    );
}

export default Game;