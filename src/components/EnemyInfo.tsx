import EnemyInfoSprite from "./EnemyInfoSprite";
import "./EnemyInfo.scss";

type EnemyInfoProps = {
    enemyName: string;
    enemyHealth: number;
    enemyDescription: string;
    enemyWeaknesses: string[];
    enemySpritePath: string;
};

function EnemyInfo({ enemyName, enemyHealth, enemyDescription, enemyWeaknesses, enemySpritePath }: EnemyInfoProps) {
    const weaknesses = enemyWeaknesses.filter((value) => value.trim().length > 0);
    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    return (
        <div id="EnemyInfo">
            <div className="enemy-info-header">
                <div className="enemy-info-name">{enemyName}</div>
                <div className="enemy-info-health">{enemyHealth} HP</div>
            </div>
            <div className="next-enemy-text">Next Enemy</div>
            <div className="enemy-info-sprite">
                <EnemyInfoSprite enemyName={enemyName} spritePath={enemySpritePath} />
            </div>
            {enemyDescription.length > 0 || enemyWeaknesses.length > 0 ? (
                <div className="enemy-info-description">
                    {enemyDescription.length > 0 ? <div className="enemy-description-text">{enemyDescription}</div> : null}
                    <div className="enemy-weakness-text">
                        <span className="enemy-weakness-label">Weaknesses:</span>
                        <span className="enemy-weakness-list">
                            {weaknesses.length > 0 ? (
                                weaknesses.map((weakness) => (
                                    <span key={weakness} className={`type-chip ${toTypeClass(weakness)}`}>
                                        {weakness}
                                    </span>
                                ))
                            ) : (
                                <span className="type-chip type-none">None</span>
                            )}
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default EnemyInfo;
