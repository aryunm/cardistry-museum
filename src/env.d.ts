/// <reference types="astro/client" />

declare namespace App
{
	interface Locals
	{
		auth: import("./lib/access").AccessContext;
		authMode: import("./lib/auth/provider").AuthMode;
	}
}
