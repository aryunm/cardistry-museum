import type { APIContext } from "astro";
import { getAuthProvider } from "./auth";
import type { AuditEvent } from "./auth/provider";

export type { AuditEvent };

export async function recordAudit(context: APIContext, event: AuditEvent): Promise<void>
{
	await getAuthProvider(context).logAudit(event);
}
