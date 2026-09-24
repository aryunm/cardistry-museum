import type { APIRoute } from "astro";
import { getAuthProvider } from "../lib/auth";
import { recordAudit } from "../lib/audit";

export const prerender = false;

const SCOPES = ["local", "others", "global"] as const;

type Scope = (typeof SCOPES)[number];

function readScope(value: FormDataEntryValue | null): Scope
{
	const scope = String(value ?? "local");
	return (SCOPES as readonly string[]).includes(scope) ? (scope as Scope) : "local";
}

export const POST: APIRoute = async (context) =>
{
	const form = await context.request.formData();
	const scope = readScope(form.get("scope"));
	const provider = getAuthProvider(context);
	const result = await provider.signOut(scope);
	await recordAudit(context, { action: "auth.sign_out", detail: { scope, error: result.error } });
	const target = scope === "others" ? "/account/sessions/?revoked=others" : "/";
	return context.redirect(target);
};
