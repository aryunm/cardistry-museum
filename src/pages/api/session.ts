import type { APIRoute } from "astro";
import { buildAccess, ROLE_LABEL, type Capability } from "../../lib/access";
import { AUTH_MODE_LABEL, getAuthProvider } from "../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async (context) =>
{
	const provider = getAuthProvider(context);
	const user = await provider.getUser();
	const policy = await provider.getPolicy();
	const access = buildAccess(user, policy);
	const capabilities: Capability[] = [];
	for (const capability of ["entry.read", "entry.propose", "entry.publish", "revision.review", "site.audit", "user.manage_role", "site.settings"] as Capability[])
	{
		if (access.can(capability))
		{
			capabilities.push(capability);
		}
	}
	const nav: { href: string; label: string }[] = [];
	if (user)
	{
		nav.push({ href: "/account/", label: "账号" });
	}
	if (access.can("site.audit"))
	{
		nav.push({ href: "/admin/", label: "站务台" });
	}
	if (access.can("user.manage_role"))
	{
		nav.push({ href: "/admin/users/", label: "用户" });
	}
	const payload = {
		authenticated: Boolean(user),
		displayName: user?.displayName ?? null,
		email: user?.email ?? null,
		role: access.role,
		roleLabel: access.role ? ROLE_LABEL[access.role] : null,
		mode: provider.mode,
		modeLabel: AUTH_MODE_LABEL[provider.mode],
		suspended: user?.suspended ?? false,
		editingOpen: policy.openEditing,
		capabilities,
		nav
	};
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
};
