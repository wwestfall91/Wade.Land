import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
    statusEffectDescriptors,
    statusEffectsRegistry,
    type StatusEffectsRegistry,
} from "../combat/statusEffectsRegistry";

type StatusEffectsContextValue = {
    effects: typeof statusEffectDescriptors;
    registry: StatusEffectsRegistry;
};

const defaultValue: StatusEffectsContextValue = {
    effects: statusEffectDescriptors,
    registry: statusEffectsRegistry,
};

const StatusEffectsContext = createContext<StatusEffectsContextValue>(defaultValue);

type StatusEffectsProviderProps = {
    children: ReactNode;
};

export function StatusEffectsProvider({ children }: StatusEffectsProviderProps) {
    const value = useMemo<StatusEffectsContextValue>(() => ({
        effects: statusEffectDescriptors,
        registry: statusEffectsRegistry,
    }), []);

    return (
        <StatusEffectsContext.Provider value={value}>
            {children}
        </StatusEffectsContext.Provider>
    );
}

export function useStatusEffects() {
    return useContext(StatusEffectsContext);
}
