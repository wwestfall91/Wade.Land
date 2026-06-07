export type StatusEffectType = "active" | "passive" | "stack" | "creation";

export type StatusEffectAmountType = "number" | "percent";

export type StatusEffectTarget = "self" | "enemy";

export type StatusEffectInit = {
	name: string;
	type: StatusEffectType;
	shortDescription: string;
	longDescription: string;
	amount?: number;
	amountType?: StatusEffectAmountType;
	growth?: number;
	duration?: number;
	target?: StatusEffectTarget;
};

export class StatusEffect {
	readonly name: string;
	readonly type: StatusEffectType;
	readonly shortDescription: string;
	readonly longDescription: string;
	readonly amount?: number;
	readonly amountType?: StatusEffectAmountType;
	readonly growth?: number;
	readonly duration?: number;
	readonly target?: StatusEffectTarget;

	constructor({
		name,
		type,
		shortDescription,
		longDescription,
		amount,
		amountType,
		growth,
		duration,
		target,
	}: StatusEffectInit) {
		this.name = name;
		this.type = type;
		this.shortDescription = shortDescription;
		this.longDescription = longDescription;
		this.amount = amount;
		this.amountType = amountType;
		this.growth = growth;
		this.duration = duration;
		this.target = target;
	}

	isActive(): boolean {
		return this.type === "active";
	}

	isPassive(): boolean {
		return this.type === "passive";
	}

	isStack(): boolean {
		return this.type === "stack";
	}

	isCreation(): boolean {
		return this.type === "creation";
	}
}