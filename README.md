# Satisfactory items/recipes parser

## Usage

```
npm run parse
```

Look in `output` folder.

If you want to provide your own docs JSON file (e.g. from `C:\Program Files\Epic Games\SatisfactoryExperimental\CommunityResources\Docs\en-GB.json` or `C:\Program Files (x86)\Steam\steamapps\common\Satisfactory\CommunityResources\Docs\en-GB.json`), use like:

```
npm run parse -- "C:\path\to\file"
```

Note that this doesn't handle control characters well, so it might be wise to sanitise (a copy of) the document first.
