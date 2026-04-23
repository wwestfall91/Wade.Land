import { useEffect, useRef, useState } from "react";

type Position = {
	x: number;
	y: number;
};

type Props = {
	containerRef: React.RefObject<HTMLDivElement | null>;
	dropZoneRef: React.RefObject<HTMLDivElement | null>;
	initialPosition: Position;
};

function Draggable({ containerRef, dropZoneRef, initialPosition}: Props) {
	const [isDragging, setIsDragging] = useState(false);
	const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
	const [position, setPosition] = useState<Position>(initialPosition);
	const draggableRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!isDragging) return;

		const onMove = (e: PointerEvent) => {
			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			setPosition({
				x: e.clientX - rect.left - mouseOffset.x,
				y: e.clientY - rect.top - mouseOffset.y,
			});
		};

		const onUp = () => {
			const containerRect = containerRef.current?.getBoundingClientRect();
			const dropZoneRect = dropZoneRef.current?.getBoundingClientRect();
			const dragRect = draggableRef.current?.getBoundingClientRect();

			if (containerRect && dropZoneRect && dragRect) {
				const intersects = !(
					dragRect.right  < dropZoneRect.left     ||
					dragRect.left   > dropZoneRect.right    ||
					dragRect.bottom < dropZoneRect.top      ||
					dragRect.top    > dropZoneRect.bottom
				);

				if (intersects) {
					setPosition({
						x:
							dropZoneRect.left -
							containerRect.left +
							(dropZoneRect.width - dragRect.width) / 2,
						y:
							dropZoneRect.top -
							containerRect.top +
							(dropZoneRect.height - dragRect.height) / 2,
					});
				}
			}

			setIsDragging(false);
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);

		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, [containerRef, dropZoneRef, isDragging, mouseOffset.x, mouseOffset.y]);

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.stopPropagation();
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;

		setMouseOffset({
			x: e.clientX - rect.left - position.x,
			y: e.clientY - rect.top - position.y,
		});
		setIsDragging(true);
	};

	return (
		<div
			ref={draggableRef}
			className="drag"
			onPointerDown={handlePointerDown}
			style={{
				top: position.y,
				left: position.x,
				cursor: isDragging ? "grabbing" : "grab",
				userSelect: "none",
			}}
		/>
	);
}

export default Draggable;
