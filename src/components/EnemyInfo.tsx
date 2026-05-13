import EnemyInfoSprite from "./EnemyInfoSprite";
import "./EnemyInfo.scss";

type EnemyInfoProps = {
    enemyName: string;
    enemyHealth: number;
    enemyDescription: string;
};

function EnemyInfo({ enemyName, enemyHealth, enemyDescription }: EnemyInfoProps) {
    return (
        <div id="EnemyInfo" title="">
            <div className="enemy-info-header">
                <div className="enemy-info-name">{enemyName}</div>
                <div className="enemy-info-health">{enemyHealth} HP</div>
            </div>
            <div className="enemy-info-sprite">
                <EnemyInfoSprite enemyName={enemyName} />
            </div>
            {enemyDescription.length > 0 ? (
                <div className="enemy-info-description">{enemyDescription}</div>
            ) : null}
        </div>
    );
}

export default EnemyInfo;
