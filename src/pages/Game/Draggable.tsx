import { useEffect, useRef, useState } from "react";
import "./Game.scss";

type Position = {
	x: number;
	y: number;
};

type Props = {
	id: number;
	letter: string;
	description: string;
	containerRef: React.RefObject<HTMLDivElement | null>;
	dropZoneRefs: Array<React.RefObject<HTMLDivElement | null>>;
	initialPosition: Position;
	onSnapChange: (draggableId: number, zoneIndex: number | null) => void;
	canSnapToZone: (draggableId: number, zoneIndex: number) => boolean;
};

function Draggable({
	id,
	letter,
	description,
	containerRef,
	dropZoneRefs,
	initialPosition,
	onSnapChange,
	canSnapToZone,
}: Props) {
	const [isDragging, setIsDragging] = useState(false);
	const [isInvalidDrop, setIsInvalidDrop] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [popupOffsetX, setPopupOffsetX] = useState(0);
	const [popupBelow, setPopupBelow] = useState(false);
	const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
	const [position, setPosition] = useState<Position>(initialPosition);
	const draggableRef = useRef<HTMLDivElement | null>(null);
	const popupRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!isHovered || isDragging || !description.length) {
			setPopupOffsetX(0);
			setPopupBelow(false);
			return;
		}

		const updatePopupPosition = () => {
			const dragRect = draggableRef.current?.getBoundingClientRect();
			const popupRect = popupRef.current?.getBoundingClientRect();
			if (!dragRect || !popupRect) {
				return;
			}

			const screenPadding = 8;
			const popupLeft = dragRect.left + dragRect.width / 2 - popupRect.width / 2;
			const popupRight = popupLeft + popupRect.width;

			if (popupLeft < screenPadding) {
				setPopupOffsetX(screenPadding - popupLeft);
			} else if (popupRight > window.innerWidth - screenPadding) {
				setPopupOffsetX(window.innerWidth - screenPadding - popupRight);
			} else {
				setPopupOffsetX(0);
			}

			const topIfAbove = dragRect.top - 8 - popupRect.height;
			setPopupBelow(topIfAbove < screenPadding);
		};

		const rafId = window.requestAnimationFrame(updatePopupPosition);
		window.addEventListener("resize", updatePopupPosition);

		return () => {
			window.cancelAnimationFrame(rafId);
			window.removeEventListener("resize", updatePopupPosition);
		};
	}, [description, isDragging, isHovered, position.x, position.y]);

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
			const dragRect = draggableRef.current?.getBoundingClientRect();

			if (containerRect && dragRect) {
				const intersectingZoneIndex = dropZoneRefs.findIndex((zoneRef) => {
					const dropZoneRect = zoneRef.current?.getBoundingClientRect();
					if (!dropZoneRect) {
						return false;
					}

					const intersects = !(
						dragRect.right < dropZoneRect.left ||
						dragRect.left > dropZoneRect.right ||
						dragRect.bottom < dropZoneRect.top ||
						dragRect.top > dropZoneRect.bottom
					);

					return intersects;
				});

				const snapZoneIndex =
					intersectingZoneIndex !== -1 && canSnapToZone(id, intersectingZoneIndex)
						? intersectingZoneIndex
						: -1;

				if (snapZoneIndex !== -1) {
					const dropZoneRect = dropZoneRefs[snapZoneIndex].current?.getBoundingClientRect();
					if (dropZoneRect) {
						setIsInvalidDrop(false);
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
						onSnapChange(id, snapZoneIndex);
					}
				} else {
					if (intersectingZoneIndex !== -1) {
						setIsInvalidDrop(true);
					}
					onSnapChange(id, null);
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
	}, [
		canSnapToZone,
		containerRef,
		dropZoneRefs,
		id,
		isDragging,
		mouseOffset.x,
		mouseOffset.y,
		onSnapChange,
	]);

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.stopPropagation();
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;

		setIsInvalidDrop(false);

		setMouseOffset({
			x: e.clientX - rect.left - position.x,
			y: e.clientY - rect.top - position.y,
		});
		setIsHovered(false);
		setPopupOffsetX(0);
		setPopupBelow(false);
		onSnapChange(id, null);
		setIsDragging(true);
	};

	return (
		<div
			id="Draggable"
			ref={draggableRef}
			className={`drag ${isInvalidDrop ? "is-invalid-drop" : ""}`}
			onPointerDown={handlePointerDown}
			onAnimationEnd={() => setIsInvalidDrop(false)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			style={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				top: position.y,
				left: position.x,
				cursor: isDragging ? "grabbing" : "grab",
				userSelect: "none",
				color: "black",
				textAlign: "center",
				borderRadius: "1rem",
				border: "3px solid black",
			}}
		>
			{isHovered && !isDragging && description.length > 0 ? (
				<div
					ref={popupRef}
					className={`drag-description-popup ${popupBelow ? "is-below" : ""}`}
					style={{
						["--popup-offset-x" as string]: `${popupOffsetX}px`,
					}}
				>
					{description}
				</div>
			) : null}
			{letter}
		</div>
	);
}

export default Draggable;
