import warriorSprite from "../assets/sprites/Warrior.png";

type EnemyInfoSpriteProps = {
    enemyName: string;
};

function EnemyInfoSprite({ enemyName }: EnemyInfoSpriteProps) {
    return <img className="enemy-sprite-image" src={warriorSprite} alt={`${enemyName} sprite`} />;
}

export default EnemyInfoSprite;
