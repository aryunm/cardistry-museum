export type Category = {
	key: string;
	name: string;
	nameEn: string;
	blurb: string;
};

export const categories: Category[] = [
	{
		key: "one-handed-cuts",
		name: "单手切",
		nameEn: "One-Handed Cuts",
		blurb: "只用一只手完成的分牌与切牌，是花切最早成型的形态，也是手感的起点。"
	},
	{
		key: "two-handed-cuts",
		name: "双手切",
		nameEn: "Two-Handed Cuts & Packets",
		blurb: "把牌分成多个包，在两手之间重新排列。当代花切的主战场。"
	},
	{
		key: "aerials",
		name: "空中动作",
		nameEn: "Aerials",
		blurb: "让牌或整包牌离手、飞行、再落回手中。观赏性最强，失误率也最高。"
	},
	{
		key: "fans-spreads",
		name: "展扇",
		nameEn: "Fans & Spreads",
		blurb: "把牌摊成均匀的扇形或长条。看似简单，均匀度是唯一标准。"
	},
	{
		key: "dribbles-springs",
		name: "落牌与弹牌",
		nameEn: "Dribbles, Springs & Cascades",
		blurb: "让牌以连续、可控的方式从一只手流向另一只手。是节奏感的基础。"
	},
	{
		key: "isolations-spins",
		name: "隔离与旋转",
		nameEn: "Isolations & Spins",
		blurb: "让牌在视觉上停住或匀速旋转，制造反重力的错觉。"
	},
	{
		key: "displays-freezes",
		name: "展示与定格",
		nameEn: "Displays & Freezes",
		blurb: "不为切牌，只为把一个结构摆出来给人看。花切的「雕塑」部分。"
	},
	{
		key: "combos",
		name: "连招",
		nameEn: "Combos & Sequences",
		blurb: "把若干动作串成一段完整表演。评判标准从手法变成编排。"
	}
];

export const categoriesByKey = new Map(categories.map((c) => [c.key, c]));

export function categoryName(key: string): string
{
	return categoriesByKey.get(key)?.name ?? key;
}
