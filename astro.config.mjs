import { defineConfig } from "astro/config";

const deployTarget = process.env.DEPLOY_TARGET ?? "node";
const site = process.env.SITE_URL ?? "http://localhost:4321";
const siteHostname = new URL(site).hostname;

const adapter = deployTarget === "cloudflare"
	? (await import("@astrojs/cloudflare")).default()
	: (await import("@astrojs/node")).default({ mode: "standalone" });

// allowedDomains 为空时，node 适配器会丢弃请求主机名，Astro.url 退化成 http://localhost，
// 后果是 CSRF 同源校验拒绝一切表单 POST，且 OAuth 回调原点错误。本地回环须显式放行。
const allowedDomains = [
	{ protocol: "http", hostname: "localhost" },
	{ protocol: "https", hostname: "localhost" },
	{ protocol: "http", hostname: "127.0.0.1" },
	{ protocol: "https", hostname: "127.0.0.1" },
	{ protocol: "https", hostname: siteHostname },
	{ protocol: "http", hostname: siteHostname }
];

export default defineConfig({
	adapter,
	output: "static",
	site,
	base: process.env.BASE_PATH ?? "/",
	trailingSlash: "ignore",
	security: {
		checkOrigin: true,
		allowedDomains
	},
	build: {
		format: "directory"
	}
});
