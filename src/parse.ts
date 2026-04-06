import * as fs from "node:fs";

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

export type Item = {
	/** ID under 6 characters, for .mps format */
	shortId: string;
	id: string;
	displayName: string;
	/** Liquids are stored in Desc_FluidCanister_C, gases in Desc_GasTank_C */
	form: "solid" | "liquid" | "gas";
	sinkPoints?: number;
};

export type Recipe = {
	/** ID under 6 characters, for .mps format */
	shortId: string;
	id: string;
	displayName: string;
	ingredients: { itemId: string; amount: number }[];
	products: { itemId: string; amount: number }[];
	duration: number; // in seconds
	sloopable: boolean;
};

export type Buildable = {
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

export function parseSatisfactoryDocs(filename: string): {
	recipes: Recipe[];
	items: Item[];
	buildables: Buildable[];
} {
	console.log(`Using docs JSON file: "${filename}"`);

	const file = fs.readFileSync(filename, "utf-8");

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

	var globalId = 0;
	const items = itemClasses.flatMap((cls) => {
		const form = parseForm(cls.mForm);
		if (form === null) return [];
		if (cls.ClassName.includes("XMAS")) return [];

		const item: Item = {
			id: cls.ClassName,
			shortId:
				cls.ClassName.replace("Desc_", "").replace("_C", "").substring(0, 3) +
				(globalId++).toString().padStart(3, "0"),
			displayName: cls.mDisplayName,
			form: form,
			sinkPoints: (() => {
				const num = parseFloat(cls.mResourceSinkPoints);
				return isNaN(num) ? undefined : num;
			})(),
		};

		return [item];
	});

	const buildables = buildableClasses.flatMap((cls) => {
		const buildable: Buildable = {
			id: cls.ClassName,
			shortId:
				cls.ClassName.replace("Build_", "").replace("_C", "").substring(0, 3) +
				(globalId++).toString().padStart(3, "0"),

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
				cls.ClassName.replace("Recipe_", "").replace("_C", "").substring(0, 3) +
				(globalId++).toString().padStart(3, "0"),
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
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Ore Iron",
			ingredients: [],
			products: [{ itemId: "Desc_OreIron_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineCoal",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Coal",
			ingredients: [],
			products: [{ itemId: "Desc_Coal_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineOreCopper",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Copper Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreCopper_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineStone",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Limestone",
			ingredients: [],
			products: [{ itemId: "Desc_Stone_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineRawQuartz",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Raw Quartz",
			ingredients: [],
			products: [{ itemId: "Desc_RawQuartz_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "ExtractLiquidOil",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Extract Crude Oil",
			ingredients: [],
			products: [{ itemId: "Desc_LiquidOil_C", amount: 1000 }],
			duration: 0.2,
			sloopable: false,
		},
		{
			id: "ExtractWater",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Extract Water",
			ingredients: [],
			products: [{ itemId: "Desc_Water_C", amount: 1000 }],
			duration: 0.2,
			sloopable: false,
		},
		{
			id: "MineSAM",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine SAM",
			ingredients: [],
			products: [{ itemId: "Desc_SAM_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "ExtractNitrogenGas",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,

			displayName: "Extract Nitrogen Gas",
			ingredients: [],
			products: [{ itemId: "Desc_NitrogenGas_C", amount: 1000 }],
			duration: 0.2,
			sloopable: false,
		},
		{
			id: "MineOreBauxite",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Bauxite Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreBauxite_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineOreGold",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Gold Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreGold_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineSulfur",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Sulfur",
			ingredients: [],
			products: [{ itemId: "Desc_Sulfur_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
		{
			id: "MineOreUranium",
			shortId: `Min${(globalId++).toString().padStart(3, "0")}`,
			displayName: "Mine Uranium Ore",
			ingredients: [],
			products: [{ itemId: "Desc_OreUranium_C", amount: 1 }],
			duration: 0.1,
			sloopable: false,
		},
	);

	return { recipes, items, buildables };
}
