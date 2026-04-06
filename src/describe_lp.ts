import * as fs from "node:fs";
import { Item, Recipe } from "./parse";

export function describeLPSolution(recipes: Recipe[], items: Item[]): string {
	const solutionString = fs.readFileSync("output/satisfactory.sol", "utf-8");

	const [preamble, _postamble] = solutionString.split(
		"   No.   Row name   St   Activity     Lower bound   Upper bound    Marginal",
	);

	const itemsWithActivity = items.flatMap(
		(item): { item: Item; activity: number }[] => {
			const regex = new RegExp(
				`^\\s+\\d+\\s+${item.shortId}\\s+[A-Z]+\\s+([0-9\\.]+)`,
				"m",
			);
			const match = solutionString.match(regex);
			if (match) {
				const activity = parseFloat(match[1]);
				if (activity != 0) {
					return [{ item, activity }];
				}
			}
			return [];
		},
	);
	// .sort((a, b) => (a.item.sinkPoints ?? 0) - (b.item.sinkPoints ?? 0));

	const recipesWithActivity = recipes
		.flatMap((recipe): { recipe: Recipe; activity: number }[] => {
			const regex = new RegExp(
				`^\\s+\\d+\\s+${recipe.shortId}\\s+[A-Z]+\\s+([0-9\\.]+)`,
				"m",
			);
			const match = solutionString.match(regex);
			if (match) {
				const activity = parseFloat(match[1]);
				if (activity != 0) {
					return [{ recipe, activity }];
				}
			}
			return [];
		})
		.sort((a, b) => {
			const aValue = Math.max(
				...a.recipe.products.map((prod) => {
					const item = items.find((i) => i.id === prod.itemId)!;
					return item.sinkPoints ?? -1;
				}),
			);
			const bValue = Math.max(
				...b.recipe.products.map((prod) => {
					const item = items.find((i) => i.id === prod.itemId)!;
					return item.sinkPoints ?? -1;
				}),
			);
			return aValue - bValue;
		});

	return `${preamble}
# Items:
${itemsWithActivity
	.map(
		({ item, activity }) =>
			`- ${item.displayName}: ${activity.toFixed(2)} units/sec`,
	)
	.join("\n")}

# Recipes:
${recipesWithActivity
	.map(
		({ recipe, activity }) =>
			`- ${recipe.displayName}: ${activity.toFixed(2)} buildings`,
	)

	.join("\n")}`;
}
