import { defineConfig } from "astro/config";

export default defineConfig({
	site: process.env.SITE_URL ?? "http://localhost:4321",
	base: process.env.BASE_PATH ?? "/",
	trailingSlash: "ignore",
	build: {
		format: "directory"
	}
});
