import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import FloatingTooltip from "./FloatingTooltip";
import ElementIcon from "../../components/ElementIcon";
import { type ElementEnhancements, usePlayer } from "../../context/PlayerContext";
import "./Draggable.scss";

const DRAG_START_THRESHOLD_PX = 6;

type Position = {
	x: number;
	y: number;
};

type Props = {
	id: number;
	letter: string;
	damage: number;
	energy?: number;
	enhancements?: ElementEnhancements;
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
	zIndexOverride?: number;
};

function Draggable({
	id,
	letter,
	damage,
	energy,
	enhancements,
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
	zIndexOverride,
}: Props) {
	const { typeMultipliers } = usePlayer();
	const [isDragging, setIsDragging] = useState(false);
	const [hasBeenDragged, setHasBeenDragged] = useState(false);
	const [isInvalidDrop, setIsInvalidDrop] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isTooltipHovered, setIsTooltipHovered] = useState(false);
	const [isTooltipGraceOpen, setIsTooltipGraceOpen] = useState(false);
	const [isTooltipPinned, setIsTooltipPinned] = useState(false);
	const [isAltLockActive, setIsAltLockActive] = useState(false);
	const [isAltHeld, setIsAltHeld] = useState(false);
	const [isPointerDown, setIsPointerDown] = useState(false);
	const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
	const [position, setPosition] = useState<Position>(initialPosition);
	const draggableRef = useRef<HTMLDivElement | null>(null);
	const tooltipGraceTimeoutRef = useRef<number | null>(null);
	const altHeldRef = useRef(false);
	const pointerDownRef = useRef<Position | null>(null);
	const dragStartedRef = useRef(false);
	const suppressPinOnPointerUpRef = useRef(false);

	const centerInDropZone = (dropZoneRect: DOMRect) => {
		// Use offsetWidth/offsetHeight — these are NOT affected by CSS transforms
		// (e.g. scale(1.05) during dragging), so the snap is always the natural size.
		const dragWidth = draggableRef.current?.offsetWidth ?? 32;
		const dragHeight = draggableRef.current?.offsetHeight ?? 32;

		setPosition({
			x: Math.round(dropZoneRect.left + (dropZoneRect.width - dragWidth) / 2),
			y: Math.round(dropZoneRect.top + (dropZoneRect.height - dragHeight) / 2),
		});
	};

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
		}, 450);
	};

	const releaseAltLock = (preserveTooltipHover = false) => {
		setIsAltLockActive(false);
		setIsAltHeld(false);
		if (!preserveTooltipHover) {
			setIsTooltipHovered(false);
		}
		setIsTooltipGraceOpen(false);
		clearTooltipGraceTimeout();
	};

	useEffect(() => () => {
		clearTooltipGraceTimeout();
	}, []);

	useEffect(() => {
		const syncAltState = (isAltPressed: boolean) => {
			altHeldRef.current = isAltPressed;
			setIsAltHeld(isAltPressed);

			if (!isAltPressed) {
				releaseAltLock(true);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			syncAltState(event.altKey || event.key === "Alt");
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			syncAltState(event.altKey);
		};

		const handlePointerMove = (event: PointerEvent) => {
			syncAltState(event.altKey);
		};

		const handleWindowBlur = () => {
			syncAltState(false);
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState !== "visible") {
				syncAltState(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown, true);
		document.addEventListener("keydown", handleKeyDown, true);
		window.addEventListener("keyup", handleKeyUp, true);
		document.addEventListener("keyup", handleKeyUp, true);
		window.addEventListener("pointermove", handlePointerMove, true);
		window.addEventListener("blur", handleWindowBlur);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("keydown", handleKeyDown, true);
			document.removeEventListener("keydown", handleKeyDown, true);
			window.removeEventListener("keyup", handleKeyUp, true);
			document.removeEventListener("keyup", handleKeyUp, true);
			window.removeEventListener("pointermove", handlePointerMove, true);
			window.removeEventListener("blur", handleWindowBlur);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	useEffect(() => {
		altHeldRef.current = isAltHeld;
	}, [isAltHeld]);

	useEffect(() => {
		if (!isPointerDown) return;

		const onMove = (e: PointerEvent) => {
			if (!isDragging) {
				const origin = pointerDownRef.current;
				if (!origin) {
					return;
				}

				const deltaX = e.clientX - origin.x;
				const deltaY = e.clientY - origin.y;
				const travelDistance = Math.hypot(deltaX, deltaY);

				if (travelDistance < DRAG_START_THRESHOLD_PX) {
					return;
				}

				setIsDragging(true);
				dragStartedRef.current = true;
				setIsTooltipPinned(false);
				setIsHovered(false);
				setIsTooltipHovered(false);
				setIsTooltipGraceOpen(false);
				clearTooltipGraceTimeout();
				onSnapChange(id, null);
				setHasBeenDragged(true);
				if (showTutorialCue && !hasBeenDragged) {
					onDismissTutorialCue?.();
				}
			}

			if (!isDragging) {
				return;
			}

			const dragWidth = draggableRef.current?.offsetWidth ?? 32;
			const dragHeight = draggableRef.current?.offsetHeight ?? 32;
			const maxX = Math.max(0, window.innerWidth - dragWidth);
			const maxY = Math.max(0, window.innerHeight - dragHeight);
			const rawX = e.clientX - mouseOffset.x;
			const rawY = e.clientY - mouseOffset.y;

			setPosition({
				x: Math.round(Math.max(0, Math.min(maxX, rawX))),
				y: Math.round(Math.max(0, Math.min(maxY, rawY))),
			});
		};

		const onUp = () => {
			const wasDragging = dragStartedRef.current;
			dragStartedRef.current = false;
			setIsPointerDown(false);
			pointerDownRef.current = null;

			if (!wasDragging) {
				if (suppressPinOnPointerUpRef.current) {
					suppressPinOnPointerUpRef.current = false;
					return;
				}
				setIsTooltipPinned(true);
				setIsHovered(false);
				setIsTooltipHovered(false);
				setIsTooltipGraceOpen(false);
				clearTooltipGraceTimeout();
				return;
			}

			const dragRect = draggableRef.current?.getBoundingClientRect();
			const dragWidth = draggableRef.current?.offsetWidth ?? dragRect?.width ?? 0;
			const dragHeight = draggableRef.current?.offsetHeight ?? dragRect?.height ?? 0;

			if (dragRect) {
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
						centerInDropZone(dropZoneRect);
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
		dropZoneRefs,
		hasBeenDragged,
		id,
		isDragging,
		isPointerDown,
		mouseOffset.x,
		mouseOffset.y,
		onDismissTutorialCue,
		onSnapChange,
		showTutorialCue,
	]);

	useEffect(() => {
		if (!isTooltipPinned) {
			return;
		}

		const handleWindowPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (!target) {
				setIsTooltipPinned(false);
				setIsHovered(false);
				setIsTooltipHovered(false);
				setIsTooltipGraceOpen(false);
				clearTooltipGraceTimeout();
				return;
			}

			if ((event.ctrlKey || event.metaKey) && target.closest("#Draggable")) {
				return;
			}

			if (target.closest(".floating-tooltip")) {
				return;
			}

			setIsTooltipPinned(false);
			setIsHovered(false);
			setIsTooltipHovered(false);
			setIsTooltipGraceOpen(false);
			clearTooltipGraceTimeout();
		};

		window.addEventListener("pointerdown", handleWindowPointerDown, true);
		return () => {
			window.removeEventListener("pointerdown", handleWindowPointerDown, true);
		};
	}, [isTooltipPinned]);

	// When Game.tsx needs to reposition this element to a specific zone (e.g. plasma
	// dropped on slot 1 but should appear in the middle after the 3-slot layout expands),
	// it passes a new forcedSnapZone object. The version field changing triggers this effect.
	useLayoutEffect(() => {
		if (forcedSnapZone == null) return;
		const dropZoneRect = dropZoneRefs[forcedSnapZone.zone]?.current?.getBoundingClientRect();
		if (dropZoneRect) {
			centerInDropZone(dropZoneRect);
			window.requestAnimationFrame(() => {
				const stableDropZoneRect = dropZoneRefs[forcedSnapZone.zone]?.current?.getBoundingClientRect();
				if (stableDropZoneRect) {
					centerInDropZone(stableDropZoneRect);
				}
			});
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [forcedSnapZone]);

	useLayoutEffect(() => {
		if (isDragging) {
			return;
		}

		const containerRect = containerRef.current?.getBoundingClientRect();
		if (!containerRect) {
			return;
		}

		setPosition({
			x: Math.round(containerRect.left + initialPosition.x),
			y: Math.round(containerRect.top + initialPosition.y),
		});
	}, [containerRef, initialPosition.x, initialPosition.y]);

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.stopPropagation();
		setIsInvalidDrop(false);
		dragStartedRef.current = false;

		if (isTooltipPinned) {
			suppressPinOnPointerUpRef.current = true;
			setIsTooltipPinned(false);
			setIsHovered(false);
			setIsTooltipHovered(false);
			setIsTooltipGraceOpen(false);
			clearTooltipGraceTimeout();
			setIsPointerDown(true);
			pointerDownRef.current = { x: e.clientX, y: e.clientY };
			return;
		}

		setMouseOffset({
			x: e.clientX - position.x,
			y: e.clientY - position.y,
		});
		setIsPointerDown(true);
		pointerDownRef.current = { x: e.clientX, y: e.clientY };
		setIsHovered(false);
		setIsTooltipHovered(false);
		setIsTooltipGraceOpen(false);
		clearTooltipGraceTimeout();
	};

	const handleDraggableMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
		clearTooltipGraceTimeout();
		setIsTooltipGraceOpen(false);
		setIsHovered(true);

		if (event.altKey || isAltHeld || altHeldRef.current) {
			altHeldRef.current = true;
			setIsAltHeld(true);
			setIsAltLockActive(true);
		}
	};

	const handleDraggableMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
		if (isTooltipPinned) {
			return;
		}

		setIsHovered(false);

		if (isAltLockActive && (isAltHeld || altHeldRef.current || event.altKey)) {
			return;
		}

		if (isAltHeld || altHeldRef.current || event.altKey) {
			startTooltipGraceClose();
			return;
		}

		setIsTooltipHovered(false);
		setIsTooltipGraceOpen(false);
		clearTooltipGraceTimeout();
	};

	const handleTooltipMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
		if (isTooltipPinned) {
			clearTooltipGraceTimeout();
			setIsTooltipGraceOpen(false);
			setIsTooltipHovered(true);
			return;
		}

		if (event.altKey || isAltHeld || altHeldRef.current) {
			altHeldRef.current = true;
			setIsAltHeld(true);
			setIsAltLockActive(true);
		}

		if (!isAltHeld && !altHeldRef.current && !event.altKey) {
			return;
		}

		clearTooltipGraceTimeout();
		setIsTooltipGraceOpen(false);
		setIsTooltipHovered(true);
	};

	const handleTooltipMouseLeave = () => {
		if (isTooltipPinned) {
			setIsTooltipHovered(false);
			return;
		}

		setIsTooltipHovered(false);

		if (isAltLockActive && (isAltHeld || altHeldRef.current)) {
			return;
		}

		startTooltipGraceClose();
	};

	const isAltStickyOpen = isAltLockActive && isAltHeld;
	const isTooltipOpen = !isDragging && (isTooltipPinned || isHovered || isTooltipHovered || isTooltipGraceOpen || isAltStickyOpen);
	const isTooltipClosing = isTooltipGraceOpen && !isHovered && !isTooltipHovered;

	return (
		<div
			id="Draggable"
			ref={draggableRef}
			className={[
				"drag",
				category === "spell" ? "is-spell" : "",
				category === "spell" ? `is-spell--${(type1 || type2 || "none")}` : "",
				category === "weapon" ? "is-weapon" : "",			category === "soul" ? "is-soul" : "",				isInvalidDrop ? "is-invalid-drop" : "",
				isDragging ? "is-dragging" : "",
				isTooltipPinned ? "is-tooltip-pinned" : "",
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
				zIndex: zIndexOverride ?? 8999,
			}}
		>
			<FloatingTooltip
				anchorElement={draggableRef.current}
				open={isTooltipOpen}
				selected={isTooltipPinned}
				className={`drag-description-popup${isTooltipClosing ? " is-closing" : ""}${isTooltipPinned ? " is-pinned" : ""}`}
				interactive={isAltHeld || isTooltipPinned}
				onTooltipMouseEnter={handleTooltipMouseEnter}
				onTooltipMouseLeave={handleTooltipMouseLeave}
				clampHorizontal={false}
				typeMultipliers={typeMultipliers}
				elementDetails={{
					letter,
					damage,
					energy,
					enhancements,
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
