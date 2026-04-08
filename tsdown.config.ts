import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/main.ts"],
	format: "esm",
	outDir: "lib",
	clean: true,
	deps: {
		alwaysBundle: [/.*/],
		onlyBundle: false
	}
});
