export type GlossaryEntry = {
	term: string;
	zh: string;
	desc: string;
};

export const glossary: GlossaryEntry[] = [
	{
		term: "Cardistry",
		zh: "花切",
		desc: "以花式切牌与展牌为核心、以观赏为目的的独立表演门类。区别于魔术：不隐藏手法，反而把手法放大给人看。"
	},
	{
		term: "Flourish",
		zh: "花式",
		desc: "上位词。广义指一切以视觉表演为目的的牌技，cardistry 是其当代的主要子集。"
	},
	{
		term: "Packet",
		zh: "包",
		desc: "切牌过程中被分离出来的一叠牌。多数双手切动作的本质就是包的重排。"
	},
	{
		term: "Cut",
		zh: "切",
		desc: "把牌分成若干包再重新组合的动作族，是花切的基础语法。"
	},
	{
		term: "Display",
		zh: "展示",
		desc: "不做切牌、只把结构摆出来给人看的动作。花切里最接近静态雕塑的一类。"
	},
	{
		term: "Isolation",
		zh: "隔离",
		desc: "通过反向运动抵消下落或旋转，让牌在视觉上停住或匀速旋转，制造反重力错觉。"
	},
	{
		term: "Aerial",
		zh: "空中动作",
		desc: "牌或整包牌脱离手掌在空中飞行后落回的动作。失误率最高，观赏性也最强。"
	},
	{
		term: "Dribble",
		zh: "落牌",
		desc: "用拇指边缘控制，让牌一张张成串落下。匀速是唯一的技术指标。"
	},
	{
		term: "Spring",
		zh: "弹牌",
		desc: "把整叠牌压弯后释放，使牌形成一条弧线弹向另一只手。"
	},
	{
		term: "Fan",
		zh: "展扇",
		desc: "把牌摊成以拇指为轴的扇形。均匀度决定成败，稍有偏差一眼就看得出来。"
	},
	{
		term: "Grip",
		zh: "握法",
		desc: "持牌的方式。握法往往决定了哪些同类动作在同一手势下可以接续。"
	},
	{
		term: "Prerequisite",
		zh: "前置动作",
		desc: "学习某动作之前建议先掌握的动作。本站用它生成参观动线，而不是按难度硬排。"
	},
	{
		term: "Derived from",
		zh: "谱系来源",
		desc: "该动作由哪个动作演化而来。只记录有来源可查的演化关系，不做主观推测。"
	},
	{
		term: "考据状态",
		zh: "Verified / Disputed / Stub",
		desc: "已核实：有可靠来源支撑。存疑：来源之间存在冲突。待考据：目前只能描述做法，来源尚未找到，收在馆藏室。"
	}
];
