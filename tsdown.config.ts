import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	format: "esm",
	platform: "node",
	clean: true,
	minify: true,
	dts: false,
	sourcemap: false,
});
