import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MonsterReward, RewardApplyContext } from "../../combat/rewardFactory";
import "./MonsterUpgradeModal.scss";

type MonsterUpgradeModalProps = {
    rewards: MonsterReward[];
    applyContext: RewardApplyContext;
    onConfirm: () => void;
};

function MonsterUpgradeModal({ rewards, applyContext, onConfirm }: MonsterUpgradeModalProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const closeTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            if (closeTimeoutRef.current !== null) {
                window.clearTimeout(closeTimeoutRef.current);
            }
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const handleConfirm = () => {
        if (isClosing || selectedIndex === null) return;
        const reward = rewards[selectedIndex];
        if (!reward) return;
        reward.apply(applyContext);
        setIsClosing(true);
        closeTimeoutRef.current = window.setTimeout(() => {
            onConfirm();
        }, 180);
    };

    const modal = (
        <div
            className={`upgrade-modal-overlay${isClosing ? " is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Choose an upgrade"
        >
            <div className={`upgrade-modal${isClosing ? " is-closing" : ""}`}>
                <h2 className="upgrade-modal-title">Choose an Upgrade!</h2>
                <div className="upgrade-modal-choices">
                    {rewards.map((reward, index) => (
                        <button
                            key={reward.name}
                            type="button"
                            className={`upgrade-choice${selectedIndex === index ? " is-selected" : ""}`}
                            onClick={() => setSelectedIndex(index)}
                        >
                            <span className="upgrade-choice-name">{reward.name}</span>
                            <span className="upgrade-choice-description">{reward.description}</span>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="upgrade-modal-confirm"
                    disabled={selectedIndex === null || isClosing}
                    onClick={handleConfirm}
                >
                    CLAIM
                </button>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

export default MonsterUpgradeModal;
