import { defineMiddleware } from "astro:middleware";
import { buildAccess, CLOSED_POLICY, ROLE_LABEL, requiredRole, type Capability, type Role } from "./lib/access";
import { getAuthProvider } from "./lib/auth";

interface RouteGuard
{
	prefix: string;
	capability: Capability | null;
}

const ROUTE_GUARDS: RouteGuard[] = [
	{ prefix: "/admin/users", capability: "user.manage_role" },
	{ prefix: "/admin/settings", capability: "site.settings" },
	{ prefix: "/admin", capability: "site.audit" },
	{ prefix: "/edit", capability: "entry.propose" },
	{ prefix: "/account", capability: null }
];

function matchGuard(pathname: string): RouteGuard | null
{
	for (const guard of ROUTE_GUARDS)
	{
		if (pathname === guard.prefix || pathname.startsWith(`${guard.prefix}/`))
		{
			return guard;
		}
	}
	return null;
}

function escapeHtml(value: string): string
{
	return value.replace(/[&<>"']/g, (character) =>
		(
			{
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;"
			} as Record<string, string>
		)[character] ?? character
	);
}

function forbiddenResponse(pathname: string, capability: Capability, role: Role | null, policy: { openEditing: boolean }): Response
{
	const minimum = requiredRole(capability, { openEditing: policy.openEditing, openRegistration: false });
	const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>403 · 权限不足</title>
<style>
:root { color-scheme: dark light; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #12100e; color: #e8e2d8; font: 16px/1.7 "Noto Serif SC", Georgia, serif; }
main { max-width: 34rem; padding: 3rem 2rem; }
h1 { font-size: 1.6rem; margin: 0 0 1rem; letter-spacing: 0.02em; }
p { margin: 0 0 0.9rem; color: #b9b0a2; }
code { background: #1d1a16; padding: 0.15em 0.45em; border-radius: 3px; color: #e8e2d8; }
a { color: #d8b46a; }
</style>
</head>
<body>
<main>
<h1>403 · 权限不足</h1>
<p>目标路径：<code>${escapeHtml(pathname)}</code></p>
<p>当前身份：${role ? escapeHtml(ROLE_LABEL[role]) : "未登录"}；该路径要求至少 <code>${escapeHtml(ROLE_LABEL[minimum])}</code> 才能访问。</p>
<p>判定发生在服务端，改前端代码不会放行。</p>
<p><a href="/">回到首页</a></p>
</main>
</body>
</html>
`;
	return new Response(html, {
		status: 403,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}

export const onRequest = defineMiddleware(async (context, next) =>
{
	context.locals.auth = buildAccess(null, CLOSED_POLICY);
	context.locals.authMode = "disabled";
	if (context.isPrerendered)
	{
		return next();
	}
	const guard = matchGuard(context.url.pathname);
	const provider = getAuthProvider(context);
	context.locals.authMode = provider.mode;
	if (!guard)
	{
		return next();
	}
	const user = await provider.getUser();
	const policy = await provider.getPolicy();
	const access = buildAccess(user, policy);
	context.locals.auth = access;
	if (!user)
	{
		const target = `${context.url.pathname}${context.url.search}`;
		return context.redirect(`/login?next=${encodeURIComponent(target)}`);
	}
	if (guard.capability && !access.can(guard.capability))
	{
		return forbiddenResponse(context.url.pathname, guard.capability, access.role, policy);
	}
	return next();
});
