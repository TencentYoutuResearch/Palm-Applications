// ===== 掌纹算命 · 今日运势 - 主逻辑 =====

// ===== API配置 =====
function getApiBase() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000/api/v1';
  } else {
    // 子路径部署时，从 window.PALM_BASE_PATH 或当前页面路径推断
    var basePath = window.PALM_BASE_PATH || '';
    return basePath + '/api/v1';
  }
}

const API_BASE = getApiBase();

let currentMode = null;

// ===== 数据定义 =====
const ZODIACS = [
  { name: '鼠', emoji: '🐭' }, { name: '牛', emoji: '🐮' },
  { name: '虎', emoji: '🐯' }, { name: '兔', emoji: '🐰' },
  { name: '龙', emoji: '🐲' }, { name: '蛇', emoji: '🐍' },
  { name: '马', emoji: '🐴' }, { name: '羊', emoji: '🐑' },
  { name: '猴', emoji: '🐵' }, { name: '鸡', emoji: '🐔' },
  { name: '狗', emoji: '🐶' }, { name: '猪', emoji: '🐷' }
];

const CONSTELLATIONS = [
  { name: '白羊座', emoji: '♈', en: 'Aries' },
  { name: '金牛座', emoji: '♉', en: 'Taurus' },
  { name: '双子座', emoji: '♊', en: 'Gemini' },
  { name: '巨蟹座', emoji: '♋', en: 'Cancer' },
  { name: '狮子座', emoji: '♌', en: 'Leo' },
  { name: '处女座', emoji: '♍', en: 'Virgo' },
  { name: '天秤座', emoji: '♎', en: 'Libra' },
  { name: '天蝎座', emoji: '♏', en: 'Scorpio' },
  { name: '射手座', emoji: '♐', en: 'Sagittarius' },
  { name: '摩羯座', emoji: '♑', en: 'Capricorn' },
  { name: '水瓶座', emoji: '♒', en: 'Aquarius' },
  { name: '双鱼座', emoji: '♓', en: 'Pisces' }
];

const LUCKY_COLORS = [
  { name: '紫罗兰', color: '#8A2BE2' }, { name: '玫瑰红', color: '#FF4081' },
  { name: '翡翠绿', color: '#2ECC71' }, { name: '琥珀金', color: '#FFD700' },
  { name: '天青蓝', color: '#4FC3F7' }, { name: '珊瑚橙', color: '#FF7043' },
  { name: '薰衣紫', color: '#CE93D8' }, { name: '蜜桃粉', color: '#F48FB1' },
  { name: '松石绿', color: '#26A69A' }, { name: '宝石蓝', color: '#42A5F5' }
];

// 颜色名称到实际颜色值的映射表（覆盖前后端所有可能的颜色名称）
const COLOR_NAME_MAP = {
  // 前端 LUCKY_COLORS 中的颜色
  '紫罗兰': '#8A2BE2', '玫瑰红': '#FF4081', '翡翠绿': '#2ECC71',
  '琥珀金': '#FFD700', '天青蓝': '#4FC3F7', '珊瑚橙': '#FF7043',
  '薰衣紫': '#CE93D8', '蜜桃粉': '#F48FB1', '松石绿': '#26A69A',
  '宝石蓝': '#42A5F5',
  // 后端 lucky_colors 中的颜色
  '正红色': '#E53935', '柠檬黄': '#FDD835', '月光银': '#C0C0C0',
  '金色': '#FFD700', '薄荷绿': '#69F0AE', '粉红色': '#F48FB1',
  '深紫色': '#7B1FA2', '橙色': '#FF9800', '深蓝色': '#1565C0',
  '天蓝色': '#42A5F5', '薰衣草紫': '#B39DDB',
  // 常见颜色名称补充
  '珍珠白': '#F5F5F5', '象牙白': '#FFFFF0', '乳白色': '#FFFAF0',
  '雪白': '#FFFAFA', '米白': '#FAF0E6', '纯白': '#FFFFFF',
  '黑色': '#212121', '灰色': '#9E9E9E', '银色': '#C0C0C0',
  '红色': '#F44336', '粉色': '#E91E63', '桃红': '#FF80AB',
  '绿色': '#4CAF50', '青色': '#00BCD4', '蓝色': '#2196F3',
  '紫色': '#9C27B0', '黄色': '#FFEB3B', '棕色': '#795548',
  '咖啡色': '#6D4C41', '酒红色': '#880E4F', '墨绿色': '#1B5E20',
  '藏青色': '#0D47A1', '靛蓝': '#3F51B5', '珊瑚色': '#FF7043',
  '鹅黄': '#FFF9C4', '杏色': '#FFAB91', '驼色': '#D7CCC8',
  '卡其色': '#C8B560', '橄榄绿': '#689F38', '湖蓝': '#0097A7',
  '宝蓝': '#1976D2', '玫红': '#C2185B', '桔红': '#FF5722',
};

// 根据颜色名称获取对应的颜色值
function getColorHex(colorName) {
  if (!colorName) return '#FFD700';
  // 精确匹配
  if (COLOR_NAME_MAP[colorName]) return COLOR_NAME_MAP[colorName];
  // 模糊匹配：遍历映射表，看颜色名称是否包含某个关键词
  for (const [name, hex] of Object.entries(COLOR_NAME_MAP)) {
    if (colorName.includes(name) || name.includes(colorName)) return hex;
  }
  // 兜底：根据常见关键字推断
  if (colorName.includes('白')) return '#F5F5F5';
  if (colorName.includes('红')) return '#F44336';
  if (colorName.includes('蓝')) return '#2196F3';
  if (colorName.includes('绿')) return '#4CAF50';
  if (colorName.includes('紫')) return '#9C27B0';
  if (colorName.includes('黄')) return '#FFEB3B';
  if (colorName.includes('粉')) return '#E91E63';
  if (colorName.includes('金')) return '#FFD700';
  if (colorName.includes('银')) return '#C0C0C0';
  if (colorName.includes('黑')) return '#212121';
  if (colorName.includes('橙')) return '#FF9800';
  if (colorName.includes('棕') || colorName.includes('褐')) return '#795548';
  if (colorName.includes('灰')) return '#9E9E9E';
  if (colorName.includes('青')) return '#00BCD4';
  return '#FFD700'; // 默认金色
}

const DIRECTIONS = ['正东', '东南', '正南', '西南', '正西', '西北', '正北', '东北'];
const LUCKY_TIMES = ['子时(23-1点)', '丑时(1-3点)', '寅时(3-5点)', '卯时(5-7点)', '辰时(7-9点)', '巳时(9-11点)', '午时(11-13点)', '未时(13-15点)', '申时(15-17点)', '酉时(17-19点)', '戌时(19-21点)', '亥时(21-23点)'];

const TRAD_PALM_SECTIONS = [
  { id: 'palm-type', title: '一、掌型总论', subtitle: '金木水火土五行掌 + 掌色气血分析', icon: '🖐️',
    readings: { high: [{ type: '金形掌', desc: '掌形方正，指节分明，骨骼坚实。金形掌主人性格刚毅果断，做事有条理，适合从事管理、法律等需要严谨思维的行业。掌色红润有光泽，气血充盈，精力旺盛。' }, { type: '木形掌', desc: '掌形修长，手指纤细，关节突出。木形掌主人聪慧好学，富有创造力和艺术天赋，适合文学、艺术、教育等领域。掌色白皙透粉，气血调和，思维敏捷。' }], mid: [{ type: '水形掌', desc: '掌形圆润柔软，手指短而丰满。水形掌主人性格温和圆融，善于交际，适应力强，适合商业、外交等需要人际沟通的工作。掌色偏白，气血平稳。' }, { type: '火形掌', desc: '掌形上宽下窄，指尖略尖。火形掌主人热情奔放，行动力强，富有冒险精神，适合创业、销售等充满挑战的领域。掌色偏红，气血旺盛。' }], low: [{ type: '土形掌', desc: '掌形厚实宽大，手指粗短有力。土形掌主人踏实稳重，耐力持久，适合农业、建筑、制造等需要耐心和毅力的行业。掌色偏黄，气血沉稳，需注意脾胃调养。' }] } },
  { id: 'life-line', title: '二、生命线详解', subtitle: '健康体质 + 生命阶段运势 + 特殊标记', icon: '💚', readings: { high: ['生命线深长且清晰，弧度优美，从食指与拇指之间起始，环绕金星丘延伸至手腕。此线象征体魄强健、精力充沛，一生少有大病大灾。', '生命线宽阔有力，色泽红润，显示出极强的生命能量。起始处与智慧线分开，说明性格独立果敢。'], mid: ['生命线长度适中，走势平稳，显示健康状况总体良好。线条中段略有细纹交叉，提示中年期需注意劳逸结合。', '生命线清晰但弧度较小，紧贴拇指根部。此相显示生活圈子相对稳定，不喜大起大落。'], low: ['生命线较短或有链状纹，提示体质偏弱，需格外注意健康管理。建议加强锻炼，注意饮食调理。'] } },
  { id: 'wisdom-line', title: '三、智慧线详解', subtitle: '思维才智 + 事业适配 + 学业决策力', icon: '💜', readings: { high: ['智慧线深长有力，横贯掌心，末端微微上扬。此线主人思维敏捷、逻辑清晰，具有出色的分析能力和决策力。', '智慧线笔直延伸至掌缘，且与生命线起始处分开。此相显示思维独立、判断力强。'], mid: ['智慧线长度适中，走势平稳，末端略向下弯。此线主人兼具理性与感性，思维灵活但不失稳重。', '智慧线清晰但有分叉，显示兴趣广泛，多才多艺。'], low: ['智慧线较短或有断续，提示思维容易分散，做决策时可能犹豫不决。建议培养专注力。'] } },
  { id: 'emotion-line', title: '四、感情线详解', subtitle: '情感模式 + 婚恋运势 + 人际关系', icon: '❤️', readings: { high: ['感情线深长饱满，从小指下方延伸至食指或中指之间。此线主人感情丰富、重情重义，婚恋运势极佳。', '感情线清晰且呈优美弧线，色泽红润。此相显示情感表达能力强，善于经营感情关系。'], mid: ['感情线长度适中，走势平稳。此线主人感情内敛含蓄，不善于直接表达情感，但内心深处情感丰富。', '感情线有细小分支，显示感情经历较为丰富。每段经历都是成长的养分。'], low: ['感情线较短或有链状纹，提示感情方面可能经历波折。建议学会表达自己的情感需求。'] } },
  { id: 'fate-line', title: '五、命运线与事业运', subtitle: '发展轨迹 + 事业转折', icon: '⭐', readings: { high: ['命运线从掌底直达中指根部，深长有力，一气呵成。此线主人事业心极强，目标明确，执行力出众。', '命运线清晰笔直，无明显中断。此相显示事业道路顺畅，少有大的波折。'], mid: ['命运线中段出现分支或转折，预示事业发展中会有方向调整。35岁前后可能经历一次重要的职业转型。', '命运线从掌心中部开始，显示事业起步较晚但后劲十足。大器晚成型。'], low: ['命运线较浅或不太明显，提示事业发展需要更多的主动规划和努力。命运掌握在自己手中。'] } },
  { id: 'auxiliary-lines', title: '六、辅助线与特殊纹路', subtitle: '婚姻线 + 吉凶纹路', icon: '✨', readings: { high: ['婚姻线清晰且只有一条主线，深长有力，预示婚姻美满、感情专一。太阳线明显，暗示在艺术、创作或公众领域有出色表现。'], mid: ['婚姻线有两到三条，其中一条较为突出。此相显示感情经历较为丰富，但最终会有一段稳定的婚姻。'], low: ['婚姻线较为模糊或有多条细线，提示婚恋方面需要更多的耐心和智慧。'] } },
  { id: 'eight-mounds', title: '七、八丘论断', subtitle: '木星/土星/太阳/水星/金星/月丘', icon: '🌍', readings: { high: ['木星丘饱满隆起，显示领导力强。太阳丘丰隆有光泽，预示艺术天赋出众。', '水星丘丰满，显示口才出众、商业头脑敏锐。金星丘饱满红润，代表精力充沛。'], mid: ['各丘位发育均衡，无明显凹陷或过度隆起。此相显示性格平衡，各方面能力均衡发展。'], low: ['部分丘位较为平坦，提示对应方面的能量需要加强。可以通过后天的学习和锻炼来弥补。'] } },
  { id: 'five-elements', title: '八、五行综合论断', subtitle: '金木水火土综合分析', icon: '☯️', readings: { high: ['综合掌型、掌色、纹路走势分析，你的五行属性以木火为主，辅以金气。木主仁，火主礼，金主义。五行相生相克之中，木生火旺，事业运和人际运极佳。'], mid: ['五行分布较为均衡，略偏土金。土主信，金主义，为人诚实守信、重承诺。'], low: ['五行中某一属性偏弱，整体能量流通不够顺畅。建议通过调整生活习惯和环境来平衡五行。'] } },
  { id: 'yearly-fortune', title: '九、流年运势概览', subtitle: '青年/壮年/中年/晚年四阶段', icon: '📅', readings: { high: ['【青年期】学业顺遂，事业起步顺利。\n【壮年期】事业进入快速上升期，财运亨通。\n【中年期】事业稳定，收获丰厚。\n【晚年期】福寿双全，晚年安逸。'], mid: ['【青年期】学业中等偏上，需要付出更多努力。\n【壮年期】事业稳步发展，38岁前后有重要机会。\n【中年期】生活趋于稳定。\n【晚年期】生活安定。'], low: ['【青年期】起步较慢，但这是积累经验的重要阶段。\n【壮年期】35岁前后迎来转机。\n【中年期】大器晚成。\n【晚年期】苦尽甘来。'] } },
  { id: 'summary', title: '十、综合评语与建议', subtitle: '全面总结与人生指引', icon: '📜', readings: { high: ['综合你的掌纹特征分析，你是一个天赋出众、运势极佳的人。\n\n建议：珍惜自身的天赋和好运，保持谦逊和感恩的心态。'], mid: ['综合掌纹分析，你的各项指标均衡发展，属于稳健型。\n\n建议：找到自己最擅长的领域，集中精力深耕。'], low: ['掌纹分析显示你目前正处于蓄力阶段。\n\n建议：不要被暂时的困难所困扰，命运始终掌握在自己手中。'] } }
];

const PALM_LINES_DATA = [
  { name: '生命线', icon: '💚', descriptions: ['生命线深长且清晰，弧度优美环绕金星丘，显示体魄强健、精力充沛。', '生命线平稳延伸至手腕，纹路均匀无断裂，预示稳定的健康状态。', '生命线呈现优美的半圆弧度，金星丘饱满丰隆。', '生命线末端分叉延伸，主线深长有力。', '生命线起始处与智慧线分开，显示性格独立果敢。', '生命线中段出现上升支线，预示重大突破。', '生命线色泽红润有光泽，气血充盈之相。', '生命线宽阔有力，纹理清晰可辨。'] },
  { name: '智慧线', icon: '💜', descriptions: ['智慧线笔直有力横贯掌心，末端微微上扬，主思维敏捷、逻辑清晰。', '智慧线微微下弯至月丘方向，创造力与想象力旺盛。', '智慧线深且长，延伸至掌缘，显示出出众的分析能力。', '智慧线呈现双分支，主线代表理性思维，支线代表感性直觉。', '智慧线起始处与生命线分开，显示思维独立。', '智慧线纹路清晰且无岛纹干扰，记忆力与专注力处于高峰。', '智慧线末端出现星纹，预示在智力领域将有突出表现。', '智慧线与感情线之间间距适中，显示理性与感性平衡。'] },
  { name: '感情线', icon: '❤️', descriptions: ['感情线温润饱满，从小指下方延伸至食指根部，情感丰富细腻。', '感情线延伸至食指与中指之间，对爱情充满理想主义。', '感情线平直延伸，纹路清晰有力，处事理性冷静。', '感情线呈现优美弧线上扬，显示对感情积极主动。', '感情线末端分叉，主线与支线均清晰。', '感情线深长且色泽红润，情感表达能力强。', '感情线起始处有细小上升支线，预示近期感情方面将有喜事。', '感情线与智慧线平行延伸，显示情感与理智并重。'] },
  { name: '事业线', icon: '⭐', descriptions: ['事业线从掌底直达中指根部，深长有力一气呵成。', '事业线清晰可见，走势平稳上升，职业发展稳步向好。', '事业线中段出现上升分支，预示着新的发展机遇。', '事业线起始于月丘，善于借助他人力量成就事业。', '事业线起始于生命线，显示事业成功源于个人不懈努力。', '事业线笔直无中断，预示职业道路顺畅。', '事业线末端出现星纹或三角纹，为事业大成之相。', '事业线与太阳线并行，显示事业发展伴随名望提升。'] },
  { name: '太阳线', icon: '🌟', descriptions: ['太阳线清晰可见，从无名指根部向下延伸。此线主才华与名望。', '太阳线深长有力，预示在艺术、创作或公众领域有出色表现。', '太阳线起始于智慧线，显示凭借智慧和才学获得成功。', '太阳线末端出现星纹，为大吉之相。', '太阳线虽短但清晰，显示在特定领域有独特天赋。', '太阳线与事业线并行延伸，事业发展伴随声望提升。'] },
  { name: '婚姻线', icon: '💍', descriptions: ['婚姻线清晰且只有一条主线，深长有力，预示婚姻美满。', '婚姻线位置适中，长度恰好，显示婚姻时机把握得当。', '婚姻线末端微微上扬，显示对婚姻充满积极期待。', '婚姻线平直延伸，纹路清晰，预示感情关系稳定和谐。', '婚姻线起始处有细小支线上升，预示近期感情方面将有好消息。', '婚姻线深刻有力，显示对感情认真负责。'] }
];

const FORTUNE_TEXTS = { love: { high: ['今日桃花运极佳，单身者有望遇到心仪对象，已有伴侣者感情急剧升温。', '浪漫的金星能量笼罩着你，无论是表白还是约会，今天都是绝佳时机。', '感情方面春风得意，你的魅力指数飙升，异性缘特别好。'], mid: ['感情运势平稳，适合与伴侣进行深入交流，增进彼此了解。', '今日适合回顾感情中的点点滴滴，感恩身边的温暖陪伴。', '爱情方面中规中矩，保持真诚和耐心，美好的缘分终将到来。'], low: ['今日感情方面需多一些包容和理解，避免因小事产生争执。', '感情运势略有波折，建议给彼此一些空间。', '桃花运暂时低迷，静下心来提升自己更重要。'] }, career: { high: ['事业运势大吉，你的才华将得到充分展现，有望获得上级赏识。', '工作中灵感不断，效率极高。适合推进重要项目。', '职场上贵人相助，困难迎刃而解。今天是大展宏图的好日子。'], mid: ['事业运势稳定，按部就班地完成工作任务，稳扎稳打最重要。', '工作中注意细节，避免因粗心导致失误。', '职场上保持低调，默默积累实力。'], low: ['今日工作中可能遇到一些挑战，保持冷静思考。', '事业方面暂时处于调整期，利用这段时间学习充电。', '职场上可能有些许不顺，换个角度思考问题。'] }, wealth: { high: ['财运亨通，今日适合进行投资理财。有意外收获的可能。', '金钱能量充沛，可能收到好消息或意外之财。', '偏财运旺盛，今天参与抽奖或投资可能有惊喜。'], mid: ['财运平稳，日常开支合理控制即可，不宜进行大额投资。', '正财运尚可，努力工作获得的收入是最踏实的财富。', '今日在金钱方面量入为出，理性消费才是王道。'], low: ['今日财运需谨慎，避免冲动消费或借贷。', '破财风险略高，不建议进行任何投资活动。', '财运暂时低迷，但这也是审视消费习惯的好时机。'] }, health: { high: ['身体状态极佳，精力旺盛。适合进行户外运动。', '健康运势上佳，免疫力处于高峰。', '身心状态俱佳，精神饱满、思维清晰。'], mid: ['健康状况总体良好，注意作息规律。', '身体无大碍，但需注意饮食均衡。', '健康运势中等，适度运动有助于保持良好状态。'], low: ['今日需特别注意身体健康，避免过度劳累。', '身体可能出现小不适，注意保暖和饮食卫生。', '健康方面需要关注，建议减少高强度活动。'] } };

const ENCOURAGEMENTS = {
  high: [
    '今日星光璀璨，宇宙能量与你同频共振！你的好运势不是偶然，而是实力与福报的体现。大胆追梦吧！🌟',
    '运势大吉！今天的你自带光芒，无论做什么都能事半功倍。把握机会，尽情绽放！✨',
    '恭喜！今日运势高涨，贵人相助、好事连连。趁着好运势，勇敢迈出那一步吧！🎉',
    '今天是你的幸运日！掌纹与星辰都在为你加持，所有的努力都将迎来丰厚回报！💫',
    '运势满满的一天！你的能量场强大而耀眼，好运会像磁铁一样被你吸引过来！🌈'
  ],
  mid: [
    '今日运势平稳向好，稳扎稳打就是最好的策略。保持节奏，好事自然水到渠成。🍀',
    '运势中等偏上，虽无大起大落，但暗藏小确幸。用心感受生活中的美好瞬间吧。☀️',
    '今天适合沉淀和积累，运势平稳中蕴含着转机。耐心等待，属于你的精彩即将到来。🌿',
    '运势稳中有升，脚踏实地的努力终将开花结果。相信过程，享受当下。💪',
    '平稳的运势是最好的修行时光，利用今天充实自己，为未来的高光时刻做好准备。📚'
  ],
  low: [
    '今日运势虽有波折，但请记住：低谷是为了蓄力起跳。暂时的不顺终将过去，明天会更好！💪',
    '运势暂时低迷不要紧，每一次挑战都是成长的契机。保持乐观，风雨过后必见彩虹。🌈',
    '今天可能会遇到一些小挫折，但你的内心比你想象的更强大。休息一下，调整状态再出发。☕',
    '运势起伏是自然规律，低潮期正是反思和充电的好时机。善待自己，好运很快就会回来。🌙',
    '虽然今日运势不算理想，但你依然是宇宙中独一无二的存在。保持微笑，好运自然来！😊'
  ]
};
const TRAD_ENCOURAGEMENTS = ['掌纹是天赋的密码，但人生的精彩由你亲手书写。愿你读懂自己，活出最好的模样！🖐️✨', '手相只是命运的参考，真正的力量来自你的内心。相信自己，一切皆有可能！💫', '每一条掌纹都记录着独特的故事，你的故事才刚刚开始，未来无限精彩！🌟', '古人云：相由心生，命由己造。保持善念，好运自然相随！☯️', '掌中乾坤大，心中日月长。愿你掌握命运，成就非凡人生！🏔️'];

const CONSTELLATION_GUARDIAN_DATA = [
  { guardian: '火星', element: '火象', quality: '开创', symbol: '♈', readings: { high: '火星守护的白羊座今日能量爆棚，行动力与决断力达到巅峰。', mid: '火星能量平稳输出，白羊座今日适合稳扎稳打。', low: '火星能量暂时受到压制，白羊座今日需要收敛锋芒。' } },
  { guardian: '金星', element: '土象', quality: '固定', symbol: '♉', readings: { high: '金星守护的金牛座今日魅力四射，审美品味和财运都处于高峰。', mid: '金星能量柔和流转，金牛座今日适合享受生活中的小确幸。', low: '金星能量受到冲克，金牛座今日在物质和感情方面可能遇到小波折。' } },
  { guardian: '水星', element: '风象', quality: '变动', symbol: '♊', readings: { high: '水星守护的双子座今日思维如电、口才如簧。', mid: '水星能量平稳，双子座今日适合整理思绪和信息。', low: '水星能量受到干扰，双子座今日沟通可能出现误解。' } },
  { guardian: '月亮', element: '水象', quality: '开创', symbol: '♋', readings: { high: '月亮守护的巨蟹座今日情感能量丰沛，直觉力达到巅峰。', mid: '月亮能量处于盈亏之间，巨蟹座今日情绪起伏较为平缓。', low: '月亮能量受到冲克，巨蟹座今日情绪可能较为敏感。' } },
  { guardian: '太阳', element: '火象', quality: '固定', symbol: '♌', readings: { high: '太阳守护的狮子座今日光芒万丈，领导力和创造力达到巅峰。', mid: '太阳能量稳定输出，狮子座今日适合在幕后默默耕耘。', low: '太阳能量暂时被云层遮蔽，狮子座今日可能感到自信心不足。' } },
  { guardian: '水星', element: '土象', quality: '变动', symbol: '♍', readings: { high: '水星守护的处女座今日分析能力和执行力达到巅峰。', mid: '水星能量平稳，处女座今日适合关注细节和品质。', low: '水星能量受到干扰，处女座今日可能过度焦虑。' } },
  { guardian: '金星', element: '风象', quality: '开创', symbol: '♎', readings: { high: '金星守护的天秤座今日社交魅力和审美品味达到巅峰。', mid: '金星能量柔和，天秤座今日适合在人际关系中寻找平衡。', low: '金星能量受到冲克，天秤座今日在选择方面可能犹豫不决。' } },
  { guardian: '冥王星', element: '水象', quality: '固定', symbol: '♏', readings: { high: '冥王星守护的天蝎座今日洞察力和变革力达到巅峰。', mid: '冥王星能量平稳，天蝎座今日适合进行内心的自我探索。', low: '冥王星能量受到干扰，天蝎座今日可能过于执着。' } },
  { guardian: '木星', element: '火象', quality: '变动', symbol: '♐', readings: { high: '木星守护的射手座今日好运连连，乐观精神和冒险欲望达到巅峰。', mid: '木星能量稳定，射手座今日适合在已有的基础上深耕。', low: '木星能量暂时受到压制，射手座今日可能感到束缚。' } },
  { guardian: '土星', element: '土象', quality: '开创', symbol: '♑', readings: { high: '土星守护的摩羯座今日执行力和责任感达到巅峰。', mid: '土星能量平稳输出，摩羯座今日适合按部就班地推进工作。', low: '土星能量过于沉重，摩羯座今日可能感到压力山大。' } },
  { guardian: '天王星', element: '风象', quality: '固定', symbol: '♒', readings: { high: '天王星守护的水瓶座今日创新力和独立精神达到巅峰。', mid: '天王星能量平稳，水瓶座今日适合在常规中寻找突破口。', low: '天王星能量受到干扰，水瓶座今日可能感到与周围格格不入。' } },
  { guardian: '海王星', element: '水象', quality: '变动', symbol: '♓', readings: { high: '海王星守护的双鱼座今日灵感和直觉力达到巅峰。', mid: '海王星能量柔和流转，双鱼座今日适合沉浸在精神世界中。', low: '海王星能量受到干扰，双鱼座今日可能过于感性。' } }
];

const ZODIAC_FORTUNE_DATA = [
  { name: '鼠', element: '水', ally: '牛、龙、猴', liuhe: '牛', conflict: '马、羊、兔', fortune: '属鼠之人今日水元素活跃，智慧与机敏并存。贵人方位在正北。' },
  { name: '牛', element: '土', ally: '鼠、蛇、鸡', liuhe: '鼠', conflict: '马、羊、狗', fortune: '属牛之人今日土元素稳固，踏实与坚韧是你的力量源泉。' },
  { name: '虎', element: '木', ally: '马、狗、猪', liuhe: '猪', conflict: '猴、蛇', fortune: '属虎之人今日木元素生发，勇气与魄力俱佳。' },
  { name: '兔', element: '木', ally: '羊、狗、猪', liuhe: '狗', conflict: '鸡、龙、鼠', fortune: '属兔之人今日木元素柔和，温雅与智慧并重。' },
  { name: '龙', element: '土', ally: '鼠、猴、鸡', liuhe: '鸡', conflict: '狗、兔、龙', fortune: '属龙之人今日土元素厚重，气势与格局非凡。' },
  { name: '蛇', element: '火', ally: '牛、鸡', liuhe: '猴', conflict: '猪、虎', fortune: '属蛇之人今日火元素灵动，洞察力与直觉力极强。' },
  { name: '马', element: '火', ally: '虎、羊、狗', liuhe: '羊', conflict: '鼠、牛', fortune: '属马之人今日火元素旺盛，热情与活力四射。' },
  { name: '羊', element: '土', ally: '兔、马、猪', liuhe: '马', conflict: '牛、鼠、狗', fortune: '属羊之人今日土元素温润，善良与包容是你的魅力。' },
  { name: '猴', element: '金', ally: '鼠、龙', liuhe: '蛇', conflict: '虎、猪', fortune: '属猴之人今日金元素锐利，聪明与变通能力出众。' },
  { name: '鸡', element: '金', ally: '牛、龙、蛇', liuhe: '龙', conflict: '兔、狗', fortune: '属鸡之人今日金元素明亮，勤勉与精准是你的优势。' },
  { name: '狗', element: '土', ally: '虎、兔、马', liuhe: '兔', conflict: '龙、牛、羊', fortune: '属狗之人今日土元素忠厚，忠诚与正义感强烈。' },
  { name: '猪', element: '水', ally: '虎、兔、羊', liuhe: '虎', conflict: '蛇、猴', fortune: '属猪之人今日水元素丰沛，福气与好运相伴。' }
];

const FIVE_ELEMENTS_DATA = { metal: { name: '金', color: '#FFD700', icon: '🪙', trait: '义', desc: '金元素代表收敛、坚毅与果断。金旺之人性格刚正不阿，做事有原则有底线。' }, wood: { name: '木', color: '#2ECC71', icon: '🌿', trait: '仁', desc: '木元素代表生长、仁慈与创造。木旺之人性格温和善良，富有创造力和同理心。' }, water: { name: '水', color: '#4FC3F7', icon: '💧', trait: '智', desc: '水元素代表智慧、灵活与深邃。水旺之人思维敏捷、洞察力强。' }, fire: { name: '火', color: '#FF4081', icon: '🔥', trait: '礼', desc: '火元素代表热情、光明与行动。火旺之人性格热情奔放，行动力强。' }, earth: { name: '土', color: '#8B4513', icon: '🏔️', trait: '信', desc: '土元素代表稳重、诚信与包容。土旺之人性格踏实可靠，重承诺守信用。' } };

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const TIANGAN_ELEMENTS = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const DIZHI_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const GANZHI_READINGS = ['天干地支相生相合，今日气场和谐顺畅。万事宜进不宜退。', '今日干支五行流通，阴阳调和。适合处理重要事务。', '天干主外、地支主内，今日内外兼修为上策。', '今日干支能量偏向阳刚，适合果断决策、开拓进取。', '今日干支能量偏向阴柔，适合以柔克刚、以退为进。', '干支相冲之日，变化与机遇并存。保持灵活应变的心态。', '今日天干透出财星，财运方面有利好消息。', '今日地支暗藏贵人，人际关系中可能出现重要的帮助者。'];

const LUCKY_ITEMS = [{ name: '紫水晶', icon: '💎', desc: '增强直觉力与灵性' }, { name: '红绳手链', icon: '🧶', desc: '辟邪转运、招桃花' }, { name: '翡翠挂件', icon: '🟢', desc: '养身护体、招财进宝' }, { name: '檀木手串', icon: '📿', desc: '静心安神、驱邪避灾' }, { name: '金色钢笔', icon: '🖊️', desc: '提升事业运与文昌运' }, { name: '银质饰品', icon: '💫', desc: '净化能量场、增强气场' }, { name: '琥珀吊坠', icon: '🟡', desc: '安神定志、招财纳福' }, { name: '黑曜石', icon: '⚫', desc: '强力辟邪、吸收负能量' }];
const LUCKY_FLOWERS = [{ name: '薰衣草', icon: '💜', desc: '安神静心' }, { name: '向日葵', icon: '🌻', desc: '积极向上' }, { name: '百合花', icon: '🌸', desc: '百年好合' }, { name: '桃花', icon: '🌺', desc: '招桃花运' }, { name: '兰花', icon: '🌿', desc: '高雅脱俗' }, { name: '牡丹', icon: '🌹', desc: '富贵吉祥' }, { name: '莲花', icon: '🪷', desc: '清净自在' }, { name: '梅花', icon: '🌼', desc: '坚韧不拔' }];

const ADVICES = { morning: [{ icon: 'fa-sun', text: '清晨是最佳的冥想时间，花5分钟静心呼吸，为一天注入正能量。' }, { icon: 'fa-mug-hot', text: '来一杯温热的饮品，让身体慢慢苏醒。晨起一杯温水，唤醒脾胃。' }, { icon: 'fa-spa', text: '晨起面向东方深呼吸三次，吸纳朝阳之气，有助于提升精气神。' }, { icon: 'fa-leaf', text: '早餐宜温热、易消化，养好脾胃是健康长寿的基础。' }], afternoon: [{ icon: 'fa-walking', text: '午后适合短暂散步，让大脑得到休息，有助于恢复精力。' }, { icon: 'fa-apple-whole', text: '补充一些水果和坚果，为身体提供持续的能量。' }, { icon: 'fa-wind', text: '午后阳气渐收，适合处理需要细心和耐心的工作。' }], evening: [{ icon: 'fa-book', text: '晚间适合阅读和反思，记录今天的收获与感悟。' }, { icon: 'fa-moon', text: '尽量在11点前入睡，充足的睡眠是最好的美容养生方式。' }, { icon: 'fa-hot-tub-person', text: '睡前用温水泡脚15分钟，可以促进血液循环、安神助眠。' }], general: [{ icon: 'fa-heart', text: '今天试着对一个陌生人微笑，善意会带来意想不到的回报。' }, { icon: 'fa-hands-holding-heart', text: '感恩是最高频的能量振动，列出三件值得感恩的事情。' }, { icon: 'fa-palette', text: '生活需要仪式感，为自己准备一顿精致的餐食。' }, { icon: 'fa-music', text: '听一首喜欢的音乐，让旋律带走烦恼。' }, { icon: 'fa-om', text: '找一个安静的角落，闭目冥想5分钟，净化负面能量。' }, { icon: 'fa-hand-holding-droplet', text: '今日宜多饮水，水为生命之源。' }, { icon: 'fa-seedling', text: '接触大自然是最好的能量补充方式。' }] };

const YI_DATA = ['出行', '约会', '签约', '投资', '学习', '运动', '聚会', '购物', '表白', '面试', '旅行', '创作', '社交', '读书', '冥想'];
const JI_DATA = ['争吵', '熬夜', '赌博', '冒险', '借贷', '暴饮暴食', '冲动消费', '过度劳累', '与人争执', '做重大决定', '独处太久', '忽视健康'];
const KEYWORDS_POSITIVE = ['贵人相助', '心想事成', '好运连连', '步步高升', '财源广进', '桃花朵朵', '灵感涌现', '否极泰来', '一帆风顺', '万事如意'];
const KEYWORDS_NEUTRAL = ['稳中求进', '厚积薄发', '沉淀自我', '养精蓄锐', '韬光养晦', '以退为进', '静待花开', '随遇而安', '顺其自然', '蓄势待发'];
const KEYWORDS_CAUTION = ['谨慎行事', '量力而行', '三思后行', '避免冲动', '注意休息', '低调行事', '守正待时', '以静制动', '防微杜渐'];

let selectedGender = null; // 'male' or 'female'
let selectedZodiac = null;
let selectedConstellation = null;
// 标记：用户是否手动点击过生肖/星座（用于判断日期变化时是否自动更新）
let userManuallySetZodiac = false;
let userManuallySetConstellation = false;
let cameraStream = null;
let capturedImageBlob = null;
let palmAnalysisResult = null;
let identifyResult = null;

function seedRandom(seed) { let s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function getTodaySeed() { const now = new Date(); return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate(); }
function getFortuneLevel(score) { if (score >= 90) return { text: '大吉大利', color: '#FFD700', emoji: '🎊' }; if (score >= 80) return { text: '吉星高照', color: '#FF9800', emoji: '✨' }; if (score >= 70) return { text: '诸事顺遂', color: '#8BC34A', emoji: '🍀' }; if (score >= 60) return { text: '平稳安顺', color: '#4FC3F7', emoji: '☘️' }; if (score >= 50) return { text: '小有波折', color: '#CE93D8', emoji: '🌤️' }; return { text: '韬光养晦', color: '#90A4AE', emoji: '🌙' }; }
function getScoreCategory(score) { if (score >= 70) return 'high'; if (score >= 40) return 'mid'; return 'low'; }
function formatDate() { const now = new Date(); const w = ['日', '一', '二', '三', '四', '五', '六']; return `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 星期${w[now.getDay()]}`; }
function getTimeOfDay() { const h = new Date().getHours(); if (h < 12) return 'morning'; if (h < 18) return 'afternoon'; return 'evening'; }
function pickRandom(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function pickMultipleRandom(arr, count, rng) { return [...arr].sort(() => rng() - 0.5).slice(0, count); }

function initParticles() { const canvas = document.getElementById('particles-canvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); let particles = []; function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } function createParticles() { particles = []; const count = Math.floor((canvas.width * canvas.height) / 12000); for (let i = 0; i < count; i++) { particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.8 + 0.3, speedX: (Math.random() - 0.5) * 0.3, speedY: (Math.random() - 0.5) * 0.3, alpha: Math.random() * 0.6 + 0.2, pulse: Math.random() * Math.PI * 2 }); } } function draw() { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.x += p.speedX; p.y += p.speedY; p.pulse += 0.02; if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0; const alpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse)); ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(168, 132, 255, ${alpha})`; ctx.fill(); }); requestAnimationFrame(draw); } resize(); createParticles(); draw(); window.addEventListener('resize', () => { resize(); createParticles(); }); }

function animateCountUp() { document.querySelectorAll('.trust-num').forEach(el => { const target = parseInt(el.dataset.target); const start = Date.now(); const step = () => { const progress = Math.min((Date.now() - start) / 2000, 1); el.textContent = Math.floor((1 - Math.pow(1 - progress, 3)) * target).toLocaleString(); if (progress < 1) requestAnimationFrame(step); }; setTimeout(step, 300); }); }

function navigateTo(targetId, direction = 'forward') { const currentScreen = document.querySelector('.screen.active'); const targetScreen = document.getElementById(targetId); if (!currentScreen || !targetScreen || currentScreen === targetScreen) return; if (direction === 'forward') { currentScreen.classList.remove('active'); currentScreen.classList.add('slide-out-left'); targetScreen.classList.add('slide-in-right'); } else { currentScreen.classList.remove('active'); currentScreen.classList.add('slide-out-right'); targetScreen.classList.add('slide-in-left'); } setTimeout(() => { currentScreen.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right'); targetScreen.classList.remove('slide-in-right', 'slide-in-left'); targetScreen.classList.add('active'); targetScreen.scrollTop = 0; }, 450); }

function initGrids() { const zodiacGrid = document.getElementById('zodiac-grid'); const constellationGrid = document.getElementById('constellation-grid'); zodiacGrid.innerHTML = ZODIACS.map((z, i) => `<div class="zodiac-item" data-index="${i}"><span class="emoji">${z.emoji}</span><span>${z.name}</span></div>`).join(''); constellationGrid.innerHTML = CONSTELLATIONS.map((c, i) => `<div class="constellation-item" data-index="${i}"><span class="emoji">${c.emoji}</span><span>${c.name}</span></div>`).join('');
  // 性别选择
  const genderSelector = document.getElementById('gender-selector');
  if (genderSelector) {
    genderSelector.addEventListener('click', (e) => {
      const item = e.target.closest('.gender-item');
      if (!item) return;
      genderSelector.querySelectorAll('.gender-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      selectedGender = item.dataset.gender;
      updateNextButton();
    });
  }
  zodiacGrid.addEventListener('click', (e) => {
    const item = e.target.closest('.zodiac-item');
    if (!item) return;
    zodiacGrid.querySelectorAll('.zodiac-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    selectedZodiac = parseInt(item.dataset.index);
    userManuallySetZodiac = true; // 标记用户手动选择
    // 用户手动选择生肖后，检查是否与出生日期不一致
    checkZodiacMatch();
    updateNextButton();
  });
  constellationGrid.addEventListener('click', (e) => {
    const item = e.target.closest('.constellation-item');
    if (!item) return;
    constellationGrid.querySelectorAll('.constellation-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    selectedConstellation = parseInt(item.dataset.index);
    userManuallySetConstellation = true; // 标记用户手动选择
    // 如果已选择了出生日期，检查星座是否匹配
    checkConstellationMatch();
    updateNextButton();
  });
}

// 根据公历年月日推算生肖索引（0=鼠, 1=牛, ..., 11=猪）
// 生肖以立春为界（约每年2月4日），2月4日前算上一年生肖
function getZodiacFromDate(year, month, day) {
  // 粗略：2月4日（含）之前算上一年生肖
  let y = year;
  if (month < 2 || (month === 2 && day < 4)) {
    y = year - 1;
  }
  // 1900年为鼠年（索引0）
  const idx = ((y - 1900) % 12 + 12) % 12;
  return idx;
}

// 检查用户选择的生肖是否与出生日期推算的一致
function checkZodiacMatch() {
  const hintEl = document.getElementById('zodiac-hint');
  if (!hintEl) return;
  if (selectedZodiac === null || !selectedYear || !selectedMonth || !selectedDay) {
    hintEl.style.display = 'none';
    return;
  }
  const correctIndex = getZodiacFromDate(selectedYear, selectedMonth, selectedDay);
  if (selectedZodiac !== correctIndex) {
    const correctName = ZODIACS[correctIndex].name;
    hintEl.textContent = `⚠️ 根据您的出生日期推算，您的生肖应为「${correctName}」，当前选择与出生日期不一致。命理计算将以出生日期为准。`;
    hintEl.style.display = 'block';
  } else {
    hintEl.style.display = 'none';
  }
}

// 出生日期变化时自动推算生肖（未手动选过则自动跟随日期，已手选则仅做一致性检查）
function autoDetectZodiac() {
  if (!selectedYear || !selectedMonth || !selectedDay) return;
  const correctIndex = getZodiacFromDate(selectedYear, selectedMonth, selectedDay);
  const zodiacGrid = document.getElementById('zodiac-grid');
  if (!zodiacGrid) return;

  if (!userManuallySetZodiac) {
    // 用户未手动选过：自动跟随日期变化
    selectedZodiac = correctIndex;
    const correctItem = zodiacGrid.querySelector(`.zodiac-item[data-index="${correctIndex}"]`);
    if (correctItem) {
      zodiacGrid.querySelectorAll('.zodiac-item').forEach(el => el.classList.remove('selected'));
      correctItem.classList.add('selected');
    }
    const hintEl = document.getElementById('zodiac-hint');
    if (hintEl) hintEl.style.display = 'none';
  } else {
    // 用户已手选：仅做一致性提示，保留用户手选
    checkZodiacMatch();
  }
  updateNextButton();
}

// 根据月日推算星座索引（0=白羊座, 1=金牛座, ..., 11=双鱼座）
function getConstellationFromDate(month, day) {
  // 星座日期范围（每个星座的起始月日）
  const boundaries = [
    { month: 1, day: 20 },  // 水瓶座开始
    { month: 2, day: 19 },  // 双鱼座开始
    { month: 3, day: 21 },  // 白羊座开始
    { month: 4, day: 20 },  // 金牛座开始
    { month: 5, day: 21 },  // 双子座开始
    { month: 6, day: 22 },  // 巨蟹座开始
    { month: 7, day: 23 },  // 狮子座开始
    { month: 8, day: 23 },  // 处女座开始
    { month: 9, day: 23 },  // 天秤座开始
    { month: 10, day: 24 }, // 天蝎座开始
    { month: 11, day: 22 }, // 射手座开始
    { month: 12, day: 22 }  // 摩羯座开始
  ];
  // 对应的星座索引（CONSTELLATIONS数组中的索引）
  // 水瓶=10, 双鱼=11, 白羊=0, 金牛=1, 双子=2, 巨蟹=3, 狮子=4, 处女=5, 天秤=6, 天蝎=7, 射手=8, 摩羯=9
  const constellationIndices = [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (month > boundaries[i].month || (month === boundaries[i].month && day >= boundaries[i].day)) {
      return constellationIndices[i];
    }
  }
  // 1月1日~1月19日 → 摩羯座
  return 9;
}

// 检查用户选择的星座是否与出生日期推算的一致
function checkConstellationMatch() {
  const hintEl = document.getElementById('constellation-hint');
  if (!hintEl) return;

  // 如果没有选择出生日期或星座，不显示提示
  if (selectedConstellation === null || !selectedMonth || !selectedDay) {
    hintEl.style.display = 'none';
    return;
  }

  const correctIndex = getConstellationFromDate(selectedMonth, selectedDay);
  if (selectedConstellation !== correctIndex) {
    const correctName = CONSTELLATIONS[correctIndex].name;
    hintEl.textContent = `⚠️ 根据您的出生日期推算，您的星座应为「${correctName}」，当前选择与出生日期不一致，请确认`;
    hintEl.style.display = 'block';
    // 只提醒，不强制修正，保留用户的选择
  } else {
    hintEl.style.display = 'none';
  }
}

// 出生日期变化时自动推算星座
function autoDetectConstellation() {
  if (!selectedMonth || !selectedDay) return;
  const correctIndex = getConstellationFromDate(selectedMonth, selectedDay);

  if (!userManuallySetConstellation) {
    // 用户未手动选过：自动跟随日期变化
    selectedConstellation = correctIndex;
    const constellationGrid = document.getElementById('constellation-grid');
    const correctItem = constellationGrid.querySelector(`.constellation-item[data-index="${correctIndex}"]`);
    if (correctItem) {
      constellationGrid.querySelectorAll('.constellation-item').forEach(el => el.classList.remove('selected'));
      correctItem.classList.add('selected');
    }
    const hintEl = document.getElementById('constellation-hint');
    if (hintEl) hintEl.style.display = 'none';
  } else {
    // 用户已选择星座，检查是否匹配
    checkConstellationMatch();
  }
  updateNextButton();
}

function updateNextButton() {
  // 生肖已由出生日期自动推算，只需确认性别已选
  // 同时保留生肖/出生日期存在性的兜底校验
  const ok = selectedGender !== null && selectedZodiac !== null && selectedYear && selectedMonth && selectedDay;
  document.getElementById('btn-to-scan').disabled = !ok;
}

async function startCamera() {
  const video = document.getElementById('camera-video');
  const btnCapture = document.getElementById('btn-capture');
  const btnUpload = document.getElementById('btn-upload-palm');

  capturedImageBlob = null;
  identifyResult = null;
  document.getElementById('btn-scan').style.display = 'none';
  document.getElementById('btn-recapture').style.display = 'none';
  document.getElementById('identify-result-card').style.display = 'none';

  // 检查是否支持 getUserMedia
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('浏览器不支持 getUserMedia');
    // 检查是否因为非 HTTPS
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      showErrorToast('摄像头需要HTTPS安全连接，请使用HTTPS访问本页面');
    } else {
      showErrorToast('当前浏览器不支持摄像头功能');
    }
    enableUploadFallback();
    return;
  }

  // 依次尝试：前置摄像头 → 后置摄像头 → 不指定摄像头
  const cameraConfigs = [
    { video: { facingMode: { exact: 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } } },
    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } } },
    { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } } },
    { video: true }
  ];

  let cameraOpened = false;
  for (const config of cameraConfigs) {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia(config);
      video.srcObject = cameraStream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('muted', 'true');
      video.muted = true;
      await video.play();
      video.style.display = 'block';
      btnCapture.style.display = 'block';
      btnCapture.innerHTML = '<i class="fas fa-camera"></i> 拍照采集掌纹';
      if (btnUpload) btnUpload.style.display = 'none';
      cameraOpened = true;
      console.log('摄像头已开启，配置:', JSON.stringify(config));
      break;
    } catch (err) {
      console.warn('摄像头配置失败:', JSON.stringify(config), err.name, err.message);
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
      continue;
    }
  }

  if (!cameraOpened) {
    console.warn('摄像头不可用，自动切换到相册上传模式');
    video.style.display = 'none';
    enableUploadFallback();
  }
}

// 启用文件上传备选方案
function enableUploadFallback() {
  const video = document.getElementById('camera-video');
  const btnCapture = document.getElementById('btn-capture');
  const btnUpload = document.getElementById('btn-upload-palm');
  const scanArea = document.getElementById('scan-area');

  video.style.display = 'none';
  scanArea.style.background = 'linear-gradient(135deg, #0a0015, #1a0030)';

  // 隐藏拍照按钮，显示上传按钮
  btnCapture.style.display = 'none';
  if (btnUpload) {
    btnUpload.style.display = 'block';
  }
}

// 处理文件上传
function handlePalmUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 验证文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    showErrorToast('请上传 JPG/PNG/WebP 格式的图片');
    return;
  }

  // 验证文件大小（10MB）
  if (file.size > 10 * 1024 * 1024) {
    showErrorToast('图片大小不能超过10MB');
    return;
  }

  // 读取并显示图片
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('scan-canvas');
      const ctx = canvas.getContext('2d');

      // 缩放到合理尺寸
      const maxSize = 1280;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // 显示预览
      const video = document.getElementById('camera-video');
      video.style.display = 'none';

      // 将canvas内容显示在扫描区域
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'contain';
      canvas.style.borderRadius = '12px';

      // 生成blob
      canvas.toBlob(function(blob) {
        capturedImageBlob = blob;
        // 隐藏上传按钮，显示检测中状态
        const btnUpload = document.getElementById('btn-upload-palm');
        if (btnUpload) btnUpload.style.display = 'none';
        document.getElementById('btn-capture').style.display = 'none';
        document.getElementById('btn-recapture').style.display = 'none';
        document.getElementById('btn-scan').style.display = 'none';
        // 调用手掌检测接口
        callIdentifyApi();
      }, 'image/jpeg', 0.85);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; } }

function capturePhoto() { const video = document.getElementById('camera-video'); const canvas = document.getElementById('scan-canvas'); const ctx = canvas.getContext('2d'); if (video.videoWidth > 0) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0); canvas.toBlob(function (blob) { capturedImageBlob = blob; video.pause(); document.getElementById('btn-capture').style.display = 'none'; document.getElementById('btn-recapture').style.display = 'none'; document.getElementById('btn-scan').style.display = 'none'; callIdentifyApi(); }, 'image/jpeg', 0.85); } else { canvas.width = 640; canvas.height = 480; const gradient = ctx.createRadialGradient(320, 240, 20, 320, 240, 300); gradient.addColorStop(0, '#e8c8a0'); gradient.addColorStop(0.5, '#d4a574'); gradient.addColorStop(1, '#8b6914'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 480); ctx.strokeStyle = '#a07040'; ctx.lineWidth = 2; for (let i = 0; i < 15; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * 640, Math.random() * 480); ctx.quadraticCurveTo(Math.random() * 640, Math.random() * 480, Math.random() * 640, Math.random() * 480); ctx.stroke(); } canvas.toBlob(function (blob) { capturedImageBlob = blob; document.getElementById('btn-capture').style.display = 'none'; document.getElementById('btn-recapture').style.display = 'none'; document.getElementById('btn-scan').style.display = 'none'; callIdentifyApi(); }, 'image/jpeg', 0.9); } }

async function callIdentifyApi() {
  const resultCard = document.getElementById('identify-result-card');
  const identifyIcon = document.getElementById('identify-icon');
  const identifyTitle = document.getElementById('identify-title');
  const identifySubtitle = document.getElementById('identify-subtitle');
  const identifyDetails = document.getElementById('identify-details');
  const btnScan = document.getElementById('btn-scan');
  const btnRecapture = document.getElementById('btn-recapture');
  const authSection = document.getElementById('identify-auth-section');

  resultCard.style.display = 'block';
  identifyIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  identifyIcon.className = 'identify-icon loading';
  identifyTitle.textContent = '正在检测手掌...';
  identifySubtitle.textContent = '分析图像中是否包含手掌';
  identifyDetails.style.display = 'none';
  authSection.style.display = 'none';

  try {
    // ============================================================
    // 🖐️ 你的刷掌识别算法（占位实现）
    // 此处应替换为你的掌纹检测服务调用，示例：
    // const formData = new FormData();
    // formData.append('file', capturedImageBlob, 'palm.jpg');
    // const response = await fetch(`${API_BASE}/palm-detect`, { method: 'POST', body: formData });
    // const result = await response.json();
    // ============================================================
    const result = { detected: true, message: '🖐️ 你的刷掌识别算法（占位响应）' };

    if (result.detected) {
      // 照片采集成功（不对      // 照片采集成功（不对"是否真的伸手"做强判定，避免误导）
      identifyIcon.innerHTML = '<i class="fas fa-camera"></i>';
      identifyIcon.className = 'identify-icon success';
      identifyTitle.textContent = '拍摄成功';
      identifySubtitle.textContent = '照片已采集，正在查询掌纹库...';
      identifyDetails.style.display = 'none';

      // 检测到手掌后，进行掌纹认证（查询掌纹库）
      await callPalmIdentify();

      btnScan.style.display = 'block';
      btnScan.disabled = false;
      btnScan.innerHTML = '<i class="fas fa-hand-sparkles"></i> 开始掌纹分析';
      btnRecapture.style.display = 'block';
    } else {
      // 未检测到手掌，提示用户重新拍摄
      identifyIcon.innerHTML = '<i class="fas fa-hand-paper"></i>';
      identifyIcon.className = 'identify-icon error';
      identifyTitle.textContent = '未检测到手掌';
      identifySubtitle.textContent = result.message || '请将手掌放入扫描区域后重新拍摄';
      identifyDetails.style.display = 'none';

      // 不显示分析按钮，只显示重新拍照按钮
      btnScan.style.display = 'none';
      btnRecapture.style.display = 'block';
      showErrorToast('未检测到掌纹，请重新拍摄手掌照片');
    }
  } catch (error) {
    // 网络异常时不阻止用户，降级为允许继续
    identifyResult = null;
    identifyIcon.innerHTML = '<i class="fas fa-hand-sparkles"></i>';
    identifyIcon.className = 'identify-icon warning';
    identifyTitle.textContent = '掌纹已采集';
    identifySubtitle.textContent = '检测服务暂不可用，可直接开始分析';
    identifyDetails.style.display = 'none';

    btnScan.style.display = 'block';
    btnScan.disabled = false;
    btnScan.innerHTML = '<i class="fas fa-hand-sparkles"></i> 开始掌纹分析';
    btnRecapture.style.display = 'block';
  }
}

// ===== 掌纹认证：在掌纹库中查找匹配用户 =====
async function callPalmIdentify() {
  const authSection = document.getElementById('identify-auth-section');
  const authIcon = document.getElementById('identify-auth-icon');
  const authTitle = document.getElementById('identify-auth-title');
  const authSubtitle = document.getElementById('identify-auth-subtitle');
  const authDetails = document.getElementById('identify-auth-details');

  // 显示认证区域，初始为加载状态
  authSection.style.display = 'block';
  authIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  authIcon.className = 'identify-auth-icon loading';
  authTitle.textContent = '正在查询掌纹库...';
  authSubtitle.textContent = '比对掌纹特征中';
  authDetails.style.display = 'none';

  try {
    // ============================================================
    // 🖐️ 你的刷掌识别算法（占位实现）
    // 此处应替换为你的掌纹1:N检索服务调用，示例：
    // const formData = new FormData();
    // formData.append('file', capturedImageBlob, 'palm.jpg');
    // const response = await fetch(`${API_BASE}/palm-identify`, { method: 'POST', body: formData });
    // const result = await response.json();
    // ============================================================
    const result = { identified: false, user_id: null, person_name: null, confidence: 0, message: '🖐️ 你的刷掌识别算法（占位响应）' };

    if (result.identified) {
      // 掌纹库中找到匹配用户
      identifyResult = {
        identified: true,
        user_id: result.user_id,
        person_name: result.person_name || result.user_id,
        confidence: result.confidence
      };

      authIcon.innerHTML = '<i class="fas fa-user-check"></i>';
      authIcon.className = 'identify-auth-icon success';
      authTitle.textContent = '掌纹认证成功！';
      authSubtitle.textContent = '已在掌纹库中找到匹配用户';
      authDetails.style.display = 'block';
      document.getElementById('identify-auth-userid').textContent = result.person_name || result.user_id;
      document.getElementById('identify-auth-userid').className = 'identify-value matched';
      document.getElementById('identify-auth-confidence').textContent = (result.confidence * 100).toFixed(1) + '%';

      // 更新主区域的副标题
      document.getElementById('identify-subtitle').textContent = '掌纹库匹配成功';
    } else {
      // 掌纹库中未找到匹配用户（不阻塞流程）
      identifyResult = {
        identified: false,
        user_id: null,
        person_name: null,
        confidence: 0
      };

      authIcon.innerHTML = '<i class="fas fa-user-secret"></i>';
      authIcon.className = 'identify-auth-icon not-found';
      authTitle.textContent = '掌纹库中暂未找到匹配';
      authSubtitle.textContent = result.message || '您的掌纹尚未录入掌纹库，不影响算命分析';
      // 显示详情区域，用户ID显示为空
      authDetails.style.display = 'block';
      document.getElementById('identify-auth-userid').textContent = '（空）';
      document.getElementById('identify-auth-userid').className = 'identify-value not-matched';
      document.getElementById('identify-auth-confidence').textContent = '0%';

      // 更新主区域的副标题
      document.getElementById('identify-subtitle').textContent = '可以开始分析';
    }
  } catch (error) {
    // 认证服务异常，不阻塞流程
    console.warn('掌纹认证请求失败:', error);
    identifyResult = null;

    authIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
    authIcon.className = 'identify-auth-icon error';
    authTitle.textContent = '掌纹认证服务暂不可用';
    authSubtitle.textContent = '不影响算命分析，可直接开始';
    // 显示详情区域，用户ID显示为空
    authDetails.style.display = 'block';
    document.getElementById('identify-auth-userid').textContent = '（空）';
    document.getElementById('identify-auth-userid').className = 'identify-value not-matched';
    document.getElementById('identify-auth-confidence').textContent = '-';
  }
}

function recapturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('scan-canvas');
  capturedImageBlob = null;
  identifyResult = null;

  // 隐藏canvas预览
  canvas.style.display = 'none';

  if (cameraStream) {
    // 摄像头模式：恢复视频播放
    video.style.display = 'block';
    video.play();
    document.getElementById('btn-capture').style.display = 'block';
    const btnUpload = document.getElementById('btn-upload-palm');
    if (btnUpload) btnUpload.style.display = 'none';
  } else {
    // 文件上传模式：显示上传按钮
    video.style.display = 'none';
    document.getElementById('btn-capture').style.display = 'none';
    const btnUpload = document.getElementById('btn-upload-palm');
    if (btnUpload) btnUpload.style.display = 'block';
    // 重置文件输入
    const fileInput = document.getElementById('palm-file-input');
    if (fileInput) fileInput.value = '';
  }

  document.getElementById('btn-scan').style.display = 'none';
  document.getElementById('btn-recapture').style.display = 'none';
  document.getElementById('scan-progress-wrapper').style.display = 'none';
  document.getElementById('identify-result-card').style.display = 'none';
  // 重置掌纹认证区域
  const authSection = document.getElementById('identify-auth-section');
  if (authSection) authSection.style.display = 'none';
}

async function uploadPalmForAnalysis() {
  if (!capturedImageBlob) { showErrorToast('请先拍照采集掌纹'); return null; }

  try {
    const formData = new FormData();
    formData.append('file', capturedImageBlob, 'palm.jpg');
    // 超时58秒，略大于后端pipeline超时(55s)，确保能收到后端响应
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 58000);
    const response = await fetch(`${API_BASE}/readings`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.code === 0) {
      palmAnalysisResult = result.data;
      return result.data;
    } else {
      throw new Error(result.message || '分析失败');
    }
  } catch (error) {
    console.error('掌纹分析API调用失败:', error.name, error.message);
    return null;
  }
}

function showErrorToast(message) { const toast = document.getElementById('error-toast'); const msgEl = document.getElementById('error-message'); if (!toast || !msgEl) return; msgEl.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }

// ===== 时辰数据 =====
const SHICHEN_DATA = [
  { name: '子时', alias: '夜半', time: '前日23:00 ~ 次日01:00', branch: '子', hours: [23, 0] },
  { name: '丑时', alias: '鸡鸣', time: '01:00 ~ 03:00', branch: '丑', hours: [1, 2] },
  { name: '寅时', alias: '平旦', time: '03:00 ~ 05:00', branch: '寅', hours: [3, 4] },
  { name: '卯时', alias: '日出', time: '05:00 ~ 07:00', branch: '卯', hours: [5, 6] },
  { name: '辰时', alias: '食时', time: '07:00 ~ 09:00', branch: '辰', hours: [7, 8] },
  { name: '巳时', alias: '隅中', time: '09:00 ~ 11:00', branch: '巳', hours: [9, 10] },
  { name: '午时', alias: '日中', time: '11:00 ~ 13:00', branch: '午', hours: [11, 12] },
  { name: '未时', alias: '日昳', time: '13:00 ~ 15:00', branch: '未', hours: [13, 14] },
  { name: '申时', alias: '哺时', time: '15:00 ~ 17:00', branch: '申', hours: [15, 16] },
  { name: '酉时', alias: '日入', time: '17:00 ~ 19:00', branch: '酉', hours: [17, 18] },
  { name: '戌时', alias: '黄昏', time: '19:00 ~ 21:00', branch: '戌', hours: [19, 20] },
  { name: '亥时', alias: '人定', time: '21:00 ~ 23:00', branch: '亥', hours: [21, 22] }
];

let selectedShichen = 0; // 默认子时

// ===== 时辰滚轮选择器 =====
function initShichenPicker() {
  const list = document.getElementById('shichen-list');
  const picker = document.getElementById('shichen-picker');
  if (!list || !picker) return;

  const itemHeight = 44;
  const visibleItems = 4; // 上下各显示的额外项数
  const paddingItems = 2; // 上下留白项数

  // 渲染列表（前后各加padding空项）
  let html = '';
  for (let i = 0; i < paddingItems; i++) {
    html += `<div class="shichen-item shichen-padding" style="height:${itemHeight}px;"></div>`;
  }
  SHICHEN_DATA.forEach((s, idx) => {
    html += `<div class="shichen-item" data-index="${idx}" style="height:${itemHeight}px;">
      <span class="shichen-item-name">${s.name}</span>
      <span class="shichen-item-time">${s.alias} · ${s.time}</span>
    </div>`;
  });
  for (let i = 0; i < paddingItems; i++) {
    html += `<div class="shichen-item shichen-padding" style="height:${itemHeight}px;"></div>`;
  }
  list.innerHTML = html;

  let currentIndex = 0;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let startTranslate = 0;

  function getTranslateForIndex(idx) {
    // 修正偏移：让数据项中心对齐到高亮框中心
    const containerHeight = 180;
    const offset = containerHeight / 2 - itemHeight / 2 - paddingItems * itemHeight;
    return -(idx * itemHeight) + offset;
  }

  function setTranslate(y, animate) {
    list.style.transition = animate ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    list.style.transform = `translateY(${y}px)`;
  }

  function snapToIndex(idx) {
    idx = Math.max(0, Math.min(SHICHEN_DATA.length - 1, idx));
    currentIndex = idx;
    selectedShichen = idx;
    setTranslate(getTranslateForIndex(idx), true);
    updateActiveItem(idx);
    updateShichenDisplay(idx);
  }

  function updateActiveItem(idx) {
    list.querySelectorAll('.shichen-item').forEach((el, i) => {
      const dataIdx = parseInt(el.dataset.index);
      if (dataIdx === idx) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  function updateShichenDisplay(idx) {
    const s = SHICHEN_DATA[idx];
    const nameDisplay = document.getElementById('shichen-name-display');
    const timeDisplay = document.getElementById('shichen-time-display');
    if (nameDisplay) nameDisplay.textContent = s.name;
    if (timeDisplay) timeDisplay.textContent = s.time;
  }

  // 触摸/鼠标事件
  function onStart(e) {
    isDragging = true;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    startTranslate = getTranslateForIndex(currentIndex);
    list.style.transition = 'none';
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const diff = clientY - startY;
    currentY = startTranslate + diff;
    list.style.transform = `translateY(${currentY}px)`;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    const containerHeight = 180;
    const offset = containerHeight / 2 - itemHeight / 2 - paddingItems * itemHeight;
    const nearestIndex = Math.round(-(currentY - offset) / itemHeight);
    snapToIndex(nearestIndex);
  }

  picker.addEventListener('touchstart', onStart, { passive: true });
  picker.addEventListener('touchmove', onMove, { passive: false });
  picker.addEventListener('touchend', onEnd);
  picker.addEventListener('mousedown', onStart);
  picker.addEventListener('mousemove', onMove);
  picker.addEventListener('mouseup', onEnd);
  picker.addEventListener('mouseleave', () => { if (isDragging) onEnd(); });

  // 鼠标滚轮支持
  picker.addEventListener('wheel', (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    snapToIndex(currentIndex + direction);
  }, { passive: false });

  // 点击选择
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.shichen-item[data-index]');
    if (item) {
      snapToIndex(parseInt(item.dataset.index));
    }
  });

  // 初始化位置
  snapToIndex(0);
}

// ===== 真太阳时开关逻辑 =====
function initTrueSolarToggle() {
  const toggle = document.getElementById('true-solar-toggle');
  const section = document.getElementById('birthplace-picker-section');
  if (!toggle || !section) return;

  toggle.addEventListener('change', () => {
    section.style.display = toggle.checked ? 'block' : 'none';
    if (toggle.checked && !section._inited) {
      initBirthplacePicker();
      section._inited = true;
    }
  });
}

// ===== 出生地三级联动滚轮选择器 =====
let selectedProvinceIdx = 0;
let selectedCityIdx = 0;
let selectedDistrictIdx = 0;

function initBirthplacePicker() {
  if (typeof CHINA_REGIONS === 'undefined' || !CHINA_REGIONS.length) {
    console.warn('CHINA_REGIONS 数据未加载');
    return;
  }
  // 默认：北京→北京市→东城区
  selectedProvinceIdx = 0;
  selectedCityIdx = 0;
  selectedDistrictIdx = 0;

  renderBirthplaceColumn('province', CHINA_REGIONS.map(p => p.name), selectedProvinceIdx);
  const cities = CHINA_REGIONS[selectedProvinceIdx].cities;
  renderBirthplaceColumn('city', cities.map(c => c.name), selectedCityIdx);
  const districts = cities[selectedCityIdx].districts;
  renderBirthplaceColumn('district', districts.map(d => d.name), selectedDistrictIdx);

  updateBirthplaceDisplay();
}

function renderBirthplaceColumn(type, items, initialIndex) {
  const list = document.getElementById(`birthplace-list-${type}`);
  const col = document.getElementById(`birthplace-col-${type}`);
  if (!list || !col) return;

  const itemHeight = 44;
  const paddingItems = 2;

  let html = '';
  for (let i = 0; i < paddingItems; i++) {
    html += `<div class="birthplace-item birthplace-padding" style="height:${itemHeight}px;"></div>`;
  }
  items.forEach((name, idx) => {
    html += `<div class="birthplace-item" data-index="${idx}" style="height:${itemHeight}px;">
      <span class="birthplace-item-text">${name}</span>
    </div>`;
  });
  for (let i = 0; i < paddingItems; i++) {
    html += `<div class="birthplace-item birthplace-padding" style="height:${itemHeight}px;"></div>`;
  }
  list.innerHTML = html;

  let currentIndex = initialIndex || 0;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let startTranslate = 0;
  const totalItems = items.length;

  function getTranslateForIndex(idx) {
    const containerHeight = 180;
    const offset = containerHeight / 2 - itemHeight / 2 - paddingItems * itemHeight;
    return -(idx * itemHeight) + offset;
  }

  function setTranslate(y, animate) {
    list.style.transition = animate ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    list.style.transform = `translateY(${y}px)`;
  }

  function updateActiveItem(idx) {
    list.querySelectorAll('.birthplace-item').forEach(el => {
      const dataIdx = parseInt(el.dataset.index);
      el.classList.toggle('active', dataIdx === idx);
    });
  }

  function snapToIndex(idx) {
    idx = Math.max(0, Math.min(totalItems - 1, idx));
    currentIndex = idx;
    setTranslate(getTranslateForIndex(idx), true);
    updateActiveItem(idx);

    if (type === 'province') {
      if (selectedProvinceIdx !== idx) {
        selectedProvinceIdx = idx;
        // 重新加载市列表
        const cities = CHINA_REGIONS[idx].cities;
        selectedCityIdx = 0;
        renderBirthplaceColumn('city', cities.map(c => c.name), 0);
        // 重新加载县区列表
        selectedDistrictIdx = 0;
        renderBirthplaceColumn('district', cities[0].districts.map(d => d.name), 0);
      }
    } else if (type === 'city') {
      if (selectedCityIdx !== idx) {
        selectedCityIdx = idx;
        // 重新加载县区列表
        const districts = CHINA_REGIONS[selectedProvinceIdx].cities[idx].districts;
        selectedDistrictIdx = 0;
        renderBirthplaceColumn('district', districts.map(d => d.name), 0);
      }
    } else if (type === 'district') {
      selectedDistrictIdx = idx;
    }
    updateBirthplaceDisplay();
  }

  function onStart(e) {
    isDragging = true;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    startTranslate = getTranslateForIndex(currentIndex);
    list.style.transition = 'none';
  }
  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const diff = clientY - startY;
    currentY = startTranslate + diff;
    list.style.transform = `translateY(${currentY}px)`;
  }
  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    const containerHeight = 180;
    const offset = containerHeight / 2 - itemHeight / 2 - paddingItems * itemHeight;
    const nearestIndex = Math.round(-(currentY - offset) / itemHeight);
    snapToIndex(nearestIndex);
  }

  col.addEventListener('touchstart', onStart, { passive: true });
  col.addEventListener('touchmove', onMove, { passive: false });
  col.addEventListener('touchend', onEnd);
  col.addEventListener('mousedown', onStart);
  col.addEventListener('mousemove', onMove);
  col.addEventListener('mouseup', onEnd);
  col.addEventListener('mouseleave', () => { if (isDragging) onEnd(); });
  col.addEventListener('wheel', (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    snapToIndex(currentIndex + direction);
  }, { passive: false });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.birthplace-item[data-index]');
    if (item) snapToIndex(parseInt(item.dataset.index));
  });

  snapToIndex(initialIndex || 0);
}

function updateBirthplaceDisplay() {
  const display = document.getElementById('birthplace-display');
  const lngDisplay = document.getElementById('birthplace-lng-display');
  if (!display) return;
  const province = CHINA_REGIONS[selectedProvinceIdx];
  if (!province) { display.textContent = '请选择出生地'; return; }
  const city = province.cities[selectedCityIdx];
  if (!city) return;
  const district = city.districts[selectedDistrictIdx];
  if (!district) return;
  // 省市县区名称有时会重复（例如北京市-北京），直观展示
  const parts = [province.name];
  if (city.name !== province.name) parts.push(city.name);
  parts.push(district.name);
  display.textContent = parts.join(' / ');
  if (lngDisplay) {
    lngDisplay.textContent = `东经 ${district.lng.toFixed(2)}°`;
  }
}

// 获取当前选中出生地的经度（真太阳时修正用）。未开启或未选择时返回 null
function getBirthLongitude() {
  const toggle = document.getElementById('true-solar-toggle');
  if (!toggle || !toggle.checked) return null;
  if (typeof CHINA_REGIONS === 'undefined') return null;
  const province = CHINA_REGIONS[selectedProvinceIdx];
  if (!province) return null;
  const city = province.cities[selectedCityIdx];
  if (!city) return null;
  const district = city.districts[selectedDistrictIdx];
  if (!district) return null;
  return district.lng;
}

// 获取当前选中出生地的文本描述（用于日志/展示）
function getBirthplaceText() {
  if (typeof CHINA_REGIONS === 'undefined') return '';
  const province = CHINA_REGIONS[selectedProvinceIdx];
  if (!province) return '';
  const city = province.cities[selectedCityIdx];
  if (!city) return '';
  const district = city.districts[selectedDistrictIdx];
  if (!district) return '';
  const parts = [province.name];
  if (city.name !== province.name) parts.push(city.name);
  parts.push(district.name);
  return parts.join('-');
}

// ===== 真太阳时修正 =====
function getTrueSolarHour(hour, minute, longitude) {
  // 真太阳时 = 北京时间 + (出生地经度 - 120) * 4分钟
  // 120是北京时间基准经度（东经120度）
  const offsetMinutes = (longitude - 120) * 4;
  let totalMinutes = hour * 60 + minute + offsetMinutes;
  // 处理跨日
  if (totalMinutes < 0) totalMinutes += 1440;
  if (totalMinutes >= 1440) totalMinutes -= 1440;
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

// ===== 根据小时获取时辰索引 =====
function getShichenFromHour(hour) {
  // 子时: 23-1, 丑时: 1-3, 寅时: 3-5, ...
  if (hour === 23 || hour === 0) return 0; // 子时
  return Math.floor((hour + 1) / 2);
}

// ===== 年月日滚轮选择器 =====
let selectedYear = 1990;
let selectedMonth = 1;
let selectedDay = 1;

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function initBirthdayPicker() {
  const currentYear = new Date().getFullYear();
  const startYear = 1940;
  const endYear = currentYear;

  // 初始化年份列
  initBirthdayColumn('year', startYear, endYear, '年', selectedYear - startYear);
  // 初始化月份列
  initBirthdayColumn('month', 1, 12, '月', selectedMonth - 1);
  // 初始化日期列
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  initBirthdayColumn('day', 1, daysInMonth, '日', selectedDay - 1);

  updateBirthdayDisplay();
}

function initBirthdayColumn(type, start, end, suffix, initialIndex) {
  const list = document.getElementById(`birthday-list-${type}`);
  const col = document.getElementById(`birthday-col-${type}`);
  if (!list || !col) return;

  const itemHeight = 44;
  const paddingItems = 2;

  // 渲染列表
  let html = '';
  for (let i = 0; i < paddingItems; i++) {
    html += `<div class="birthday-item birthday-padding" style="height:${itemHeight}px;"></div>`;
  }
  for (let val = start; val <= end; val++) {
    const idx = val - start;
    html += `<div class="birthday-item" data-index="${idx}" data-value="${val}" style="height:${itemHeight}px;">
      <span class="birthday-item-text">${val}${suffix}</span>
    </div>`;
  }
  for (let i = 0; i < paddingItems; i++) {
    html += `<div class="birthday-item birthday-padding" style="height:${itemHeight}px;"></div>`;
  }
  list.innerHTML = html;

  let currentIndex = initialIndex || 0;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let startTranslate = 0;
  const totalItems = end - start + 1;

  function getTranslateForIndex(idx) {
    const containerHeight = 180;
    const offset = containerHeight / 2 - itemHeight / 2 - paddingItems * itemHeight;
    return -(idx * itemHeight) + offset;
  }

  function setTranslate(y, animate) {
    list.style.transition = animate ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    list.style.transform = `translateY(${y}px)`;
  }

  function snapToIndex(idx) {
    idx = Math.max(0, Math.min(totalItems - 1, idx));
    currentIndex = idx;
    setTranslate(getTranslateForIndex(idx), true);
    updateActiveItem(idx);

    const value = start + idx;
    if (type === 'year') {
      selectedYear = value;
      // 更新日期列（因为不同月份天数不同）
      refreshDayColumn();
    } else if (type === 'month') {
      selectedMonth = value;
      refreshDayColumn();
    } else if (type === 'day') {
      selectedDay = value;
    }
    updateBirthdayDisplay();
  }

  function updateActiveItem(idx) {
    list.querySelectorAll('.birthday-item').forEach(el => {
      const dataIdx = parseInt(el.dataset.index);
      if (dataIdx === idx) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // 触摸/鼠标事件
  function onStart(e) {
    isDragging = true;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    startTranslate = getTranslateForIndex(currentIndex);
    list.style.transition = 'none';
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const diff = clientY - startY;
    currentY = startTranslate + diff;
    list.style.transform = `translateY(${currentY}px)`;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    const containerHeight = 180;
    const offset = containerHeight / 2 - itemHeight / 2 - paddingItems * itemHeight;
    const nearestIndex = Math.round(-(currentY - offset) / itemHeight);
    snapToIndex(nearestIndex);
  }

  col.addEventListener('touchstart', onStart, { passive: true });
  col.addEventListener('touchmove', onMove, { passive: false });
  col.addEventListener('touchend', onEnd);
  col.addEventListener('mousedown', onStart);
  col.addEventListener('mousemove', onMove);
  col.addEventListener('mouseup', onEnd);
  col.addEventListener('mouseleave', () => { if (isDragging) onEnd(); });

  // 鼠标滚轮支持
  col.addEventListener('wheel', (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    snapToIndex(currentIndex + direction);
  }, { passive: false });

  // 点击选择
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.birthday-item[data-index]');
    if (item) {
      snapToIndex(parseInt(item.dataset.index));
    }
  });

  // 初始化位置
  snapToIndex(initialIndex || 0);

  // 保存snapToIndex引用以便外部调用
  col._snapToIndex = snapToIndex;
  col._getCurrentIndex = () => currentIndex;
}

function refreshDayColumn() {
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  // 如果当前选中的日超过了新月份的天数，调整
  if (selectedDay > daysInMonth) {
    selectedDay = daysInMonth;
  }
  initBirthdayColumn('day', 1, daysInMonth, '日', selectedDay - 1);
}

function updateBirthdayDisplay() {
  const display = document.getElementById('birthday-display');
  const hiddenInput = document.getElementById('user-birthday');
  if (display) {
    display.textContent = `${selectedYear}年${String(selectedMonth).padStart(2, '0')}月${String(selectedDay).padStart(2, '0')}日`;
  }
  if (hiddenInput) {
    hiddenInput.value = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  }
  // 日期变化时自动推算星座与生肖
  if (typeof autoDetectConstellation === 'function') {
    autoDetectConstellation();
  }
  if (typeof autoDetectZodiac === 'function') {
    autoDetectZodiac();
  }
}

// ===== 八字计算核心 =====
const BAZI_TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BAZI_DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BAZI_WUXING_GAN = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
const BAZI_WUXING_ZHI = { '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水' };

// 地支藏干数据
const DIZHI_CANGGAN = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲']
};

// 天干五行颜色映射：甲乙木绿，丙丁火红，戊己土棕，庚辛金黄，壬癸水深蓝
const GAN_WUXING_COLOR = {
  '甲': '#2ECC71', '乙': '#2ECC71',   // 木 - 绿色
  '丙': '#FF4444', '丁': '#FF4444',   // 火 - 红色
  '戊': '#8B4513', '己': '#8B4513',   // 土 - 棕色
  '庚': '#DAA520', '辛': '#DAA520',   // 金 - 黄色
  '壬': '#5B9BD5', '癸': '#5B9BD5'    // 水 - 深蓝色（高对比度）
};

// 地支五行颜色映射
const ZHI_WUXING_COLOR = {
  '子': '#5B9BD5', '亥': '#5B9BD5',   // 水 - 深蓝色（高对比度）
  '寅': '#2ECC71', '卯': '#2ECC71',   // 木 - 绿色
  '巳': '#FF4444', '午': '#FF4444',   // 火 - 红色
  '丑': '#8B4513', '辰': '#8B4513', '未': '#8B4513', '戌': '#8B4513', // 土 - 棕色
  '申': '#DAA520', '酉': '#DAA520'    // 金 - 黄色
};

// 阳干：甲丙戊庚壬（正体），阴干：乙丁己辛癸（斜体）
const YIN_GAN = ['乙', '丁', '己', '辛', '癸'];
function isYinGan(gan) { return YIN_GAN.includes(gan); }

// 天干特质
const BAZI_GAN_TRAITS = {
  '甲': '参天大树，刚正不阿',
  '乙': '花草藤蔓，柔韧灵巧',
  '丙': '太阳之火，光明磊落',
  '丁': '灯烛之火，温文尔雅',
  '戊': '高山大地，厚重诚信',
  '己': '田园沃土，包容滋养',
  '庚': '刀剑之金，刚毅果断',
  '辛': '珠玉之金，精致细腻',
  '壬': '江河大海，智慧深邃',
  '癸': '雨露甘霖，润物无声'
};

// 计算年柱
function getYearPillar(year) {
  const ganIdx = (year - 4) % 10;
  const zhiIdx = (year - 4) % 12;
  return { gan: BAZI_TIANGAN[ganIdx], zhi: BAZI_DIZHI[zhiIdx] };
}

// 计算月柱（需要年干来推月干）
function getMonthPillar(year, month, day) {
  // 节气月：以"节"为界划分月份
  // 公历每月的"节"大约日期（立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪、小寒）
  // 索引0=1月(小寒约6日), 1=2月(立春约4日), 2=3月(惊蛰约6日), ...
  const jieqi = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];

  // 判断当前日期是在本月节气之前还是之后
  // 节气后：属于本月对应的节气月
  // 节气前：属于上月对应的节气月
  // 公历月份与节气月序的关系：
  //   公历2月立春后 → 寅月(正月, 节气月序=1)
  //   公历3月惊蛰后 → 卯月(二月, 节气月序=2)
  //   ...
  //   公历1月小寒后 → 丑月(十二月, 节气月序=12)
  // 即：节气月序 = (month - 1) 当month>=2时，month=1时节气月序=12
  // 简化公式：节气月序 = ((month - 2 + 12) % 12) + 1，范围1~12

  let jieqiMonth; // 节气月序：1=正月(寅), 2=二月(卯), ..., 12=十二月(丑)
  let jieqiYear = year; // 用于计算月干的年份

  if (day >= jieqi[month - 1]) {
    // 在本月节气之后
    jieqiMonth = ((month - 2 + 12) % 12) + 1;
  } else {
    // 在本月节气之前，属于上一个节气月
    jieqiMonth = ((month - 3 + 12) % 12) + 1;
  }

  // 处理年份边界：如果是1月小寒前，或2月立春前，节气月属于上一年
  if (month === 1 && day < jieqi[0]) {
    jieqiYear = year - 1; // 1月小寒前属于上一年的子月(十一月)
  } else if (month === 1 || (month === 2 && day < jieqi[1])) {
    jieqiYear = year - 1; // 立春前属于上一年
  }

  // 月支：正月=寅(2), 二月=卯(3), ..., 十一月=子(0), 十二月=丑(1)
  const zhiIdx = (jieqiMonth + 1) % 12;

  // 年上起月法：甲己之年丙作首，乙庚之岁戊为头...
  const yearGanIdx = (jieqiYear - 4) % 10;
  const monthGanBase = [2, 4, 6, 8, 0]; // 甲己->丙, 乙庚->戊, 丙辛->庚, 丁壬->壬, 戊癸->甲
  const baseGan = monthGanBase[yearGanIdx % 5];
  const ganIdx = (baseGan + (jieqiMonth - 1)) % 10;

  return { gan: BAZI_TIANGAN[ganIdx], zhi: BAZI_DIZHI[zhiIdx] };
}

// 计算日柱（简化算法）
function getDayPillar(year, month, day) {
  // 使用蔡勒公式的变体来计算日干支序号
  // 基准：1900年1月1日为甲戌日（干=0甲，支=10戌 -> 序号=10）
  const baseDate = new Date(1900, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  const diffDays = Math.floor((targetDate - baseDate) / 86400000);
  const ganIdx = (diffDays % 10 + 10) % 10;
  const zhiIdx = ((diffDays + 10) % 12 + 12) % 12;
  return { gan: BAZI_TIANGAN[ganIdx], zhi: BAZI_DIZHI[zhiIdx] };
}

// 计算时柱（需要日干来推时干）
function getHourPillar(dayGan, shichenIdx) {
  const dayGanIdx = BAZI_TIANGAN.indexOf(dayGan);
  // 日上起时法：甲己还加甲，乙庚丙作初...
  const hourGanBase = [0, 2, 4, 6, 8]; // 甲己->甲, 乙庚->丙, 丙辛->戊, 丁壬->庚, 戊癸->壬
  const baseGan = hourGanBase[dayGanIdx % 5];
  const ganIdx = (baseGan + shichenIdx) % 10;
  return { gan: BAZI_TIANGAN[ganIdx], zhi: BAZI_DIZHI[shichenIdx] };
}

// 完整八字计算
function calculateBazi(year, month, day, shichenIdx) {
  const yearPillar = getYearPillar(year);
  const monthPillar = getMonthPillar(year, month, day);
  const dayPillar = getDayPillar(year, month, day);
  const hourPillar = getHourPillar(dayPillar.gan, shichenIdx);

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    dayMaster: dayPillar.gan,
    dayMasterWuxing: BAZI_WUXING_GAN[dayPillar.gan],
    dayMasterTrait: BAZI_GAN_TRAITS[dayPillar.gan]
  };
}

// 根据八字五行分布生成详细评语（300字以上，含性格、事业、感情分析）
function generateBaziComment(bazi) {
  // 统计八字中五行出现次数（天干+地支）
  const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  const pillars = [bazi.year, bazi.month, bazi.day, bazi.hour];
  pillars.forEach(p => {
    if (p.gan && BAZI_WUXING_GAN[p.gan]) wuxingCount[BAZI_WUXING_GAN[p.gan]]++;
    if (p.zhi && BAZI_WUXING_ZHI[p.zhi]) wuxingCount[BAZI_WUXING_ZHI[p.zhi]]++;
  });

  // 统计藏干五行权重
  const wxWeight = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  pillars.forEach((p, idx) => {
    const ganW = (idx === 2) ? 3.5 : 3.0;
    if (p.gan && BAZI_WUXING_GAN[p.gan]) wxWeight[BAZI_WUXING_GAN[p.gan]] += ganW;
    if (p.zhi && BAZI_WUXING_ZHI[p.zhi]) wxWeight[BAZI_WUXING_ZHI[p.zhi]] += 2.5;
    if (p.zhi && DIZHI_CANGGAN[p.zhi]) {
      DIZHI_CANGGAN[p.zhi].forEach((cg, cgIdx) => {
        if (BAZI_WUXING_GAN[cg]) wxWeight[BAZI_WUXING_GAN[cg]] += cgIdx === 0 ? 1.5 : (cgIdx === 1 ? 1.2 : 0.8);
      });
    }
  });

  // 找出最旺和最弱的五行
  let maxWx = '', maxWeight = 0, minWx = '', minWeight = 999;
  const missing = [];
  for (const [wx, count] of Object.entries(wuxingCount)) {
    if (count === 0) missing.push(wx);
  }
  for (const [wx, w] of Object.entries(wxWeight)) {
    if (w > maxWeight) { maxWeight = w; maxWx = wx; }
    if (w < minWeight) { minWeight = w; minWx = wx; }
  }

  // 五行特质
  const wuxingTraits = {
    '金': '主义，性刚毅果敢，有决断力',
    '木': '主仁，性正直宽厚，富同情心',
    '水': '主智，性聪慧灵活，善于变通',
    '火': '主礼，性热情奔放，有感染力',
    '土': '主信，性厚重诚实，重承诺守信'
  };

  // 日主强弱判断
  const dayWx = bazi.dayMasterWuxing;
  const shengWxMap = { '金': '土', '木': '水', '水': '金', '火': '木', '土': '火' };
  const totalHelp = wxWeight[dayWx] + (wxWeight[shengWxMap[dayWx]] || 0);
  const totalWx = Object.values(wxWeight).reduce((a, b) => a + b, 0);
  const dayStrength = totalHelp / totalWx;

  let strengthLabel, strengthDesc;
  if (dayStrength >= 0.45) {
    strengthLabel = '身旺';
    strengthDesc = '日主力量充沛，自信心强，行动力出众，有主见且不易受他人左右';
  } else if (dayStrength <= 0.28) {
    strengthLabel = '身弱';
    strengthDesc = '日主力量偏弱，性格温和谦逊，善于倾听与合作，需借助外力方能成就大事';
  } else {
    strengthLabel = '中和';
    strengthDesc = '日主力量适中，刚柔并济，进退有度，能够灵活应对各种局面';
  }

  // ===== 性格分析 =====
  const ganPersonality = {
    '甲': '如参天大树般正直挺拔，有领导气质和开拓精神，做事光明磊落，不拘小节。但有时过于刚直，不善变通，需学会以柔克刚。',
    '乙': '如花草藤蔓般柔韧灵巧，善于察言观色，适应力极强。外表温和内心坚韧，有独特的审美品味和艺术天赋，善于在逆境中找到出路。',
    '丙': '如太阳般热情开朗，光明磊落，有强烈的正义感和感染力。天生乐观，善于鼓舞他人，但有时过于直率，需注意言辞分寸。',
    '丁': '如灯烛之火般温文尔雅，内心明亮而细腻。洞察力强，善于发现事物本质，文采出众，有独到的见解。性格内敛但内心坚定。',
    '戊': '如高山大地般厚重稳健，诚信可靠，有极强的包容力和责任感。做事踏实稳重，重承诺守信用，是值得信赖的合作伙伴和朋友。',
    '己': '如田园沃土般温润包容，善于滋养和培育他人。性格温和有耐心，善于调和矛盾，有很强的亲和力，但有时过于迁就他人。',
    '庚': '如刀剑之金般刚毅果断，有魄力和执行力。做事雷厉风行，不拖泥带水，有强烈的竞争意识和进取心，适合在压力中成长。',
    '辛': '如珠玉之金般精致细腻，有极高的审美品味和鉴赏力。聪慧灵巧，善于发现美好事物，内心敏感而丰富，追求完美和品质。',
    '壬': '如江河大海般智慧深邃，思维开阔，有大局观和战略眼光。善于谋略和规划，适应力强，能在复杂环境中游刃有余。',
    '癸': '如雨露甘霖般润物无声，直觉力强，有灵性和悟性。善于感知他人情感，内心世界丰富，有独特的精神追求和哲学思考。'
  };

  // ===== 事业分析 =====
  // 基于十神关系判断事业方向
  const yearShiShen = getShiShen(bazi.day.gan, bazi.year.gan);
  const monthShiShen = getShiShen(bazi.day.gan, bazi.month.gan);
  const hourShiShen = getShiShen(bazi.day.gan, bazi.hour.gan);
  const shiShenList = [yearShiShen, monthShiShen, hourShiShen].filter(s => s);

  let careerAnalysis = '';
  if (shiShenList.includes('正官') || shiShenList.includes('七杀')) {
    careerAnalysis = '命局中官杀星显现，适合从事管理、行政、公务员等体制内工作，也适合法律、军事等需要权威和纪律的领域。事业发展中容易得到上级赏识和提拔。';
  } else if (shiShenList.includes('正财') || shiShenList.includes('偏财')) {
    careerAnalysis = '命局中财星透出，天生有理财头脑和商业嗅觉，适合从事金融、投资、商贸等与财富相关的行业。财运方面先天条件较好，善于把握赚钱机会。';
  } else if (shiShenList.includes('食神') || shiShenList.includes('伤官')) {
    careerAnalysis = '命局中食伤星活跃，创造力和表达能力出众，适合从事艺术、文学、教育、演艺、自媒体等需要创意和才华的领域。思维活跃，善于创新。';
  } else if (shiShenList.includes('正印') || shiShenList.includes('偏印')) {
    careerAnalysis = '命局中印星护身，学习能力强，适合从事学术研究、教育、医疗、技术等需要专业知识的领域。一生中贵人运较好，容易得到长辈和师长的帮助。';
  } else if (shiShenList.includes('比肩') || shiShenList.includes('劫财')) {
    careerAnalysis = '命局中比劫星旺，独立性强，有创业精神和竞争意识，适合自主创业或从事需要团队协作的工作。人际关系广泛，善于结交朋友。';
  } else {
    careerAnalysis = '命局五行流通，事业发展方向较为灵活，可根据自身兴趣和特长选择职业方向。建议在30岁前多尝试不同领域，找到最适合自己的赛道。';
  }

  // ===== 感情分析 =====
  let loveAnalysis = '';
  const keWxMap = { '金': '木', '木': '土', '水': '火', '火': '金', '土': '水' }; // 我克=财=妻/夫
  const spouseWx = keWxMap[dayWx];
  const spouseStrength = wxWeight[spouseWx] || 0;

  if (spouseStrength >= totalWx * 0.22) {
    loveAnalysis = `感情方面，命局中${spouseWx}气（配偶星）力量充沛，感情生活丰富多彩。异性缘佳，容易吸引到优秀的伴侣。婚后感情和谐，夫妻之间能够相互扶持、共同成长。`;
  } else if (spouseStrength >= totalWx * 0.12) {
    loveAnalysis = `感情方面，命局中${spouseWx}气（配偶星）力量适中，感情发展较为平稳。虽不会有轰轰烈烈的浪漫，但能收获细水长流的温馨。建议多主动表达情感，用心经营感情关系。`;
  } else {
    loveAnalysis = `感情方面，命局中${spouseWx}气（配偶星）力量偏弱，感情之路可能需要更多耐心。建议不要急于求成，缘分到来时自然水到渠成。可通过提升自身魅力和社交圈来增加遇到良缘的机会。`;
  }

  // ===== 组装完整评语 =====
  let comment = '';

  // 总论
  comment += `日主${bazi.dayMaster}${dayWx}${strengthLabel}，${wuxingTraits[dayWx]}。${strengthDesc}。`;

  // 五行格局
  if (missing.length > 0) {
    comment += `五行缺${missing.join('、')}，宜通过佩戴饰品、调整方位等方式适当补益。`;
  } else {
    comment += '五行俱全，先天格局较为均衡，发展潜力大。';
  }
  if (maxWeight >= totalWx * 0.3) {
    const wuxingAdvice = {
      '金': '宜以火炼之、水泄之，可多接触南方火旺之地',
      '木': '宜以金修之、火泄之，可多接触西方金旺之地',
      '水': '宜以土制之、木泄之，可多接触中央土旺之地',
      '火': '宜以水济之、土泄之，可多接触北方水旺之地',
      '土': '宜以木疏之、金泄之，可多接触东方木旺之地'
    };
    comment += `${maxWx}气偏旺，${wuxingAdvice[maxWx]}。`;
  }

  // 性格
  comment += '\n\n【性格特质】' + (ganPersonality[bazi.dayMaster] || '');

  // 事业
  comment += '\n\n【事业方向】' + careerAnalysis;

  // 感情
  comment += '\n\n【感情婚姻】' + loveAnalysis;

  // ===== 健康分析 =====
  const healthFocusMap = { '木': '肝胆', '火': '心脏、小肠', '土': '脾胃', '金': '肺部、大肠', '水': '肾脏、膀胱' };
  const healthFocus = healthFocusMap[dayWx] || '脾胃';
  const weakWxHealth = healthFocusMap[minWx] || '脾胃';
  comment += `\n\n【身体健康】日主属${dayWx}，${dayWx}主${healthFocus}，宜注意${healthFocus}方面的调养。`;
  if (minWx !== dayWx) {
    comment += `命局中${minWx}气偏弱，${weakWxHealth}方面也需适当关注。`;
  }
  comment += '建议保持规律作息和适度运动，饮食宜均衡清淡，顺应四时养生之道。';

  // ===== 喜用神分析 =====
  // 身旺喜克泄耗（官杀、食伤、财），身弱喜生扶（印、比劫）
  const xiYongMap = {
    '木': { strong: '金水', weak: '水木', strongDetail: '金能克木以制衡，水能泄木之秀气', weakDetail: '水能生木以扶身，木能助身以增力' },
    '火': { strong: '水土', weak: '木火', strongDetail: '水能克火以调候，土能泄火之燥气', weakDetail: '木能生火以扶身，火能助身以增力' },
    '土': { strong: '木金', weak: '火土', strongDetail: '木能克土以疏通，金能泄土之厚重', weakDetail: '火能生土以扶身，土能助身以增力' },
    '金': { strong: '火水', weak: '土金', strongDetail: '火能克金以锻炼，水能泄金之锐气', weakDetail: '土能生金以扶身，金能助身以增力' },
    '水': { strong: '土木', weak: '金水', strongDetail: '土能克水以制流，木能泄水之智慧', weakDetail: '金能生水以扶身，水能助身以增力' }
  };
  const xiYongInfo = xiYongMap[dayWx] || xiYongMap['木'];
  const xiYong = dayStrength >= 0.4 ? xiYongInfo.strong : xiYongInfo.weak;
  const xiYongDetail = dayStrength >= 0.4 ? xiYongInfo.strongDetail : xiYongInfo.weakDetail;
  comment += `\n\n【喜用神】根据八字分析，日主${bazi.dayMaster}属${dayWx}${strengthLabel}，喜用神为${xiYong}。${xiYongDetail}。可在日常生活中多接触喜用神五行元素以增强运势。`;

  // ===== 忌神分析 =====
  const jiShenMap = {
    '木': { strong: '木', weak: '金' },
    '火': { strong: '火', weak: '水' },
    '土': { strong: '土', weak: '木' },
    '金': { strong: '金', weak: '火' },
    '水': { strong: '水', weak: '土' }
  };
  const jiShenInfo = jiShenMap[dayWx] || jiShenMap['木'];
  const jiShen = dayStrength >= 0.4 ? jiShenInfo.strong : jiShenInfo.weak;
  comment += `\n\n【忌神】忌神为${jiShen}行过旺，宜适当化解。避免在忌神方位长期停留，可佩戴喜用神五行饰品调和，日常生活中减少与忌神五行相关的活动。`;

  // ===== 适合职业 =====
  const careerByWx = {
    '金': '法律、军警、金融、制造业、五金、汽车',
    '木': '文教、艺术、园林、出版、医药、服装',
    '水': '贸易、物流、IT、传媒、航运、旅游',
    '火': '科技、电子、餐饮、能源、演艺、美容',
    '土': '房产、建筑、农业、矿业、陶瓷、仓储'
  };
  const xiYongFirst = xiYong.charAt(0);
  const xiYongSecond = xiYong.length > 1 ? xiYong.charAt(1) : '';
  const career1 = careerByWx[xiYongFirst] || '综合管理';
  const career2 = xiYongSecond ? (careerByWx[xiYongSecond] || '') : '';
  comment += `\n\n【适合职业】根据喜用神五行属性，适合从事${career1}等领域的工作`;
  if (career2) {
    comment += `，也可考虑${career2}等方向`;
  }
  comment += '，能充分发挥命局优势，事业发展更为顺遂。';

  // ===== 发展方位 =====
  const directionByWx = { '金': '西方', '木': '东方', '水': '北方', '火': '南方', '土': '中部' };
  const dir1 = directionByWx[xiYongFirst] || '中部';
  const dir2 = xiYongSecond ? (directionByWx[xiYongSecond] || '') : '';
  comment += `\n\n【发展方位】喜用神方位为${dir1}`;
  if (dir2 && dir2 !== dir1) {
    comment += `和${dir2}`;
  }
  comment += '，在此方位发展事业或定居有助于提升整体运势，工作和生活中可多朝此方位活动。';

  // ===== 推荐城市 =====
  const citiesByWx = {
    '金': '重庆、兰州、昆明、西安、成都',
    '木': '杭州、南京、上海、苏州、福州',
    '水': '北京、天津、大连、哈尔滨、青岛',
    '火': '深圳、广州、长沙、南宁、厦门',
    '土': '武汉、郑州、洛阳、合肥、济南'
  };
  const cities1 = citiesByWx[xiYongFirst] || '北京、上海、广州';
  const cities2 = xiYongSecond ? (citiesByWx[xiYongSecond] || '') : '';
  comment += `\n\n【推荐城市】综合五行喜忌和方位分析，推荐${cities1}`;
  if (cities2 && cities2 !== cities1) {
    comment += `，以及${cities2}`;
  }
  comment += '等城市，这些城市的五行气场与命格较为契合，有利于事业发展和生活安定。';

  return comment;
}

// ===== 滴天髓阐微 · 十天干原文与阐释 =====
const DITIAN_SUI_DATA = {
  '甲': {
    title: '甲木',
    original: '甲木参天，脱胎要火。春不容金，秋不容土。火炽乘龙，水宕骑虎。地润天和，植立千古。',
    commentary: '甲木为阳木，如参天大树，巍然屹立。甲木生于春令，木气旺盛，金不能克；生于秋令，金旺木衰，土来培根则反为害。火旺时需辰土（龙）晦火养木；水旺时需寅木（虎）纳水生木。甲木得天地中和之气，方能根深叶茂，屹立千古。甲木之人性格刚正，有领导力，做事光明磊落，但过刚则易折，需柔以济之。'
  },
  '乙': {
    title: '乙木',
    original: '乙木虽柔，刲羊解牛。怀丁抱丙，跨凤乘猴。虚湿之地，骑马亦忧。藤萝系甲，可春可秋。',
    commentary: '乙木为阴木，如花草藤蔓，虽柔弱却有以柔克刚之力。乙木怀丙丁之火，可以制金（申酉）。但若生于虚湿之地，即使有午火（马）也难以温暖。乙木最喜攀附甲木（藤萝系甲），得甲木扶持则春秋皆宜。乙木之人性格柔韧，善于变通，有艺术天赋，适应力强，但需有所依附方能发挥最大潜力。'
  },
  '丙': {
    title: '丙火',
    original: '丙火猛烈，欺霜侮雪。能煅庚金，逢辛反怯。土众成慈，水猖显节。虎马犬乡，甲来焚灭。',
    commentary: '丙火为阳火，如太阳之火，光芒万丈，能驱霜化雪。丙火能锻炼庚金（阳金），但遇辛金（阴金）反而怯弱，因辛金为珠玉，丙辛相合化水。土多则火被晦，反成慈祥之象；水旺则丙火不屈，显其刚烈节操。在寅午戌（虎马犬）火局之地，若再见甲木生火，则火势太旺反成焚灭之灾。丙火之人热情奔放，光明磊落，有号召力。'
  },
  '丁': {
    title: '丁火',
    original: '丁火柔中，内性昭融。抱乙而孝，合壬而忠。旺而不烈，衰而不穷。如有嫡母，可秋可冬。',
    commentary: '丁火为阴火，如灯烛之火、炉中之火，柔和而内蕴光明。丁火与乙木（阴木）相生，如子孝母；丁壬相合化木，忠于所合。丁火旺时不会过于猛烈，衰时也不至于熄灭，有韧性。若有甲木（嫡母，阳木）生扶，则秋冬亦不惧。丁火之人温文尔雅，内心明亮，有洞察力，善于以柔克刚，文采出众。'
  },
  '戊': {
    title: '戊土',
    original: '戊土固重，既中且正。静翕动辟，万物司命。水润物生，火燥喜病。若在艮坤，怕冲宜静。',
    commentary: '戊土为阳土，如高山大地，厚重而居中正之位。戊土静则收敛（翕），动则开辟，为万物生长之根基。戊土喜水润泽以生万物，忌火过燥则土焦。戊土在艮（东北）坤（西南）之位最为安稳，怕冲动宜安静守成。戊土之人性格厚重诚信，有包容力，做事稳重踏实，重承诺守信用，是可靠的合作伙伴。'
  },
  '己': {
    title: '己土',
    original: '己土卑湿，中正蓄藏。不愁木盛，不畏水狂。火少火晦，金多金光。若要物旺，宜助宜帮。',
    commentary: '己土为阴土，如田园沃土，卑湿而能蓄藏万物。己土不怕木来克（木能疏土），不畏水来冲（湿土能纳水）。火少则己土晦暗，金多则己土生金而显光华。己土要使万物旺盛，需要其他五行的帮助和配合。己土之人性格温和包容，善于滋养他人，有耐心和毅力，适合从事教育、农业等培育性工作。'
  },
  '庚': {
    title: '庚金',
    original: '庚金带煞，刚健为最。得水而清，得火而锐。土润则生，土干则脆。能赢甲兄，输于乙妹。',
    commentary: '庚金为阳金，如刀剑斧钺，带有肃杀之气，刚健无比。庚金得水（壬癸）则清秀，得火（丙丁）锻炼则锋锐。土润泽则能生金，土干燥则金脆易折。庚金能克甲木（阳克阳），但遇乙木反被合住（乙庚合金）。庚金之人性格刚毅果断，有魄力和执行力，做事雷厉风行，适合军事、法律、管理等需要果断决策的领域。'
  },
  '辛': {
    title: '辛金',
    original: '辛金软弱，温润而清。畏土之叠，乐水之盈。能扶社稷，能救生灵。热则喜母，寒则喜丁。',
    commentary: '辛金为阴金，如珠玉宝石，温润而清秀。辛金怕土太多（土多埋金），喜水来洗涤（金白水清）。辛金虽小却能扶持社稷、救助生灵（辛金制乙木，乙木为草药）。天热时喜戊己土（母）来生扶，天寒时喜丁火来温暖。辛金之人性格精致细腻，有审美品味，聪慧灵巧，适合从事艺术、珠宝、金融等精细行业。'
  },
  '壬': {
    title: '壬水',
    original: '壬水通河，能泄金气。刚中之德，周流不滞。通根透癸，冲天奔地。化则有情，从则相济。',
    commentary: '壬水为阳水，如江河大海，浩荡奔流，能泄金之锐气。壬水有刚中之德，周流不息，永不停滞。壬水通根于亥，透出癸水，则水势浩大，冲天奔地。壬水与丁火相合化木，有情有义；壬水从强从弱，皆能与他柱相济。壬水之人智慧深邃，思维开阔，有大局观，善于谋略，适合从事科研、哲学、战略规划等需要深度思考的领域。'
  },
  '癸': {
    title: '癸水',
    original: '癸水至弱，达于天津。龙德而运，功化斯神。不愁火土，不论庚辛。合戊见火，化象斯真。',
    commentary: '癸水为阴水，如雨露甘霖，至柔至弱却能润泽万物，上达天河（银河古称天津）。癸水得辰龙之运，则功化神奇。癸水不怕火土来克（弱水能济火），不在乎庚辛来生（金多水浊）。癸水与戊土相合，见火则化火成功，变化莫测。癸水之人性格温润细腻，直觉力强，有灵性和悟性，善于感知他人情感，适合从事心理、艺术、宗教等需要灵性的领域。'
  }
};

// ===== 正确的今日天干地支计算（复用getDayPillar算法） =====
function getTodayGanzhi() {
  const now = new Date();
  // 使用北京时间（UTC+8）
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjTime = new Date(utc + 8 * 3600000);
  const year = bjTime.getFullYear();
  const month = bjTime.getMonth() + 1;
  const day = bjTime.getDate();
  // 复用getDayPillar算法：基准1900年1月1日为甲戌日
  const baseDate = new Date(1900, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  const diffDays = Math.floor((targetDate - baseDate) / 86400000);
  const ganIdx = (diffDays % 10 + 10) % 10;
  const zhiIdx = ((diffDays + 10) % 12 + 12) % 12;
  return {
    gan: TIANGAN[ganIdx],
    zhi: DIZHI[zhiIdx],
    ganIdx: ganIdx,
    zhiIdx: zhiIdx,
    ganzhi: TIANGAN[ganIdx] + DIZHI[zhiIdx],
    element: TIANGAN_ELEMENTS[ganIdx],
    animal: DIZHI_ANIMALS[zhiIdx],
    bjTime: bjTime
  };
}

// ===== 农历（阴历）计算 =====
// 农历数据表：1900-2100年，每年用一个16进制数表示
// 低12位表示每月大小（1=30天，0=29天），第13-16位表示闰月月份（0=无闰月）
// 最高4位表示闰月天数（0=29天，1=30天）
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a4d0,0x0d150,0x0f252,
  0x0d520
];

const LUNAR_MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_CN = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
];
const LUNAR_TIANGAN_CN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const LUNAR_DIZHI_CN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const LUNAR_SHENGXIAO = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

// 获取农历年份的总天数
function lunarYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  }
  return sum + lunarLeapDays(y);
}

// 获取农历年份闰月的天数（0表示无闰月）
function lunarLeapDays(y) {
  if (lunarLeapMonth(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

// 获取农历年份闰哪个月（0表示无闰月）
function lunarLeapMonth(y) {
  return LUNAR_INFO[y - 1900] & 0xf;
}

// 获取农历年份某月的天数
function lunarMonthDays(y, m) {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

// 公历转农历
function solarToLunar(year, month, day) {
  // 基准：1900年1月31日为农历正月初一
  const baseDate = new Date(1900, 0, 31);
  const targetDate = new Date(year, month - 1, day);
  let offset = Math.floor((targetDate - baseDate) / 86400000);

  // 计算农历年
  let lunarYear = 1900;
  let temp = 0;
  for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
    temp = lunarYearDays(lunarYear);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    lunarYear--;
  }

  // 计算农历月
  const leap = lunarLeapMonth(lunarYear);
  let isLeap = false;
  let lunarMonth = 1;
  let monthProcessed = false;

  for (let i = 1; i < 13; i++) {
    // 闰月处理
    if (leap > 0 && i === (leap + 1) && !isLeap) {
      --i;
      isLeap = true;
      temp = lunarLeapDays(lunarYear);
    } else {
      temp = lunarMonthDays(lunarYear, i);
    }

    // offset不够减去本月天数，说明目标日期在本月内
    if (offset < temp) {
      monthProcessed = true;
      if (!isLeap) {
        lunarMonth = i;
      } else {
        lunarMonth = i; // 闰月时，月份号与前一个月相同
      }
      break;
    }

    offset -= temp;

    // 解除闰月标记
    if (isLeap && i === (leap + 1)) {
      isLeap = false;
    }

    if (!isLeap) {
      lunarMonth = i;
    }
  }

  // 如果循环正常结束但没有break（极端情况），lunarMonth已在循环中更新
  if (!monthProcessed) {
    // offset >= temp 的情况，说明在最后一个月
    // lunarMonth 已经是最后处理的月份
  }

  const lunarDay = offset + 1;

  // 农历年份的天干地支
  const ganIdx = (lunarYear - 4) % 10;
  const zhiIdx = (lunarYear - 4) % 12;
  const yearGanzhi = LUNAR_TIANGAN_CN[ganIdx] + LUNAR_DIZHI_CN[zhiIdx];
  const yearShengxiao = LUNAR_SHENGXIAO[zhiIdx];

  return {
    lunarYear: lunarYear,
    lunarMonth: lunarMonth,
    lunarDay: lunarDay,
    isLeap: isLeap,
    yearGanzhi: yearGanzhi,
    yearShengxiao: yearShengxiao,
    monthCn: (isLeap ? '闰' : '') + LUNAR_MONTH_CN[lunarMonth - 1] + '月',
    dayCn: LUNAR_DAY_CN[lunarDay - 1],
    fullText: yearGanzhi + '年（' + yearShengxiao + '年）' + (isLeap ? '闰' : '') + LUNAR_MONTH_CN[lunarMonth - 1] + '月' + LUNAR_DAY_CN[lunarDay - 1]
  };
}

// 格式化日期（含阳历和阴历）
function formatDateWithLunar() {
  const now = new Date();
  // 使用北京时间
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjTime = new Date(utc + 8 * 3600000);
  const year = bjTime.getFullYear();
  const month = bjTime.getMonth() + 1;
  const day = bjTime.getDate();
  const weekDay = bjTime.getDay();
  const w = ['日', '一', '二', '三', '四', '五', '六'];

  const solarStr = `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日 星期${w[weekDay]}`;
  const lunar = solarToLunar(year, month, day);
  const lunarStr = `农历${lunar.fullText}`;

  return {
    solar: solarStr,
    lunar: lunarStr,
    lunarShort: `${lunar.monthCn}${lunar.dayCn}`,
    lunarData: lunar,
    combined: `${solarStr}（${lunarStr}）`
  };
}

// ===== 十神计算 =====
// 十神关系表：以日主天干为基准，判断其他天干的十神
// 五行生克关系：同我=比劫，我生=食伤，我克=财，克我=官杀，生我=印
// 阴阳同性=偏，阴阳异性=正
const TIANGAN_YINYANG = { '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴', '戊': '阳', '己': '阴', '庚': '阳', '辛': '阴', '壬': '阳', '癸': '阴' };
const WUXING_SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' }; // 我生
const WUXING_KE = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' }; // 我克
const WUXING_SHENG_WO = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' }; // 生我
const WUXING_KE_WO = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' }; // 克我

function getShiShen(dayMasterGan, otherGan) {
  if (dayMasterGan === otherGan) return '比肩';
  const dayWx = BAZI_WUXING_GAN[dayMasterGan];
  const otherWx = BAZI_WUXING_GAN[otherGan];
  const dayYY = TIANGAN_YINYANG[dayMasterGan];
  const otherYY = TIANGAN_YINYANG[otherGan];
  const sameYY = (dayYY === otherYY);

  if (dayWx === otherWx) {
    // 同我：比肩（同性）、劫财（异性）
    return sameYY ? '比肩' : '劫财';
  } else if (WUXING_SHENG[dayWx] === otherWx) {
    // 我生：食神（同性）、伤官（异性）
    return sameYY ? '食神' : '伤官';
  } else if (WUXING_KE[dayWx] === otherWx) {
    // 我克：偏财（同性）、正财（异性）
    return sameYY ? '偏财' : '正财';
  } else if (WUXING_KE_WO[dayWx] === otherWx) {
    // 克我：七杀/偏官（同性）、正官（异性）
    return sameYY ? '七杀' : '正官';
  } else if (WUXING_SHENG_WO[dayWx] === otherWx) {
    // 生我：偏印/枭神（同性）、正印（异性）
    return sameYY ? '偏印' : '正印';
  }
  return '';
}

// 地支十神：通过地支本气天干来判断
function getZhiShiShen(dayMasterGan, zhi) {
  const canggan = DIZHI_CANGGAN[zhi];
  if (!canggan || canggan.length === 0) return '';
  // 以本气（第一个藏干）为主
  return getShiShen(dayMasterGan, canggan[0]);
}

// ===== 地支藏干标注（本气/中气/余气） =====
function getCangganLabeled(zhi) {
  const ganList = DIZHI_CANGGAN[zhi] || [];
  const labels = ['本气', '中气', '余气'];
  return ganList.map((g, i) => ({
    gan: g,
    label: labels[i] || '余气',
    wuxing: BAZI_WUXING_GAN[g]
  }));
}

// ===== 六十甲子纳音 =====
const NAYIN_TABLE = [
  '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木',
  '路旁土', '路旁土', '剑锋金', '剑锋金', '山头火', '山头火',
  '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金',
  '杨柳木', '杨柳木', '泉中水', '泉中水', '屋上土', '屋上土',
  '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
  '砂石金', '砂石金', '山下火', '山下火', '平地木', '平地木',
  '壁上土', '壁上土', '金箔金', '金箔金', '覆灯火', '覆灯火',
  '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金',
  '桑柘木', '桑柘木', '大溪水', '大溪水', '沙中土', '沙中土',
  '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水'
];

// 获取干支的纳音
function getNayin(gan, zhi) {
  const ganIdx = BAZI_TIANGAN.indexOf(gan);
  const zhiIdx = BAZI_DIZHI.indexOf(zhi);
  if (ganIdx < 0 || zhiIdx < 0) return '';
  // 六十甲子序号 = (天干序号 * 12 + 地支序号) 但需要满足天干地支同奇同偶
  // 正确算法：干支序号 = (天干序号 % 10, 地支序号 % 12) 的最小公倍数循环
  // 简化：直接用干支组合的序号
  // 甲子=0, 乙丑=1, ..., 癸亥=59
  // 序号 = (ganIdx * 6 + zhiIdx / 2) 不对，用标准算法
  // 标准：六十甲子序号 = (ganIdx * 12 - zhiIdx * 10) % 60 的逆运算
  // 最简单：遍历六十甲子找到匹配的
  for (let i = 0; i < 60; i++) {
    if (i % 10 === ganIdx && i % 12 === zhiIdx) {
      return NAYIN_TABLE[i];
    }
  }
  return '';
}

// ===== 元男/元女判断 =====
// 命理学正确规则：
//   阳年（甲丙戊庚壬年）男命 / 阴年（乙丁己辛癸年）女命 → 元男（大运顺行）
//   阴年男命 / 阳年女命 → 元女（大运逆行）
// 注意：元男/元女并非指生理性别，而是命理学中的阴阳属性分类
function getYuanGender(yearGan, gender) {
  const isYangGan = TIANGAN_YINYANG[yearGan] === '阳';
  const isMale = gender === 'male';
  // 阳年男命或阴年女命 = 元男（顺行），阴年男命或阳年女命 = 元女（逆行）
  const isYuanMale = (isYangGan && isMale) || (!isYangGan && !isMale);
  return {
    label: isYuanMale ? '元男' : '元女',
    direction: isYuanMale ? 'forward' : 'backward'
  };
}

// ===== 精确节气计算（寿星天文历算法） =====
// 12个"节"的黄经度数（用于大运起运计算，只需要"节"不需要"气"）
// 小寒(285°)、立春(315°)、惊蛰(345°)、清明(15°)、立夏(45°)、芒种(75°)
// 小暑(105°)、立秋(135°)、白露(165°)、寒露(195°)、立冬(225°)、大雪(255°)
const JIE_ANGLES = [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255];
// 对应公历月份：1月小寒、2月立春、3月惊蛰、4月清明、5月立夏、6月芒种
//              7月小暑、8月立秋、9月白露、10月寒露、11月立冬、12月大雪

// 使用天文算法计算指定年份每月"节"的精确日期（公历日）
// 基于寿星万年历算法简化版
function getJieQiDate(year, month) {
  // 每月节气的平均日期（基于1900-2100年统计）
  // 格式：[月份] = [平均日, 修正系数]
  // 这里使用经验公式：节气日 ≈ C - Math.floor(Y/4) + Math.floor(Y/100) - Math.floor(Y/400) + 0.2422 * (Y - D)
  // 简化为查表+年份微调
  
  // 各月"节"的基准日期（20世纪基准值）和世纪修正值
  const jieBase20 = [6.11, 4.15, 5.63, 5.59, 6.318, 6.5, 7.928, 8.35, 8.44, 8.92, 8.08, 7.9];
  const jieBase21 = [5.4055, 3.87, 5.63, 4.81, 5.52, 5.678, 7.108, 7.5, 7.646, 8.318, 7.438, 7.18];
  
  const Y = year % 100;
  const century = Math.floor(year / 100);
  const base = (century === 20) ? jieBase21 : jieBase20;
  
  // 计算节气日
  let D = base[month - 1];
  let day = Math.floor(D + 0.2422 * (Y - 1) - Math.floor((Y - 1) / 4));
  
  // 特殊年份修正（已知的异常年份）
  if (month === 1) { // 小寒
    if (year === 2019) day = 5;
    if (year === 1982) day -= 1;
  } else if (month === 2) { // 立春
    if (year === 2026) day = 3;
  } else if (month === 3) { // 惊蛰
    if (year === 2012) day = 5;
  } else if (month === 4) { // 清明
    if (year === 2088) day = 4;
  } else if (month === 6) { // 芒种
    if (year === 1902) day = 6;
  } else if (month === 7) { // 小暑
    if (year === 2016) day = 7;
    if (year === 1925 || year === 2016) day = 7;
  } else if (month === 8) { // 立秋
    if (year === 2002) day = 8;
  } else if (month === 9) { // 白露
    if (year === 1927) day = 8;
  } else if (month === 10) { // 寒露
    if (year === 2088) day = 8;
  } else if (month === 11) { // 立冬
    if (year === 2089) day = 7;
  } else if (month === 12) { // 大雪
    if (year === 1954) day = 8;
  }
  
  return day;
}

// 获取出生日期前后最近的两个"节"的日期
// 返回 { prevJie: Date, nextJie: Date }
function getNearbyJie(year, month, day) {
  // 当月节气日
  const currentJieDay = getJieQiDate(year, month);
  const currentJieDate = new Date(year, month - 1, currentJieDay);
  const birthDate = new Date(year, month - 1, day);
  
  if (birthDate >= currentJieDate) {
    // 出生在当月节气之后，上一个节=当月节，下一个节=下月节
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    const nextJieDay = getJieQiDate(nextYear, nextMonth);
    return {
      prevJie: currentJieDate,
      nextJie: new Date(nextYear, nextMonth - 1, nextJieDay)
    };
  } else {
    // 出生在当月节气之前，上一个节=上月节，下一个节=当月节
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 1) { prevMonth = 12; prevYear--; }
    const prevJieDay = getJieQiDate(prevYear, prevMonth);
    return {
      prevJie: new Date(prevYear, prevMonth - 1, prevJieDay),
      nextJie: currentJieDate
    };
  }
}

// ===== 起运岁数计算 =====
// 根据出生日期和大运顺逆方向，计算起运岁数
// direction: 'forward'(顺排) 或 'backward'(逆排)
// 返回 { qiyunAge: 起运岁数(整数), qiyunMonths: 余数月份(0/4/8), qiyunDesc: 描述文本 }
function calculateQiYunAge(year, month, day, direction) {
  const birthDate = new Date(year, month - 1, day);
  const { prevJie, nextJie } = getNearbyJie(year, month, day);
  
  let diffDays;
  let targetJieStr;
  
  if (direction === 'forward') {
    // 顺排：从出生日顺数至下一个节气
    diffDays = Math.round((nextJie - birthDate) / 86400000);
    const jieMonth = nextJie.getMonth() + 1;
    const jieNames = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪'];
    targetJieStr = `${jieNames[jieMonth - 1]}(${nextJie.getFullYear()}年${jieMonth}月${nextJie.getDate()}日)`;
  } else {
    // 逆排：从出生日逆数至上一个节气
    diffDays = Math.round((birthDate - prevJie) / 86400000);
    const jieMonth = prevJie.getMonth() + 1;
    const jieNames = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪'];
    targetJieStr = `${jieNames[jieMonth - 1]}(${prevJie.getFullYear()}年${jieMonth}月${prevJie.getDate()}日)`;
  }
  
  // 三天折一岁，余1天=4个月，余2天=8个月
  const qiyunAge = Math.floor(diffDays / 3);
  const remainDays = diffDays % 3;
  const qiyunMonths = remainDays * 4; // 0, 4, 8
  
  // 描述文本
  const dirText = direction === 'forward' ? '顺数至' : '逆数至';
  let ageDesc = `${qiyunAge}岁`;
  if (qiyunMonths > 0) ageDesc += `${qiyunMonths}个月`;
  const desc = `出生日${dirText}${targetJieStr}，共${diffDays}天，三天折一岁，${ageDesc}起运`;
  
  return {
    qiyunAge: qiyunAge,
    qiyunMonths: qiyunMonths,
    diffDays: diffDays,
    desc: desc
  };
}

// ===== 大运计算 =====
// 大运起运：从月柱开始，顺行或逆行排列
// qiyunAge: 起运岁数（由calculateQiYunAge计算得出）
function calculateDaYun(monthGan, monthZhi, direction, count, qiyunAge) {
  const result = [];
  const ganStart = BAZI_TIANGAN.indexOf(monthGan);
  const zhiStart = BAZI_DIZHI.indexOf(monthZhi);
  // 如果未传入起运岁数，默认使用简化值
  const startAge = (typeof qiyunAge === 'number') ? qiyunAge : 10;

  for (let i = 1; i <= count; i++) {
    let ganIdx, zhiIdx;
    if (direction === 'forward') {
      ganIdx = (ganStart + i) % 10;
      zhiIdx = (zhiStart + i) % 12;
    } else {
      ganIdx = (ganStart - i % 10 + 10) % 10;
      zhiIdx = (zhiStart - i % 12 + 12) % 12;
    }
    const gan = BAZI_TIANGAN[ganIdx];
    const zhi = BAZI_DIZHI[zhiIdx];
    result.push({
      gan: gan,
      zhi: zhi,
      ganzhi: gan + zhi,
      nayin: getNayin(gan, zhi),
      startAge: startAge + (i - 1) * 10 // 第一步大运从起运岁数开始，每步10年
    });
  }
  return result;
}

// ===== 流年计算 =====
// 获取指定年份的天干地支
function getLiuNian(startYear, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const year = startYear + i;
    const ganIdx = (year - 4) % 10;
    const zhiIdx = (year - 4) % 12;
    const gan = BAZI_TIANGAN[ganIdx];
    const zhi = BAZI_DIZHI[zhiIdx];
    result.push({
      year: year,
      gan: gan,
      zhi: zhi,
      ganzhi: gan + zhi,
      nayin: getNayin(gan, zhi),
      shengxiao: DIZHI_ANIMALS[zhiIdx]
    });
  }
  return result;
}

// ===== 导出到全局作用域，确保 script-part2.js 可访问 =====
window.initShichenPicker = initShichenPicker;
window.initBirthdayPicker = initBirthdayPicker;
window.initParticles = initParticles;
window.initGrids = initGrids;
window.initTrueSolarToggle = initTrueSolarToggle;
window.animateCountUp = animateCountUp;
window.navigateTo = navigateTo;
window.formatDateWithLunar = formatDateWithLunar;
window.getTodayGanzhi = getTodayGanzhi;
window.calculateBazi = calculateBazi;
window.generateBaziComment = generateBaziComment;
window.getShiShen = getShiShen;
window.getZhiShiShen = getZhiShiShen;
window.getCangganLabeled = getCangganLabeled;
window.getNayin = getNayin;
window.getYuanGender = getYuanGender;
window.getJieQiDate = getJieQiDate;
window.getNearbyJie = getNearbyJie;
window.calculateQiYunAge = calculateQiYunAge;
window.calculateDaYun = calculateDaYun;
window.getLiuNian = getLiuNian;
window.showErrorToast = showErrorToast;
window.getFortuneLevel = getFortuneLevel;
window.getScoreCategory = getScoreCategory;
window.formatDate = formatDate;
window.getTimeOfDay = getTimeOfDay;
window.pickRandom = pickRandom;
window.pickMultipleRandom = pickMultipleRandom;
window.seedRandom = seedRandom;
window.getTodaySeed = getTodaySeed;
window.stopCamera = stopCamera;
window.getShichenFromHour = getShichenFromHour;
window.getDaysInMonth = getDaysInMonth;
window.handlePalmUpload = handlePalmUpload;
window.uploadPalmForAnalysis = uploadPalmForAnalysis;
window.solarToLunar = solarToLunar;
