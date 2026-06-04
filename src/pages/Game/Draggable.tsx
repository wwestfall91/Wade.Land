import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import FloatingTooltip from "./FloatingTooltip";
import ElementIcon from "../../components/ElementIcon";
import { usePlayer } from "../../context/PlayerContext";
import "./Draggable.scss";

type Position = {
	x: number;
	y: number;
};

type Props = {
	id: number;
	letter: string;
	damage: number;
	energy?: number;
	description: string;
	showTutorialCue?: boolean;
	onDismissTutorialCue?: () => void;
	type1?: string;
	type2?: string;
	effects?: SpellEffectConfig[];
	level?: number;
	category?: string;
	containerRef: React.RefObject<HTMLDivElement | null>;
	dropZoneRefs: Array<React.RefObject<HTMLDivElement | null>>;
	initialPosition: Position;
	onSnapChange: (draggableId: number, zoneIndex: number | null) => void;
	canSnapToZone: (draggableId: number, zoneIndex: number) => boolean;
	isNewFromChest?: boolean;
	forcedSnapZone?: { zone: number; version: number } | null;
};

function Draggable({
	id,
	letter,
	damage,
	energy,
	description,
	showTutorialCue = false,
	onDismissTutorialCue,
	type1,
	type2,
	effects,
	level,
	category,
	containerRef,
	dropZoneRefs,
	initialPosition,
	onSnapChange,
	canSnapToZone,
	isNewFromChest = false,
	forcedSnapZone = null,
}: Props) {
	const { typeMultipliers } = usePlayer();
	const [isDragging, setIsDragging] = useState(false);
	const [hasBeenDragged, setHasBeenDragged] = useState(false);
	const [isInvalidDrop, setIsInvalidDrop] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isTooltipHovered, setIsTooltipHovered] = useState(false);
	const [isTooltipGraceOpen, setIsTooltipGraceOpen] = useState(false);
	const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
	const [position, setPosition] = useState<Position>(initialPosition);
	const draggableRef = useRef<HTMLDivElement | null>(null);
	const tooltipGraceTimeoutRef = useRef<number | null>(null);

	const clearTooltipGraceTimeout = () => {
		if (tooltipGraceTimeoutRef.current !== null) {
			window.clearTimeout(tooltipGraceTimeoutRef.current);
			tooltipGraceTimeoutRef.current = null;
		}
	};

	const startTooltipGraceClose = () => {
		setIsTooltipGraceOpen(true);
		clearTooltipGraceTimeout();
		tooltipGraceTimeoutRef.current = window.setTimeout(() => {
			setIsTooltipGraceOpen(false);
			tooltipGraceTimeoutRef.current = null;
		}, 250);
	};

	useEffect(() => () => {
		clearTooltipGraceTimeout();
	}, []);

	useEffect(() => {
		if (!isDragging) return;

		const onMove = (e: PointerEvent) => {
			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			setPosition({
				x: Math.round(e.clientX - rect.left - mouseOffset.x),
				y: Math.round(e.clientY - rect.top - mouseOffset.y),
			});
		};

		const onUp = () => {
			const containerRect = containerRef.current?.getBoundingClientRect();
			const dragRect = draggableRef.current?.getBoundingClientRect();
			const dragWidth = draggableRef.current?.offsetWidth ?? dragRect?.width ?? 0;
			const dragHeight = draggableRef.current?.offsetHeight ?? dragRect?.height ?? 0;

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
							x: Math.round(
								dropZoneRect.left -
								containerRect.left +
								(dropZoneRect.width - dragWidth) / 2,
							),
							y: Math.round(
								dropZoneRect.top -
								containerRect.top +
								(dropZoneRect.height - dragHeight) / 2,
							),
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

	// When Game.tsx needs to reposition this element to a specific zone (e.g. plasma
	// dropped on slot 1 but should appear in the middle after the 3-slot layout expands),
	// it passes a new forcedSnapZone object. The version field changing triggers this effect.
	useLayoutEffect(() => {
		if (forcedSnapZone == null) return;
		const containerRect = containerRef.current?.getBoundingClientRect();
		const dropZoneRect = dropZoneRefs[forcedSnapZone.zone]?.current?.getBoundingClientRect();
		const dragWidth = draggableRef.current?.offsetWidth ?? 32;
		const dragHeight = draggableRef.current?.offsetHeight ?? 32;
		if (containerRect && dropZoneRect) {
			setPosition({
				x: Math.round(dropZoneRect.left - containerRect.left + (dropZoneRect.width - dragWidth) / 2),
				y: Math.round(dropZoneRect.top - containerRect.top + (dropZoneRect.height - dragHeight) / 2),
			});
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [forcedSnapZone]);

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
		setIsTooltipHovered(false);
		setIsTooltipGraceOpen(false);
		clearTooltipGraceTimeout();
		if (showTutorialCue && !hasBeenDragged) {
			onDismissTutorialCue?.();
		}
		onSnapChange(id, null);
		setHasBeenDragged(true);
		setIsDragging(true);
	};

	const handleDraggableMouseEnter = () => {
		clearTooltipGraceTimeout();
		setIsTooltipGraceOpen(false);
		setIsHovered(true);
	};

	const handleDraggableMouseLeave = () => {
		setIsHovered(false);
		startTooltipGraceClose();
	};

	const handleTooltipMouseEnter = () => {
		clearTooltipGraceTimeout();
		setIsTooltipGraceOpen(false);
		setIsTooltipHovered(true);
	};

	const handleTooltipMouseLeave = () => {
		setIsTooltipHovered(false);
		startTooltipGraceClose();
	};

	const isTooltipOpen = !isDragging && (isHovered || isTooltipHovered || isTooltipGraceOpen);
	const isTooltipClosing = isTooltipGraceOpen && !isHovered && !isTooltipHovered;

	return (
		<div
			id="Draggable"
			ref={draggableRef}
			className={[
				"drag",
				category === "spell" ? "is-spell" : "",
				category === "spell" ? `is-spell--${(type1 || type2 || "none")}` : "",
				category === "weapon" ? "is-weapon" : "",
				isInvalidDrop ? "is-invalid-drop" : "",
				isDragging ? "is-dragging" : "",
				showTutorialCue && !hasBeenDragged ? "is-discoverable" : "",
			].filter(Boolean).join(" ")}
			onPointerDown={handlePointerDown}
			onAnimationEnd={() => setIsInvalidDrop(false)}
			onMouseEnter={handleDraggableMouseEnter}
			onMouseLeave={handleDraggableMouseLeave}
			style={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				top: position.y,
				left: position.x,
				cursor: isDragging ? "grabbing" : "grab",
				userSelect: "none",
				zIndex:8999
			}}
		>
			<FloatingTooltip
				anchorElement={draggableRef.current}
				open={isTooltipOpen}
				className={`drag-description-popup${isTooltipClosing ? " is-closing" : ""}`}
				interactive
				onTooltipMouseEnter={handleTooltipMouseEnter}
				onTooltipMouseLeave={handleTooltipMouseLeave}
				clampHorizontal={false}
				typeMultipliers={typeMultipliers}
				elementDetails={{
					letter,
					damage,
					energy,
					description,
					type1,
					type2,
					effects,
					level,
					category,
				}}
			/>
			<div className={`element-glisten-shell${isNewFromChest ? " is-new-from-chest" : ""}`}>
				<ElementIcon name={letter} />
			</div>
		</div>
	);
}

export default Draggable;
