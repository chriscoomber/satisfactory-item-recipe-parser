import * as fs from "node:fs";
import * as path from "node:path";

const DOCS_JSON_FILE_PATH = path.format(
	path.parse(process.argv[2] || "./data/en-GB.json"),
);

console.log(`Using docs JSON file: "${DOCS_JSON_FILE_PATH}"`);

////
// Raw data types - from satisfactory docs JSON.
////

type ItemClass = {
	ClassName: string;
	mDisplayName: string;
	mForm: string;
	mResourceSinkPoints: string;
};

type RecipeClass = {
	ClassName: string;
	mDisplayName: string;
	mIngredients: string;
	mProduct: string;
	mManufactoringDuration: string;
	mProducedIn: string;
};

type BuildableClass = {
	ClassName: string;
	mCanChangeProductionBoost: string;
};

////
// Local data types, easier to work with.
////

type Item = {
	/** ID under 6 characters, for .mps format */
	shortId: string;
	id: string;
	displayName: string;
	/** Liquids are stored in Desc_FluidCanister_C, gases in Desc_GasTank_C */
	form: "solid" | "liquid" | "gas";
	sinkPoints?: number;
};

type Recipe = {
	/** ID under 6 characters, for .mps format */
	shortId: string;
	id: string;
	displayName: string;
	ingredients: { itemId: string; amount: number }[];
	products: { itemId: string; amount: number }[];
	duration: number; // in seconds
	sloopable: boolean;
};

type Buildable = {
	/** ID under 6 characters, for .mps format */
	shortId: string;
	id: string;
	canChangeProductionBoost: boolean;
};

function parseForm(form: string): "solid" | "liquid" | "gas" | null {
	switch (form) {
		case "RF_SOLID":
			return "solid";
		case "RF_LIQUID":
			return "liquid";
		case "RF_GAS":
			return "gas";
		case "RF_INVALID":
		default:
			return null;
	}
}

function parseIngredients(
	ingredients: string,
): { itemId: string; amount: number }[] {
	const result: { itemId: string; amount: number }[] = [];
	const matches = ingredients.matchAll(
		/\(ItemClass\=\".*?(Desc_[a-zA-Z0-9_]+?)\'\"\,Amount=(\d+)\)/g,
	);
	for (const match of matches) {
		const itemId = match[1];
		const amount = parseInt(match[2], 10);
		result.push({ itemId, amount });
	}
	return result;
}

function parseProducedIn(producedIn: string): { buildableId: string }[] {
	const result: { buildableId: string }[] = [];
	const matches = producedIn.matchAll(/\".*?(Build_[a-zA-Z0-9_]+?)\"/g);
	for (const match of matches) {
		const buildableId = match[1];
		result.push({ buildableId });
	}
	return result;
}

function parseSatisfactoryDocs(): {
	recipes: Recipe[];
	items: Item[];
	buildables: Buildable[];
} {
	const file = fs.readFileSync(DOCS_JSON_FILE_PATH, "utf-8");

	const data = JSON.parse(file);
	const itemClasses: ItemClass[] = [
		...data.find((entry: any) =>
			entry.NativeClass.endsWith("FGItemDescriptor'"),
		)?.Classes,
		...data.find((entry: any) =>
			entry.NativeClass.endsWith("FGResourceDescriptor'"),
		)?.Classes,
	];
	const recipeClasses: RecipeClass[] = data.find((entry: any) =>
		entry.NativeClass.endsWith("FGRecipe'"),
	)?.Classes;
	const buildableClasses: BuildableClass[] = [
		...data.find((entry: any) =>
			entry.NativeClass.endsWith("FGBuildableManufacturer'"),
		)?.Classes,
		...data.find((entry: any) =>
			entry.NativeClass.endsWith("FGBuildableManufacturerVariablePower'"),
		)?.Classes,
	];

	var itemId = 0;
	const items = itemClasses.flatMap((cls) => {
		const form = parseForm(cls.mForm);
		if (form === null) return [];
		if (cls.ClassName.includes("XMAS")) return [];

		const item: Item = {
			id: cls.ClassName,
			shortId:
				cls.ClassName.replace("Desc_", "").replace("_C", "").substring(0, 3) +
				(itemId++).toString().padStart(3, "0"),
			displayName: cls.mDisplayName,
			form: form,
			sinkPoints: (() => {
				const num = parseFloat(cls.mResourceSinkPoints);
				return isNaN(num) ? undefined : num;
			})(),
		};

		return [item];
	});

	var buildablesId = 0;
	const buildables = buildableClasses.flatMap((cls) => {
		const buildable: Buildable = {
			id: cls.ClassName,
			shortId:
				cls.ClassName.replace("Build_", "").replace("_C", "").substring(0, 3) +
				(buildablesId++).toString().padStart(3, "0"),

			canChangeProductionBoost: cls.mCanChangeProductionBoost === "True",
		};
		return [buildable];
	});

	const recipes = recipeClasses.flatMap((cls) => {
		if (cls.mProducedIn === "" || cls.mProducedIn.includes("BuildGun"))
			return [];
		const producedIn = parseProducedIn(cls.mProducedIn);
		const sloopable = producedIn.some((buildableId) => {
			return buildables.some((b) => {
				return b.id === buildableId.buildableId && b.canChangeProductionBoost;
			});
		});
		const ingredients = parseIngredients(cls.mIngredients);
		const products = parseIngredients(cls.mProduct);

		if (ingredients.some((i) => !items.some((it) => it.id === i.itemId)))
			return [];
		if (products.some((i) => !items.some((it) => it.id === i.itemId)))
			return [];

		const recipe: Recipe = {
			id: cls.ClassName,
			shortId:
				cls.ClassName.replace("Build_", "").replace("_C", "").substring(0, 3) +
				(buildablesId++).toString().padStart(3, "0"),
			displayName: cls.mDisplayName,
			ingredients,
			products,
			duration: parseFloat(cls.mManufactoringDuration),
			sloopable,
		};
		return [recipe];
	});

	// Need to manually add raw resource producing recipes.
	// This is a slight fudge as it depends on the miner rank and the resource purity.
	recipes.push(
		{
			id: "MineOreIron",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Ore Iron",
			ingredients: [],
			products: [{ itemId: "Desc_OreIron_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineCoal",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Coal",
			ingredients: [],
			products: [{ itemId: "Desc_Coal_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineOreCopper",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Copper Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreCopper_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineStone",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Limestone",
			ingredients: [],
			products: [{ itemId: "Desc_Stone_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineRawQuartz",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Raw Quartz",
			ingredients: [],
			products: [{ itemId: "Desc_RawQuartz_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "ExtractLiquidOil",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Extract Crude Oil",
			ingredients: [],
			products: [{ itemId: "Desc_LiquidOil_C", amount: 1000 }],
			duration: 0.2,
			sloopable: false,
		},
		{
			id: "ExtractWater",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Extract Water",
			ingredients: [],
			products: [{ itemId: "Desc_Water_C", amount: 1000 }],
			duration: 0.2,
			sloopable: false,
		},
		{
			id: "MineSAM",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine SAM",
			ingredients: [],
			products: [{ itemId: "Desc_SAM_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "ExtractNitrogenGas",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,

			displayName: "Extract Nitrogen Gas",
			ingredients: [],
			products: [{ itemId: "Desc_NitrogenGas_C", amount: 1000 }],
			duration: 0.2,
			sloopable: false,
		},
		{
			id: "MineOreBauxite",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Bauxite Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreBauxite_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineOreGold",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Gold Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreGold_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineSulfur",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Sulfur",
			ingredients: [],
			products: [{ itemId: "Desc_Sulfur_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineOreUranium",
			shortId: `Min${(itemId++).toString().padStart(3, "0")}`,
			displayName: "Mine Uranium Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreUranium_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
	);

	return { recipes, items, buildables };
}

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
				.map(
					(cond) =>
						`              ${cond.name}${" ".repeat(16 - cond.name.length)}${cond.amount}`,
				)
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
				.map(
					(cond) =>
						`              ${cond.name}${" ".repeat(16 - cond.name.length)}${cond.amount}`,
				)
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
				conditions[item.shortId] = (conditions[item.shortId] ?? 0) - amount;
			});
			recipe.products.forEach((prod) => {
				const item = items.find((i) => i.id === prod.itemId)!;
				var amount = Math.ceil(prod.amount * recipeCost);
				// Fudge - fluids take up one belt space (when packaged) per 1000 units
				amount = item.form === "solid" ? amount : Math.ceil(amount / 1000);
				conditions[item.shortId] = (conditions[item.shortId] ?? 0) + amount;
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

if (require.main === module) {
	const { recipes, items, buildables } = parseSatisfactoryDocs();
	const mpsFileString = generateLPProblemMpsFileStringMinimizeBeltLoad(
		0.25,
		recipes,
		items,
	);
	fs.mkdirSync("output", { recursive: true });
	fs.writeFileSync("output/recipes.json", JSON.stringify(recipes, null, 2));
	fs.writeFileSync("output/items.json", JSON.stringify(items, null, 2));
	fs.writeFileSync(
		"output/buildables.json",
		JSON.stringify(buildables, null, 2),
	);
	fs.writeFileSync("output/satisfactory_min.mps", mpsFileString);
}
