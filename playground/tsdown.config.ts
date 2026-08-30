import { defineConfig } from "tsdown";

// A plain global script, not ESM: index.html is opened straight from disk, and
// `file://` blocks module imports.
export default defineConfig({
	entry: ["entry.ts"],
	outDir: ".",
	format: "iife",
	globalName: "TS",
	platform: "browser",
	outputOptions: { entryFileNames: "check.iife.js" },
	clean: false,
	dts: false,
	sourcemap: false,
});
