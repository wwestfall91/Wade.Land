import { useLayoutEffect, useRef } from "react";

const spriteModules = import.meta.glob("../assets/sprites/*.gif", {
    eager: true,
    import: "default",
}) as Record<string, string>;

// Homunculus sprites (populated when files are added to src/assets/homunculus/)
const homunculusModules = import.meta.glob("../assets/homunculus/*", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const spriteEntries = [
    ...Object.entries(spriteModules),
    ...Object.entries(homunculusModules),
];

export const resolveSpritePath = (inputPath: string): string => {
    if (spriteEntries.length === 0) {
        return "";
    }

    const normalizedInput = inputPath.replace(/\\/g, "/").trim().toLowerCase();
    const inputFileName = normalizedInput.split("/").pop() ?? "";

    const byFileName = spriteEntries.find(([modulePath]) => {
        const moduleFileName = modulePath.split("/").pop()?.toLowerCase() ?? "";
        return moduleFileName === inputFileName;
    });

    if (byFileName) {
        return byFileName[1];
    }

    const byContainedPath = normalizedInput.length
        ? spriteEntries.find(([modulePath]) => modulePath.toLowerCase().includes(normalizedInput))
        : null;

    if (byContainedPath) {
        return byContainedPath[1];
    }

    return spriteEntries[0][1];
};

type EnemyInfoSpriteProps = {
    enemyName: string;
    spritePath: string;
    /** When true, renders a canvas snapshot of the first available frame instead
     *  of the live GIF, effectively pausing the animation. */
    frozen?: boolean;
};

function EnemyInfoSprite({ enemyName, spritePath, frozen = false }: EnemyInfoSpriteProps) {
    const resolvedSpritePath = resolveSpritePath(spritePath);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Whenever the component enters frozen mode, capture whatever frame is
    // currently rendered and paint it onto the canvas.
    useLayoutEffect(() => {
        if (!frozen) return;
        const img = imgRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        const paint = () => {
            const w = img.naturalWidth || img.offsetWidth || 64;
            const h = img.naturalHeight || img.offsetHeight || 64;
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        };

        if (img.complete && img.naturalWidth > 0) {
            paint();
        } else {
            img.addEventListener("load", paint, { once: true });
        }
    }, [frozen, resolvedSpritePath]);

    return (
        <>
            {/* Always keep the img in the DOM so the canvas can sample it */}
            <img
                ref={imgRef}
                src={resolvedSpritePath}
                alt={`${enemyName} sprite`}
                className={frozen ? undefined : "enemy-sprite-image"}
                style={frozen ? { position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 } : undefined}
                onLoad={() => {
                    if (!frozen) return;
                    const img = imgRef.current;
                    const canvas = canvasRef.current;
                    if (!img || !canvas) return;
                    const w = img.naturalWidth || 64;
                    const h = img.naturalHeight || 64;
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
                }}
            />
            {frozen && (
                <canvas
                    ref={canvasRef}
                    className="enemy-sprite-image"
                    aria-label={`${enemyName} sprite`}
                    style={{ imageRendering: "pixelated" }}
                />
            )}
        </>
    );
}

export default EnemyInfoSprite;
