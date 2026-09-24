export const ROLES = ["reader", "contributor", "moderator", "owner"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
	reader: "读者",
	contributor: "贡献者",
	moderator: "管理员",
	owner: "站长"
};

export const ROLE_DUTY: Record<Role, string> = {
	reader: "浏览全部条目。",
	contributor: "提交条目修订，须经管理员审核后才会发布。",
	moderator: "审核修订、处理条目、停用账号；不可调整他人角色。",
	owner: "站长。全部权限，含角色分配与站点开关。"
};

const RANK: Record<Role, number> = {
	reader: 0,
	contributor: 1,
	moderator: 2,
	owner: 3
};

export const CAPABILITIES = [
	"entry.read",
	"entry.propose",
	"entry.publish",
	"entry.delete",
	"revision.review",
	"user.invite",
	"user.manage_role",
	"user.suspend",
	"site.settings",
	"site.audit"
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<Capability, string> = {
	"entry.read": "浏览条目",
	"entry.propose": "提交修订",
	"entry.publish": "发布条目",
	"entry.delete": "删除条目",
	"revision.review": "审核修订",
	"user.invite": "发出邀请",
	"user.manage_role": "调整他人角色",
	"user.suspend": "停用账号",
	"site.settings": "站点设置",
	"site.audit": "查看审计日志"
};

const MINIMUM_ROLE: Record<Capability, Role> = {
	"entry.read": "reader",
	"entry.propose": "moderator",
	"entry.publish": "moderator",
	"entry.delete": "moderator",
	"revision.review": "moderator",
	"user.invite": "moderator",
	"user.manage_role": "owner",
	"user.suspend": "moderator",
	"site.settings": "owner",
	"site.audit": "moderator"
};

export interface SitePolicy
{
	openEditing: boolean;
	openRegistration: boolean;
}

export const CLOSED_POLICY: SitePolicy = {
	openEditing: false,
	openRegistration: false
};

export type Protection = "owner_only" | "open";

export interface SessionUser
{
	id: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
	role: Role;
	suspended: boolean;
	createdAt: string;
}

export interface DeviceSession
{
	id: string;
	current: boolean;
	userAgent: string;
	ip: string;
	createdAt: string;
	lastSeenAt: string;
}

export interface AccessContext
{
	user: SessionUser | null;
	role: Role | null;
	policy: SitePolicy;
	can(capability: Capability): boolean;
}

export function isRole(value: unknown): value is Role
{
	return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function rankOf(role: Role | null): number
{
	return role === null ? -1 : RANK[role];
}

export function atLeast(role: Role | null, minimum: Role): boolean
{
	return rankOf(role) >= RANK[minimum];
}

export function requiredRole(capability: Capability, policy: SitePolicy): Role
{
	if (capability === "entry.propose" && policy.openEditing)
	{
		return "contributor";
	}
	return MINIMUM_ROLE[capability];
}

export function can(role: Role | null, capability: Capability, policy: SitePolicy = CLOSED_POLICY): boolean
{
	if (capability === "entry.read")
	{
		return true;
	}
	if (role === null)
	{
		return false;
	}
	if (capability === "entry.propose" && policy.openEditing && atLeast(role, "contributor"))
	{
		return true;
	}
	return atLeast(role, MINIMUM_ROLE[capability]);
}

export function buildAccess(user: SessionUser | null, policy: SitePolicy): AccessContext
{
	const role = user && !user.suspended ? user.role : null;
	return {
		user,
		role,
		policy,
		can: (capability) => can(role, capability, policy)
	};
}

export function canProposeEntry(role: Role | null, policy: SitePolicy, protection: Protection): boolean
{
	if (atLeast(role, "moderator"))
	{
		return true;
	}
	if (role === null)
	{
		return false;
	}
	if (protection === "owner_only")
	{
		return false;
	}
	return policy.openEditing && atLeast(role, "contributor");
}

export function proposeBlockReason(role: Role | null, policy: SitePolicy, protection: Protection): string
{
	if (role === null)
	{
		return "尚未登录。";
	}
	if (atLeast(role, "moderator"))
	{
		return "";
	}
	if (protection === "owner_only")
	{
		return "该条目当前标记为「仅站长可改」，站长尚未把它开放给贡献者。";
	}
	if (!policy.openEditing)
	{
		return "站点当前未开放公开编辑，条目修改暂由站长处理。";
	}
	return "当前角色不具备提交修订的权限。";
}
