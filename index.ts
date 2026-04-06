import * as fs from "node:fs";
import * as path from "node:path";
import { parseSatisfactoryDocs } from "./src/parse";
import { generateLPProblemMpsFileString } from "./src/write_lp";
import { describe } from "node:test";
import { describeLPSolution } from "./src/describe_lp";

const args = process.argv.slice(2);

const PARSE = args.includes("--parse");
const WRITE_LP = args.includes("--write-lp");
const DESCRIBE_LP = args.includes("--describe-lp");
const MODE: "PARSE" | "WRITE_LP" | "DESCRIBE_LP" = PARSE
	? "PARSE"
	: WRITE_LP
		? "WRITE_LP"
		: DESCRIBE_LP
			? "DESCRIBE_LP"
			: "PARSE";

const DOCS_JSON_FILE_PATH =
	args.find((arg) => arg.startsWith("--doc="))?.split("=")[1] ??
	path.join(__dirname, "./data/en-GB.json");

const LP =
	args.find((arg) => arg.startsWith("--lp="))?.split("=")[1] ?? undefined;

if (require.main === module) {
	console.log(`Running in mode: ${MODE}`);

	const { recipes, items, buildables } =
		parseSatisfactoryDocs(DOCS_JSON_FILE_PATH);
	fs.mkdirSync("output", { recursive: true });

	switch (MODE) {
		case "PARSE": {
			fs.writeFileSync("output/recipes.json", JSON.stringify(recipes, null, 2));
			fs.writeFileSync("output/items.json", JSON.stringify(items, null, 2));
			fs.writeFileSync(
				"output/buildables.json",
				JSON.stringify(buildables, null, 2),
			);

			break;
		}
		case "WRITE_LP": {
			const mpsFileString = generateLPProblemMpsFileString("1", recipes, items);
			fs.writeFileSync("output/satisfactory.mps", mpsFileString);
			break;
		}
		case "DESCRIBE_LP": {
			const mpsFileString = describeLPSolution(recipes, items);
			fs.writeFileSync(
				"output/satisfactory_solution_description.txt",
				mpsFileString,
			);
			break;
		}
	}
}
