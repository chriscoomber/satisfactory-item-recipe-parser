# Satisfactory items/recipes parser

Windows only

## Usage

### Parsing a docs file into items, recipes and buildables

```
npm run parse
```

Look in `output` folder.

If you want to provide your own docs JSON file (e.g. from `C:\Program Files\Epic Games\SatisfactoryExperimental\CommunityResources\Docs\en-GB.json` or `C:\Program Files (x86)\Steam\steamapps\common\Satisfactory\CommunityResources\Docs\en-GB.json`), use like:

```
npm run parse -- --doc="C:\path\to\file.json"
```

Note that this doesn't handle control characters well, so it might be wise to sanitise (a copy of) the document first.

### LP problem definitions

```
npm run write-lp -- --lp=1 # For example
```

The LP problem scenarios are:

1. For a sushi belt factory, minimizing belt load, whilst producing one Ballistic Warp Drive per second, at 0.25x parts. Run with --min.

This writes a problem definition to [./output/satisfactory.mps](./output/satisfactory.mps)

### Running an LP problem

```
npm run lp -- --max # or --max
```

This write a result to [./output/satisfactory.sol](./output/satisfactory.sol)

### Describing an LP solution

After running the above, run

```
npm run describe-lp
```