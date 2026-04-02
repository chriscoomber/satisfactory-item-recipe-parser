import * as fs from "node:fs";
import * as path from "node:path";

const DOCS_JSON_FILE_PATH = path.format(
	path.parse(process.argv[2] || "./data/en-GB.json"),
);

console.log(`Using docs JSON file: "${DOCS_JSON_FILE_PATH}"`);

type Item = {
	id: string;
	displayName: string;
	/** Liquids are stored in Desc_FluidCanister_C, gases in Desc_GasTank_C */
	form: "solid" | "liquid" | "gas";
};

type Recipe = {
	id: string;
	displayName: string;
	ingredients: { itemId: string; amount: number }[];
	products: { itemId: string; amount: number }[];
	duration: number; // in seconds
	sloopable: boolean;
};

type Buildable = {
	id: string;
	canChangeProductionBoost: boolean;
};

type ItemClass = {
	ClassName: string;
	mDisplayName: string;
	mForm: string;
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

function main() {
	const file = fs.readFileSync(DOCS_JSON_FILE_PATH, "utf-8");

	const data = JSON.parse(file);
	const itemClasses: ItemClass[] = data.find((entry: any) =>
		entry.NativeClass.endsWith("FGItemDescriptor'"),
	)?.Classes;
	const recipeClasses: RecipeClass[] = data.find((entry: any) =>
		entry.NativeClass.endsWith("FGRecipe'"),
	)?.Classes;
	const buildableClasses: BuildableClass[] = data.find((entry: any) =>
		entry.NativeClass.endsWith("FGBuildableManufacturer'"),
	)?.Classes;

	const items = itemClasses.flatMap((cls) => {
		const form = parseForm(cls.mForm);
		if (form === null) {
			return [];
		}

		const item: Item = {
			id: cls.ClassName,
			displayName: cls.mDisplayName,
			form: form,
		};

		return [item];
	});

	const buildables = buildableClasses.flatMap((cls) => {
		const buildable: Buildable = {
			id: cls.ClassName,
			canChangeProductionBoost: cls.mCanChangeProductionBoost === "True",
		};
		return [buildable];
	});

	const recipes = recipeClasses.flatMap((cls) => {
		if (cls.mProducedIn === "" || cls.mProducedIn.includes("BuildGun")) {
			return [];
		}
		const producedIn = parseProducedIn(cls.mProducedIn);
		console.log(producedIn)
		const sloopable = producedIn.some((buildableId) =>
			{
				return buildables.some(
					(b) => {
						console.log(b);
						return b.id === buildableId.buildableId && b.canChangeProductionBoost;
					}
				);
			},
		);

		const recipe: Recipe = {
			id: cls.ClassName,
			displayName: cls.mDisplayName,
			ingredients: parseIngredients(cls.mIngredients),
			products: parseIngredients(cls.mProduct),
			duration: parseFloat(cls.mManufactoringDuration),
			sloopable,
		};
		return [recipe];
	});

	fs.mkdirSync("output", { recursive: true });
	fs.writeFileSync(
		"output/items.json",
		JSON.stringify(items, null, 2),
		"utf-8",
	);
	fs.writeFileSync(
		"output/recipes.json",
		JSON.stringify(recipes, null, 2),
		"utf-8",
	);
		fs.writeFileSync(
		"output/buildables.json",
		JSON.stringify(buildables, null, 2),
		"utf-8",
	);
}

if (require.main === module) {
	main();
}
