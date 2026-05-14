import { useEffect, useRef, useState } from "react";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import FloatingTooltip from "./FloatingTooltip";
import "./Draggable.scss";

type Position = {
	x: number;
	y: number;
};

type Props = {
	id: number;
	letter: string;
	damage: number;
	description: string;
	type1?: string;
	type2?: string;
	effects?: SpellEffectConfig[];
	containerRef: React.RefObject<HTMLDivElement | null>;
	dropZoneRefs: Array<React.RefObject<HTMLDivElement | null>>;
	initialPosition: Position;
	onSnapChange: (draggableId: number, zoneIndex: number | null) => void;
	canSnapToZone: (draggableId: number, zoneIndex: number) => boolean;
};

function Draggable({
	id,
	letter,
	damage,
	description,
	type1,
	type2,
	effects,
	containerRef,
	dropZoneRefs,
	initialPosition,
	onSnapChange,
	canSnapToZone,
}: Props) {
	const [isDragging, setIsDragging] = useState(false);
	const [hasBeenDragged, setHasBeenDragged] = useState(false);
	const [isInvalidDrop, setIsInvalidDrop] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
	const [position, setPosition] = useState<Position>(initialPosition);
	const draggableRef = useRef<HTMLDivElement | null>(null);

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
		onSnapChange(id, null);
		setHasBeenDragged(true);
		setIsDragging(true);
	};

	const types = [type1, type2].filter(
		(value): value is string => Boolean(value && value.trim().length > 0),
	);
	const toTypeClass = (value: string) =>
		`type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

	const getEffectSummaryLines = (nextEffects?: SpellEffectConfig[]) => {
		const lines: string[] = [];
		const normalizedEffects = nextEffects ?? [];

		const multiHit = normalizedEffects.find((effect) => effect.kind === "multi_hit");
		if (multiHit?.hits && multiHit.hits > 1) {
			lines.push(`Hits: ${multiHit.hits}x`);
		}

		normalizedEffects.forEach((effect) => {
			switch (effect.kind) {
				case "heal": {
					const amount = Math.max(0, effect.amount ?? 0);
					if (amount > 0) {
						lines.push(`Heal: +${amount}`);
					}
					break;
				}
				case "burn": {
					const amount = Math.max(0, effect.amount ?? 0);
					const duration = Math.max(1, effect.duration ?? 1);
					if (amount > 0) {
						lines.push(`Burn: +${amount} for ${duration} turns`);
					}
					break;
				}
				case "shield": {
					const amount = Math.max(0, effect.amount ?? 0);
					if (amount > 0) {
						lines.push(`Shield: +${amount}`);
					}
					break;
				}
				case "lifesteal": {
					const amount = Math.max(0, effect.amount ?? 0);
					if (amount > 0) {
						const percent = amount > 1 ? amount : Math.round(amount * 100);
						lines.push(`Lifesteal: ${percent}%`);
					}
					break;
				}
				case "soak": {
					const amount = Math.max(1, effect.amount ?? 1);
					lines.push(`Soak: +${amount}`);
					break;
				}
				default:
					break;
			}
		});

		return lines;
	};

	const getEffectChipClass = (line: string) => {
		if (line.startsWith("Heal:")) {
			return "effect-heal";
		}
		if (line.startsWith("Burn:")) {
			return "effect-burn";
		}
		if (line.startsWith("Shield:")) {
			return "effect-shield";
		}
		if (line.startsWith("Lifesteal:")) {
			return "effect-lifesteal";
		}
		if (line.startsWith("Soak:")) {
			return "effect-soak";
		}
		if (line.startsWith("Hits:")) {
			return "effect-multi-hit";
		}

		return "effect-default";
	};

	const effectLines = getEffectSummaryLines(effects);

	return (
		<div
			id="Draggable"
			ref={draggableRef}
			className={`drag ${isInvalidDrop ? "is-invalid-drop" : ""} ${isDragging ? "is-dragging" : ""} ${!hasBeenDragged ? "is-discoverable" : ""}`}
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
			}}
		>
			<FloatingTooltip
				anchorElement={draggableRef.current}
				open={isHovered && !isDragging && description.length > 0}
				className="drag-description-popup"
				clampHorizontal={false}
			>
				{description.length > 0 ? <div className="drag-description-text">{description}</div> : null}
				<div className="drag-damage-text">Damage: {damage}</div>
				<div className="drag-type-text">
					<span className="drag-type-label">Types:</span>
					<span className="drag-type-list">
						{types.length > 0 ? (
							types.map((type) => (
								<span key={type} className={`type-chip ${toTypeClass(type)}`}>
									{type}
								</span>
							))
						) : (
							<span className="type-chip type-none">None</span>
						)}
					</span>
				</div>
				{effectLines.length > 0 ? (
					<div className="drag-effect-text">
						<span className="drag-effect-label">Effects:</span>
						<span className="drag-effect-list">
							{effectLines.map((line) => (
								<span key={line} className={`effect-chip ${getEffectChipClass(line)}`}>{line}</span>
							))}
						</span>
					</div>
				) : null}
			</FloatingTooltip>
			{letter}
		</div>
	);
}

export default Draggable;
