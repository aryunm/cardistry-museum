import type { APIRoute } from "astro";
import { getAuthProvider } from "../../lib/auth";
import { recordAudit } from "../../lib/audit";

export const prerender = false;

function safeNext(value: string | null): string
{
	if (!value || !value.startsWith("/") || value.startsWith("//"))
	{
		return "/account/";
	}
	return value;
}

export const GET: APIRoute = async (context) =>
{
	const url = new URL(context.request.url);
	const next = safeNext(url.searchParams.get("next"));
	const code = url.searchParams.get("code");
	const failure = url.searchParams.get("error_description") ?? url.searchParams.get("error");
	if (failure)
	{
		return context.redirect(`/login/?error=${encodeURIComponent(failure)}`);
	}
	if (!code)
	{
		return context.redirect("/login/?error=%E5%9B%9E%E8%B0%83%E7%BC%BA%E5%B0%91%E6%8E%88%E6%9D%83%E7%A0%81");
	}
	const provider = getAuthProvider(context);
	const result = await provider.completeSignIn(code);
	if (result.error)
	{
		return context.redirect(`/login/?error=${encodeURIComponent(result.error)}`);
	}
	const user = await provider.getUser();
	await recordAudit(context, { action: "auth.sign_in", detail: { email: user?.email ?? null, role: user?.role ?? null } });
	return context.redirect(next);
};
