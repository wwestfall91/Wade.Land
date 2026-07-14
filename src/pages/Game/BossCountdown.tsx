import { useEffect, useRef, useState } from "react";
import { resolveSpritePath } from "../../components/EnemyInfoSprite";
import "./BossCountdown.scss";

const TOTAL_DOTS = 10;
const DOT_STEP_PX = 63; // center-to-center spacing
const SLIDE_DURATION_MS = 520;

// Skull transition phase durations (ms)
const WARRIOR_FADE_MS  = 600;
const SKULL_HOLD_MS    = 1200;
const NEW_SPRITE_MS    = 600;

type SkullPhase = "idle" | "warrior-fade" | "skull" | "new-sprite-in";

type Props = {
    battlesCompleted: number;
    /** Increment this each time a battle ends to trigger the warrior slide animation. */
    animateVersion: number;
    /** Sprite path for the current boss (e.g. "sprites/Warrior.gif"). */
    spritePath: string;
    /** Sprite path for the NEXT boss — shown when the new boss appears after transition. */
    transitionToSprite?: string;
    /** Increment to trigger the skull → new boss transition. */
    transitionVersion?: number;
    /** Called when the skull fades and the new boss sprite begins to appear. */
    onTransitionComplete?: () => void;
};

function BossCountdown({
    battlesCompleted,
    animateVersion,
    spritePath,
    transitionToSprite,
    transitionVersion = 0,
    onTransitionComplete,
}: Props) {
    const currentIndex = Math.min(battlesCompleted, TOTAL_DOTS - 1);
    const daysRemaining = Math.max(0, TOTAL_DOTS - battlesCompleted);

    const [visualIndex, setVisualIndex] = useState(currentIndex);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [skullPhase, setSkullPhase] = useState<SkullPhase>("idle");

    // Locked position and sprite captured when the skull transition begins.
    const lockPosRef = useRef(0);
    const transitionSpriteRef = useRef("");

    const timerRef   = useRef<number | null>(null);
    const raf1Ref    = useRef<number | null>(null);
    const raf2Ref    = useRef<number | null>(null);
    const skullT1Ref = useRef<number | null>(null);
    const skullT2Ref = useRef<number | null>(null);
    const skullT3Ref = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current   !== null) window.clearTimeout(timerRef.current);
            if (raf1Ref.current    !== null) window.cancelAnimationFrame(raf1Ref.current);
            if (raf2Ref.current    !== null) window.cancelAnimationFrame(raf2Ref.current);
            if (skullT1Ref.current !== null) window.clearTimeout(skullT1Ref.current);
            if (skullT2Ref.current !== null) window.clearTimeout(skullT2Ref.current);
            if (skullT3Ref.current !== null) window.clearTimeout(skullT3Ref.current);
        };
    }, []);

    useEffect(() => {
        if (animateVersion > 0) return;
        setVisualIndex(currentIndex);
    }, [animateVersion, currentIndex]);

    useEffect(() => {
        if (animateVersion === 0) return;
        const prevIndex = Math.max(0, currentIndex - 1);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        if (raf1Ref.current  !== null) window.cancelAnimationFrame(raf1Ref.current);
        if (raf2Ref.current  !== null) window.cancelAnimationFrame(raf2Ref.current);
        setIsTransitioning(false);
        setVisualIndex(prevIndex);
        raf1Ref.current = window.requestAnimationFrame(() => {
            raf2Ref.current = window.requestAnimationFrame(() => {
                setIsTransitioning(true);
                setVisualIndex(currentIndex);
                timerRef.current = window.setTimeout(() => {
                    setIsTransitioning(false);
                }, SLIDE_DURATION_MS + 120);
            });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animateVersion]);

    // Skull transition — fires after boss is fully consumed
    useEffect(() => {
        if (transitionVersion === 0) return;
        if (timerRef.current   !== null) window.clearTimeout(timerRef.current);
        if (raf1Ref.current    !== null) window.cancelAnimationFrame(raf1Ref.current);
        if (raf2Ref.current    !== null) window.cancelAnimationFrame(raf2Ref.current);
        if (skullT1Ref.current !== null) window.clearTimeout(skullT1Ref.current);
        if (skullT2Ref.current !== null) window.clearTimeout(skullT2Ref.current);
        if (skullT3Ref.current !== null) window.clearTimeout(skullT3Ref.current);

        lockPosRef.current = visualIndex;
        transitionSpriteRef.current = transitionToSprite ?? "";

        setIsTransitioning(false);
        setSkullPhase("warrior-fade");

        skullT1Ref.current = window.setTimeout(() => setSkullPhase("skull"), WARRIOR_FADE_MS);

        skullT2Ref.current = window.setTimeout(() => {
            setSkullPhase("new-sprite-in");
            onTransitionComplete?.();
        }, WARRIOR_FADE_MS + SKULL_HOLD_MS);

        skullT3Ref.current = window.setTimeout(() => setSkullPhase("idle"), WARRIOR_FADE_MS + SKULL_HOLD_MS + NEW_SPRITE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transitionVersion]);

    const resolvedSprite     = resolveSpritePath(spritePath);
    // Use the sprite captured at transition-start so the wrong boss isn't shown mid-animation.
    const resolvedNextSprite = transitionSpriteRef.current
        ? resolveSpritePath(transitionSpriteRef.current)
        : resolvedSprite;

    const daysLabel    = daysRemaining === 1 ? "1 day remains" : `${daysRemaining} days remain`;
    const inTransition = skullPhase !== "idle";
    const activeSprite = skullPhase === "new-sprite-in" ? resolvedNextSprite : resolvedSprite;
    const activeSpriteX = skullPhase === "new-sprite-in" ? 0 : (inTransition ? lockPosRef.current : visualIndex);
    const warriorClass = [
        "boss-countdown-warrior",
        skullPhase === "warrior-fade"  ? "boss-countdown-warrior--fading"   : "",
        skullPhase === "new-sprite-in" ? "boss-countdown-warrior--appearing" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className="boss-countdown" role="status" aria-label={`Boss approach countdown: ${daysLabel}`}>
            <div className="boss-countdown-track">
                <div className="boss-countdown-rail" />

                {Array.from({ length: TOTAL_DOTS }, (_, i) => (
                    <div
                        key={i}
                        className={`boss-countdown-dot${i < battlesCompleted ? " is-passed" : ""}`}
                        style={{ left: `${23 + i * DOT_STEP_PX}px` }}
                    />
                ))}

                {skullPhase !== "skull" ? (
                    <img
                        src={activeSprite}
                        alt=""
                        aria-hidden="true"
                        className={warriorClass}
                        style={{
                            transform: `translateX(${activeSpriteX * DOT_STEP_PX}px)`,
                            transition: (!inTransition && isTransitioning)
                                ? `transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                                : "none",
                        }}
                    />
                ) : null}

                {skullPhase === "skull" ? (
                    <span
                        aria-hidden="true"
                        className="boss-countdown-skull"
                        style={{ left: `${lockPosRef.current * DOT_STEP_PX}px` }}
                    >
                        ☠️
                    </span>
                ) : null}
            </div>

            <p className="boss-countdown-label">{daysLabel}</p>
        </div>
    );
}

export default BossCountdown;
