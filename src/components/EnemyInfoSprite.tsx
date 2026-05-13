const spriteModules = import.meta.glob("../assets/sprites/*.gif", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const spriteEntries = Object.entries(spriteModules);

const resolveSpritePath = (inputPath: string): string => {
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
};

function EnemyInfoSprite({ enemyName, spritePath }: EnemyInfoSpriteProps) {
    const resolvedSpritePath = resolveSpritePath(spritePath);

    return <img className="enemy-sprite-image" src={resolvedSpritePath} alt={`${enemyName} sprite`} />;
}

export default EnemyInfoSprite;
