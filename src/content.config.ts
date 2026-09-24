import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const CATEGORIES = [
	"one-handed-cuts",
	"two-handed-cuts",
	"aerials",
	"fans-spreads",
	"dribbles-springs",
	"isolations-spins",
	"displays-freezes",
	"combos"
];

const sourceSchema = z.object({
	type: z.enum(["book", "video", "forum", "wiki", "interview", "article"]),
	title: z.string(),
	author: z.string().optional(),
	year: z.string().optional(),
	url: z.string().optional()
});

const mediaSchema = z.object({
	kind: z.enum(["video", "image", "gif"]),
	provider: z.enum(["youtube", "bilibili", "self"]).optional(),
	url: z.string().optional(),
	poster: z.string().optional(),
	angle: z.string().optional(),
	credit: z.string(),
	license: z.string(),
	sourceUrl: z.string().optional()
});

const moves = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/moves" }),
	schema: z.object({
		title: z.string(),
		titleEn: z.string(),
		aliases: z.array(z.string()).default([]),
		category: z.enum(CATEGORIES),
		difficulty: z.number().min(1).max(5),
		firstPublicYear: z.number().int().nullable().default(null),
		creators: z.array(z.string()).default([]),
		prerequisites: z.array(z.string()).default([]),
		derivedFrom: z.array(z.string()).default([]),
		hands: z.enum(["one", "two", "either"]).default("two"),
		packets: z.number().int().optional(),
		tags: z.array(z.string()).default([]),
		status: z.enum(["verified", "disputed", "stub"]).default("stub"),
		summary: z.string(),
		curatorNote: z.string().optional(),
		sources: z.array(sourceSchema).default([]),
		media: z.array(mediaSchema).default([]),
		order: z.number().default(999)
	})
});

const artists = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/artists" }),
	schema: z.object({
		name: z.string(),
		nameEn: z.string(),
		aliases: z.array(z.string()).default([]),
		activeFrom: z.string().optional(),
		affiliations: z.array(z.string()).default([]),
		summary: z.string(),
		links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
		sources: z.array(sourceSchema).default([])
	})
});

const decks = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/decks" }),
	schema: z.object({
		name: z.string(),
		nameEn: z.string(),
		company: z.string(),
		year: z.string().optional(),
		designer: z.string().optional(),
		summary: z.string(),
		sources: z.array(sourceSchema).default([])
	})
});

export const collections = { moves, artists, decks };
