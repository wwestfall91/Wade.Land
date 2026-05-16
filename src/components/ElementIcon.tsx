const spellImages = import.meta.glob<string>("../assets/spells/*.png", { eager: true, import: "default" });

const spellImageMap = new Map<string, string>(
    Object.entries(spellImages).map(([path, url]) => {
        const filename = path.split("/").pop()!.replace(/\.png$/i, "");
        return [filename.toLowerCase(), url];
    }),
);

type ElementIconProps = {
    name: string;
    className?: string;
    alt?: string;
};

function ElementIcon({ name, className, alt }: ElementIconProps) {
    const imageUrl = spellImageMap.get(name.trim().toLowerCase());
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
