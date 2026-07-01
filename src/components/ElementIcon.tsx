const spellImages = import.meta.glob<string>("../assets/spells/*.png", { eager: true, import: "default" });

const normalizeIconKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const spellImageMap = new Map<string, string>(
    Object.entries(spellImages).flatMap(([path, url]) => {
        const filename = path.split("/").pop()!.replace(/\.png$/i, "");
        return [
            [filename.toLowerCase(), url],
            [normalizeIconKey(filename), url],
        ];
    }),
);

/** Elements with no own icon: use their base element's icon rendered in greyscale. */
const GREYSCALE_FALLBACKS: Record<string, string> = {
    ash: "fire",
    oil: "water",
    dust: "air",
};

type ElementIconProps = {
    name: string;
    className?: string;
    alt?: string;
};

function ElementIcon({ name, className, alt }: ElementIconProps) {
    const trimmedName = name.trim();
    const normalizedName = normalizeIconKey(trimmedName);
    const imageUrl =
        spellImageMap.get(trimmedName.toLowerCase()) ??
        spellImageMap.get(normalizedName) ??
        (normalizedName === "unstableelement" ? spellImageMap.get("unstable") : undefined);

    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={alt ?? name}
                className={`element-icon${className ? ` ${className}` : ""}`}
                draggable={false}
            />
        );
    }

    const greyscaleFallbackKey = GREYSCALE_FALLBACKS[normalizedName];
    const fallbackUrl = greyscaleFallbackKey ? spellImageMap.get(greyscaleFallbackKey) : undefined;
    if (fallbackUrl) {
        return (
            <img
                src={fallbackUrl}
                alt={alt ?? name}
                className={`element-icon${className ? ` ${className}` : ""}`}
                style={{ filter: "grayscale(1)" }}
                draggable={false}
            />
        );
    }

    return <>{name}</>;
}

export default ElementIcon;
