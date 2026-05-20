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

type ElementIconProps = {
    name: string;
    className?: string;
    alt?: string;
};

function ElementIcon({ name, className, alt }: ElementIconProps) {
    const trimmedName = name.trim();
    const imageUrl =
        spellImageMap.get(trimmedName.toLowerCase()) ??
        spellImageMap.get(normalizeIconKey(trimmedName));

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
    return <>{name}</>;
}

export default ElementIcon;
