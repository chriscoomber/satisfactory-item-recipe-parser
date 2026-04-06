import { Item, Recipe } from "./parse";

function trimMargin(str: string): string {
	return str.replace(/^\s*\|/gm, "").replace(/^\n/g, "");
}

function formatMpsFileString(
	name: string,
	minimize: boolean,
	rows: { kind: "N" | "G" | "L" | "E"; name: string; comment: string }[],
	columns: {
		comment: string;
		name: string;
		condition: { name: string; amount: number }[];
	}[],
	rhs: {
		comment: string;
		name: string;
		condition: { name: string; amount: number }[];
	}[],
): string {
	return trimMargin(`
		|NAME          ${name}
		|*OBJSENSE
		|*    ${minimize ? "MIN" : "MAX"}
		|ROWS
		|${rows.map((r) => ` ${r.kind}  ${r.name}${" ".repeat(10 - r.name.length)}$ ${r.comment}`).join("\n")}
		|COLUMNS
		|${columns
			.map((c) =>
				trimMargin(`
			|* ${c.comment}
			|    ${c.name}${" ".repeat(10 - c.name.length)}${c.condition[0].name}${" ".repeat(16 - c.condition[0].name.length)}${c.condition[0].amount}
			|${c.condition
				.slice(1)
				.map((cond) => {
					const amountIntegral = cond.amount.toString().includes(".")
						? cond.amount.toString().split(".")[0]
						: cond.amount.toString();
					return `              ${cond.name}${" ".repeat(17 - cond.name.length - amountIntegral.length)}${cond.amount.toFixed(4)}`;
				})
				.join("\n")}`),
			)
			.join("\n")}
		|RHS
		|${rhs
			.map((c) =>
				trimMargin(`
			|* ${c.comment}
			|    ${c.name}${" ".repeat(10 - c.name.length)}${c.condition[0].name}${" ".repeat(16 - c.condition[0].name.length)}${c.condition[0].amount}
			|${c.condition
				.slice(1)
				.map((cond) => {
					const amountIntegral = cond.amount.toString().includes(".")
						? cond.amount.toString().split(".")[0]
						: cond.amount.toString();
					return `              ${cond.name}${" ".repeat(17 - cond.name.length - amountIntegral.length)}${cond.amount.toFixed(4)}`;
				})
				.join("\n")}
		`),
			)
			.join("\n")}
		|ENDATA
`);
}

function generateLPProblemMpsFileStringMinimizeBeltLoad(
	recipeCost: number,
	recipes: Recipe[],
	items: Item[],
): string {
	return formatMpsFileString(
		"SATISF",
		true,
		[
			{ kind: "N", name: "Load", comment: "Max belt load" },
			...items.map((item) => ({
				kind: "G" as const,
				name: item.shortId,
				comment: item.displayName,
			})),
		],
		recipes.map((recipe) => {
			const conditions: Record<string, number> = {};
			recipe.ingredients.forEach((ing) => {
				const item = items.find((i) => i.id === ing.itemId)!;
				var amount = Math.ceil(ing.amount * recipeCost);
				// Fudge - fluids take up one belt space (when packaged) per 1000 units
				amount = item.form === "solid" ? amount : Math.ceil(amount / 1000);
				conditions[item.shortId] =
					(conditions[item.shortId] ?? 0) - (amount * 60) / recipe.duration;
			});
			recipe.products.forEach((prod) => {
				const item = items.find((i) => i.id === prod.itemId)!;
				var amount = Math.ceil(prod.amount * recipeCost);
				// Fudge - fluids take up one belt space (when packaged) per 1000 units
				amount = item.form === "solid" ? amount : Math.ceil(amount / 1000);
				conditions[item.shortId] =
					(conditions[item.shortId] ?? 0) + (amount * 60) / recipe.duration;
			});
			const beltPressure = Math.max(
				0,
				Object.values(conditions).reduce((sum, val) => sum + val, 0),
			);

			return {
				comment: recipe.displayName,
				name: recipe.shortId,
				condition: [
					{ name: "Load", amount: beltPressure },
					...Object.entries(conditions).map(([name, amount]) => ({
						name,
						amount,
					})),
				],
			};
		}),
		[
			{
				name: "Requir",
				comment: "Required amount of final products",
				condition: [
					{
						name: items.find((i) => i.id === "Desc_SpaceElevatorPart_11_C")!
							.shortId,
						amount: 1,
					},
				],
			},
		],
	);
}

export function generateLPProblemMpsFileString(
	scenario: string,
	recipes: Recipe[],
	items: Item[],
): string {
	console.log(
		`Generating LP problem MPS file string for scenario "${scenario}"...`,
	);

	switch (scenario) {
		case "1":
			return generateLPProblemMpsFileStringMinimizeBeltLoad(
				0.25,
				recipes,
				items,
			);
		default:
			throw new Error(`Unknown scenario: ${scenario}`);
	}
}
