// ===== 掌纹算命 · 今日运势 - 主逻辑 =====

// ===== API配置 =====
function getApiBase() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000/api/v1';
  } else {
    return '/api/v1';
  }
}

const API_BASE = getApiBase();

// API Key（部署时通过服务端注入，开发时可留空）
const API_KEY = window.__PALM_CONFIG__?.apiKey || '';

// 带认证的 fetch 封装
function authFetch(url, options = {}) {
    if (API_KEY) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
            options.headers.set('X-API-Key', API_KEY);
        } else {
            options.headers['X-API-Key'] = API_KEY;
        }
    }
    return fetch(url, options);
}

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

const DIRECTIONS = ['正东', '东南', '正南', '西南', '正西', '西北', '正北', '东北'];
const LUCKY_TIMES = ['子时(23-1点)', '丑时(1-3点)', '寅时(3-5点)', '卯时(5-7点)', '辰时(7-9点)', '巳时(9-11点)', '午时(11-13点)', '未时(13-15点)', '申时(15-17点)', '酉时(17-19点)', '戌时(19-21点)', '亥时(21-23点)'];

// ===== 传统手相十大维度数据 =====
const TRAD_PALM_SECTIONS = [
  { id: 'palm-type', title: '一、掌型总论', subtitle: '金木水火土五行掌 + 掌色气血分析', icon: '🖐️',
    readings: {
      high: [
        { type: '金形掌', desc: '掌形方正，指节分明，骨骼坚实。金形掌主人性格刚毅果断，做事有条理，适合从事管理、法律等需要严谨思维的行业。掌色红润有光泽，气血充盈，精力旺盛。' },
        { type: '木形掌', desc: '掌形修长，手指纤细，关节突出。木形掌主人聪慧好学，富有创造力和艺术天赋，适合文学、艺术、教育等领域。掌色白皙透粉，气血调和，思维敏捷。' },
      ],
      mid: [
        { type: '水形掌', desc: '掌形圆润柔软，手指短而丰满。水形掌主人性格温和圆融，善于交际，适应力强，适合商业、外交等需要人际沟通的工作。掌色偏白，气血平稳。' },
        { type: '火形掌', desc: '掌形上宽下窄，指尖略尖。火形掌主人热情奔放，行动力强，富有冒险精神，适合创业、销售等充满挑战的领域。掌色偏红，气血旺盛。' },
      ],
      low: [
        { type: '土形掌', desc: '掌形厚实宽大，手指粗短有力。土形掌主人踏实稳重，耐力持久，适合农业、建筑、制造等需要耐心和毅力的行业。掌色偏黄，气血沉稳，需注意脾胃调养。' },
      ]
    }
  },
  { id: 'life-line', title: '二、生命线详解', subtitle: '健康体质 + 生命阶段运势 + 特殊标记', icon: '💚',
    readings: {
      high: ['生命线深长且清晰，弧度优美，从食指与拇指之间起始，环绕金星丘延伸至手腕。此线象征体魄强健、精力充沛，一生少有大病大灾。', '生命线宽阔有力，色泽红润，显示出极强的生命能量。起始处与智慧线分开，说明性格独立果敢。'],
      mid: ['生命线长度适中，走势平稳，显示健康状况总体良好。线条中段略有细纹交叉，提示中年期需注意劳逸结合。', '生命线清晰但弧度较小，紧贴拇指根部。此相显示生活圈子相对稳定，不喜大起大落。'],
      low: ['生命线较短或有链状纹，提示体质偏弱，需格外注意健康管理。建议加强锻炼，注意饮食调理。']
    }
  },
  { id: 'wisdom-line', title: '三、智慧线详解', subtitle: '思维才智 + 事业适配 + 学业决策力', icon: '💜',
    readings: {
      high: ['智慧线深长有力，横贯掌心，末端微微上扬。此线主人思维敏捷、逻辑清晰，具有出色的分析能力和决策力。', '智慧线笔直延伸至掌缘，且与生命线起始处分开。此相显示思维独立、判断力强。'],
      mid: ['智慧线长度适中，走势平稳，末端略向下弯。此线主人兼具理性与感性，思维灵活但不失稳重。', '智慧线清晰但有分叉，显示兴趣广泛，多才多艺。'],
      low: ['智慧线较短或有断续，提示思维容易分散，做决策时可能犹豫不决。建议培养专注力。']
    }
  },
  { id: 'emotion-line', title: '四、感情线详解', subtitle: '情感模式 + 婚恋运势 + 人际关系', icon: '❤️',
    readings: {
      high: ['感情线深长饱满，从小指下方延伸至食指或中指之间。此线主人感情丰富、重情重义，婚恋运势极佳。', '感情线清晰且呈优美弧线，色泽红润。此相显示情感表达能力强，善于经营感情关系。'],
      mid: ['感情线长度适中，走势平稳。此线主人感情内敛含蓄，不善于直接表达情感，但内心深处情感丰富。', '感情线有细小分支，显示感情经历较为丰富。每段经历都是成长的养分。'],
      low: ['感情线较短或有链状纹，提示感情方面可能经历波折。建议学会表达自己的情感需求。']
    }
  },
  { id: 'fate-line', title: '五、命运线与事业运', subtitle: '发展轨迹 + 事业转折', icon: '⭐',
    readings: {
      high: ['命运线从掌底直达中指根部，深长有力，一气呵成。此线主人事业心极强，目标明确，执行力出众。', '命运线清晰笔直，无明显中断。此相显示事业道路顺畅，少有大的波折。'],
      mid: ['命运线中段出现分支或转折，预示事业发展中会有方向调整。35岁前后可能经历一次重要的职业转型。', '命运线从掌心中部开始，显示事业起步较晚但后劲十足。大器晚成型。'],
      low: ['命运线较浅或不太明显，提示事业发展需要更多的主动规划和努力。命运掌握在自己手中。']
    }
  },
  { id: 'auxiliary-lines', title: '六、辅助线与特殊纹路', subtitle: '婚姻线 + 吉凶纹路', icon: '✨',
    readings: {
      high: ['婚姻线清晰且只有一条主线，深长有力，预示婚姻美满、感情专一。太阳线明显，暗示在艺术、创作或公众领域有出色表现。', '婚姻线位置适中，长度恰好，显示婚姻时机把握得当。手掌上有明显的直觉线。'],
      mid: ['婚姻线有两到三条，其中一条较为突出。此相显示感情经历较为丰富，但最终会有一段稳定的婚姻。', '辅助线纹路较为丰富，显示生活经历多彩。'],
      low: ['婚姻线较为模糊或有多条细线，提示婚恋方面需要更多的耐心和智慧。']
    }
  },
  { id: 'eight-mounds', title: '七、八丘论断', subtitle: '木星/土星/太阳/水星/金星/月丘', icon: '🌍',
    readings: {
      high: ['木星丘饱满隆起，显示领导力强。太阳丘丰隆有光泽，预示艺术天赋出众。', '水星丘丰满，显示口才出众、商业头脑敏锐。金星丘饱满红润，代表精力充沛。'],
      mid: ['各丘位发育均衡，无明显凹陷或过度隆起。此相显示性格平衡，各方面能力均衡发展。', '金星丘丰满而月丘平坦，显示务实稳重，注重现实利益。'],
      low: ['部分丘位较为平坦，提示对应方面的能量需要加强。可以通过后天的学习和锻炼来弥补。']
    }
  },
  { id: 'five-elements', title: '八、五行综合论断', subtitle: '金木水火土综合分析', icon: '☯️',
    readings: {
      high: ['综合掌型、掌色、纹路走势分析，你的五行属性以木火为主，辅以金气。木主仁，火主礼，金主义。五行相生相克之中，木生火旺，事业运和人际运极佳。', '五行分析显示金水旺盛，金主决断，水主智慧。思维敏捷、判断力强。'],
      mid: ['五行分布较为均衡，略偏土金。土主信，金主义，为人诚实守信、重承诺。', '五行以水木为主，水主智，木主仁。性格温和聪慧。'],
      low: ['五行中某一属性偏弱，整体能量流通不够顺畅。建议通过调整生活习惯和环境来平衡五行。']
    }
  },
  { id: 'yearly-fortune', title: '九、流年运势概览', subtitle: '青年/壮年/中年/晚年四阶段', icon: '📅',
    readings: {
      high: ['【青年期】学业顺遂，事业起步顺利。\n【壮年期】事业进入快速上升期，财运亨通。\n【中年期】事业稳定，收获丰厚。\n【晚年期】福寿双全，晚年安逸。'],
      mid: ['【青年期】学业中等偏上，需要付出更多努力。\n【壮年期】事业稳步发展，38岁前后有重要机会。\n【中年期】生活趋于稳定。\n【晚年期】生活安定。'],
      low: ['【青年期】起步较慢，但这是积累经验的重要阶段。\n【壮年期】35岁前后迎来转机。\n【中年期】大器晚成。\n【晚年期】苦尽甘来。']
    }
  },
  { id: 'summary', title: '十、综合评语与建议', subtitle: '全面总结与人生指引', icon: '📜',
    readings: {
      high: ['综合你的掌纹特征分析，你是一个天赋出众、运势极佳的人。\n\n建议：珍惜自身的天赋和好运，保持谦逊和感恩的心态。'],
      mid: ['综合掌纹分析，你的各项指标均衡发展，属于稳健型。\n\n建议：找到自己最擅长的领域，集中精力深耕。'],
      low: ['掌纹分析显示你目前正处于蓄力阶段。\n\n建议：不要被暂时的困难所困扰，命运始终掌握在自己手中。']
    }
  }
];

// 掌纹线条数据（融合模式后备数据）
const PALM_LINES_DATA = [
  { name: '生命线', icon: '💚', descriptions: ['生命线深长且清晰，弧度优美环绕金星丘，显示体魄强健、精力充沛。', '生命线平稳延伸至手腕，纹路均匀无断裂，预示稳定的健康状态。', '生命线呈现优美的半圆弧度，金星丘饱满丰隆。', '生命线末端分叉延伸，主线深长有力。', '生命线起始处与智慧线分开，显示性格独立果敢。', '生命线中段出现上升支线，预示重大突破。', '生命线色泽红润有光泽，气血充盈之相。', '生命线宽阔有力，纹理清晰可辨。'] },
  { name: '智慧线', icon: '💜', descriptions: ['智慧线笔直有力横贯掌心，末端微微上扬，主思维敏捷、逻辑清晰。', '智慧线微微下弯至月丘方向，创造力与想象力旺盛。', '智慧线深且长，延伸至掌缘，显示出出众的分析能力。', '智慧线呈现双分支，主线代表理性思维，支线代表感性直觉。', '智慧线起始处与生命线分开，显示思维独立。', '智慧线纹路清晰且无岛纹干扰，记忆力与专注力处于高峰。', '智慧线末端出现星纹，预示在智力领域将有突出表现。', '智慧线与感情线之间间距适中，显示理性与感性平衡。'] },
  { name: '感情线', icon: '❤️', descriptions: ['感情线温润饱满，从小指下方延伸至食指根部，情感丰富细腻。', '感情线延伸至食指与中指之间，对爱情充满理想主义。', '感情线平直延伸，纹路清晰有力，处事理性冷静。', '感情线呈现优美弧线上扬，显示对感情积极主动。', '感情线末端分叉，主线与支线均清晰。', '感情线深长且色泽红润，情感表达能力强。', '感情线起始处有细小上升支线，预示近期感情方面将有喜事。', '感情线与智慧线平行延伸，显示情感与理智并重。'] },
  { name: '事业线', icon: '⭐', descriptions: ['事业线从掌底直达中指根部，深长有力一气呵成。', '事业线清晰可见，走势平稳上升，职业发展稳步向好。', '事业线中段出现上升分支，预示着新的发展机遇。', '事业线起始于月丘，善于借助他人力量成就事业。', '事业线起始于生命线，显示事业成功源于个人不懈努力。', '事业线笔直无中断，预示职业道路顺畅。', '事业线末端出现星纹或三角纹，为事业大成之相。', '事业线与太阳线并行，显示事业发展伴随名望提升。'] },
  { name: '太阳线', icon: '🌟', descriptions: ['太阳线清晰可见，从无名指根部向下延伸。此线主才华与名望。', '太阳线深长有力，预示在艺术、创作或公众领域有出色表现。', '太阳线起始于智慧线，显示凭借智慧和才学获得成功。', '太阳线末端出现星纹，为大吉之相。', '太阳线虽短但清晰，显示在特定领域有独特天赋。', '太阳线与事业线并行延伸，事业发展伴随声望提升。'] },
  { name: '婚姻线', icon: '💍', descriptions: ['婚姻线清晰且只有一条主线，深长有力，预示婚姻美满。', '婚姻线位置适中，长度恰好，显示婚姻时机把握得当。', '婚姻线末端微微上扬，显示对婚姻充满积极期待。', '婚姻线平直延伸，纹路清晰，预示感情关系稳定和谐。', '婚姻线起始处有细小支线上升，预示近期感情方面将有好消息。', '婚姻线深刻有力，显示对感情认真负责。'] }
];

// 运势文案
const FORTUNE_TEXTS = {
  love: {
    high: ['今日桃花运极佳，单身者有望遇到心仪对象，已有伴侣者感情急剧升温。', '浪漫的金星能量笼罩着你，无论是表白还是约会，今天都是绝佳时机。', '感情方面春风得意，你的魅力指数飙升，异性缘特别好。'],
    mid: ['感情运势平稳，适合与伴侣进行深入交流，增进彼此了解。', '今日适合回顾感情中的点点滴滴，感恩身边的温暖陪伴。', '爱情方面中规中矩，保持真诚和耐心，美好的缘分终将到来。'],
    low: ['今日感情方面需多一些包容和理解，避免因小事产生争执。', '感情运势略有波折，建议给彼此一些空间。', '桃花运暂时低迷，静下心来提升自己更重要。']
  },
  career: {
    high: ['事业运势大吉，你的才华将得到充分展现，有望获得上级赏识。', '工作中灵感不断，效率极高。适合推进重要项目。', '职场上贵人相助，困难迎刃而解。今天是大展宏图的好日子。'],
    mid: ['事业运势稳定，按部就班地完成工作任务，稳扎稳打最重要。', '工作中注意细节，避免因粗心导致失误。', '职场上保持低调，默默积累实力。'],
    low: ['今日工作中可能遇到一些挑战，保持冷静思考。', '事业方面暂时处于调整期，利用这段时间学习充电。', '职场上可能有些许不顺，换个角度思考问题。']
  },
  wealth: {
    high: ['财运亨通，今日适合进行投资理财。有意外收获的可能。', '金钱能量充沛，可能收到好消息或意外之财。', '偏财运旺盛，今天参与抽奖或投资可能有惊喜。'],
    mid: ['财运平稳，日常开支合理控制即可，不宜进行大额投资。', '正财运尚可，努力工作获得的收入是最踏实的财富。', '今日在金钱方面量入为出，理性消费才是王道。'],
    low: ['今日财运需谨慎，避免冲动消费或借贷。', '破财风险略高，不建议进行任何投资活动。', '财运暂时低迷，但这也是审视消费习惯的好时机。']
  },
  health: {
    high: ['身体状态极佳，精力旺盛。适合进行户外运动。', '健康运势上佳，免疫力处于高峰。', '身心状态俱佳，精神饱满、思维清晰。'],
    mid: ['健康状况总体良好，注意作息规律。', '身体无大碍，但需注意饮食均衡。', '健康运势中等，适度运动有助于保持良好状态。'],
    low: ['今日需特别注意身体健康，避免过度劳累。', '身体可能出现小不适，注意保暖和饮食卫生。', '健康方面需要关注，建议减少高强度活动。']
  }
};

const ENCOURAGEMENTS = [
  '每一天都是新的开始，你的潜力远比你想象的要大。相信自己，勇敢前行！✨',
  '命运掌握在自己手中，掌纹只是指引方向的星图。用你的行动去创造精彩人生！🌟',
  '无论今日运势如何，你都是宇宙中独一无二的存在。保持微笑，好运自然来！😊',
  '宇宙的能量在你手心流转，星辰为你指引方向。今天的你，值得被温柔以待。💪',
  '所有的遇见都是久别重逢，所有的努力都会得到回报。美好即将发生！🌈',
];

const TRAD_ENCOURAGEMENTS = [
  '掌纹是天赋的密码，但人生的精彩由你亲手书写。愿你读懂自己，活出最好的模样！🖐️✨',
  '手相只是命运的参考，真正的力量来自你的内心。相信自己，一切皆有可能！💫',
  '每一条掌纹都记录着独特的故事，你的故事才刚刚开始，未来无限精彩！🌟',
  '古人云：相由心生，命由己造。保持善念，好运自然相随！☯️',
  '掌中乾坤大，心中日月长。愿你掌握命运，成就非凡人生！🏔️',
];

// ===== 星座守护星解读数据 =====
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

// ===== 生肖流年运势数据 =====
const ZODIAC_FORTUNE_DATA = [
  { name: '鼠', element: '水', ally: '牛、龙、猴', conflict: '马、羊、兔', fortune: '属鼠之人今日水元素活跃，智慧与机敏并存。贵人方位在正北。' },
  { name: '牛', element: '土', ally: '鼠、蛇、鸡', conflict: '马、羊、狗', fortune: '属牛之人今日土元素稳固，踏实与坚韧是你的力量源泉。' },
  { name: '虎', element: '木', ally: '马、狗、猪', conflict: '猴、蛇', fortune: '属虎之人今日木元素生发，勇气与魄力俱佳。' },
  { name: '兔', element: '木', ally: '羊、狗、猪', conflict: '鸡、龙、鼠', fortune: '属兔之人今日木元素柔和，温雅与智慧并重。' },
  { name: '龙', element: '土', ally: '鼠、猴、鸡', conflict: '狗、兔、龙', fortune: '属龙之人今日土元素厚重，气势与格局非凡。' },
  { name: '蛇', element: '火', ally: '牛、鸡', conflict: '猪、虎', fortune: '属蛇之人今日火元素灵动，洞察力与直觉力极强。' },
  { name: '马', element: '火', ally: '虎、羊、狗', conflict: '鼠、牛', fortune: '属马之人今日火元素旺盛，热情与活力四射。' },
  { name: '羊', element: '土', ally: '兔、马、猪', conflict: '牛、鼠、狗', fortune: '属羊之人今日土元素温润，善良与包容是你的魅力。' },
  { name: '猴', element: '金', ally: '鼠、龙', conflict: '虎、猪', fortune: '属猴之人今日金元素锐利，聪明与变通能力出众。' },
  { name: '鸡', element: '金', ally: '牛、龙、蛇', conflict: '兔、狗', fortune: '属鸡之人今日金元素明亮，勤勉与精准是你的优势。' },
  { name: '狗', element: '土', ally: '虎、兔、马', conflict: '龙、牛、羊', fortune: '属狗之人今日土元素忠厚，忠诚与正义感强烈。' },
  { name: '猪', element: '水', ally: '虎、兔、羊', conflict: '蛇、猴', fortune: '属猪之人今日水元素丰沛，福气与好运相伴。' }
];

// ===== 五行能量解读数据 =====
const FIVE_ELEMENTS_DATA = {
  metal: { name: '金', color: '#FFD700', icon: '🪙', trait: '义', desc: '金元素代表收敛、坚毅与果断。金旺之人性格刚正不阿，做事有原则有底线。' },
  wood: { name: '木', color: '#2ECC71', icon: '🌿', trait: '仁', desc: '木元素代表生长、仁慈与创造。木旺之人性格温和善良，富有创造力和同理心。' },
  water: { name: '水', color: '#4FC3F7', icon: '💧', trait: '智', desc: '水元素代表智慧、灵活与深邃。水旺之人思维敏捷、洞察力强。' },
  fire: { name: '火', color: '#FF4081', icon: '🔥', trait: '礼', desc: '火元素代表热情、光明与行动。火旺之人性格热情奔放，行动力强。' },
  earth: { name: '土', color: '#FF9800', icon: '🏔️', trait: '信', desc: '土元素代表稳重、诚信与包容。土旺之人性格踏实可靠，重承诺守信用。' }
};

// ===== 天干地支 =====
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const TIANGAN_ELEMENTS = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const DIZHI_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const GANZHI_READINGS = [
  '天干地支相生相合，今日气场和谐顺畅。万事宜进不宜退。',
  '今日干支五行流通，阴阳调和。适合处理重要事务。',
  '天干主外、地支主内，今日内外兼修为上策。',
  '今日干支能量偏向阳刚，适合果断决策、开拓进取。',
  '今日干支能量偏向阴柔，适合以柔克刚、以退为进。',
  '干支相冲之日，变化与机遇并存。保持灵活应变的心态。',
  '今日天干透出财星，财运方面有利好消息。',
  '今日地支暗藏贵人，人际关系中可能出现重要的帮助者。'
];

// ===== 幸运物品和花卉 =====
const LUCKY_ITEMS = [
  { name: '紫水晶', icon: '💎', desc: '增强直觉力与灵性' }, { name: '红绳手链', icon: '🧶', desc: '辟邪转运、招桃花' },
  { name: '翡翠挂件', icon: '🟢', desc: '养身护体、招财进宝' }, { name: '檀木手串', icon: '📿', desc: '静心安神、驱邪避灾' },
  { name: '金色钢笔', icon: '🖊️', desc: '提升事业运与文昌运' }, { name: '银质饰品', icon: '💫', desc: '净化能量场、增强气场' },
  { name: '琥珀吊坠', icon: '🟡', desc: '安神定志、招财纳福' }, { name: '黑曜石', icon: '⚫', desc: '强力辟邪、吸收负能量' },
];
const LUCKY_FLOWERS = [
  { name: '薰衣草', icon: '💜', desc: '安神静心' }, { name: '向日葵', icon: '🌻', desc: '积极向上' },
  { name: '百合花', icon: '🌸', desc: '百年好合' }, { name: '桃花', icon: '🌺', desc: '招桃花运' },
  { name: '兰花', icon: '🌿', desc: '高雅脱俗' }, { name: '牡丹', icon: '🌹', desc: '富贵吉祥' },
  { name: '莲花', icon: '🪷', desc: '清净自在' }, { name: '梅花', icon: '🌼', desc: '坚韧不拔' }
];

const ADVICES = {
  morning: [
    { icon: 'fa-sun', text: '清晨是最佳的冥想时间，花5分钟静心呼吸，为一天注入正能量。' },
    { icon: 'fa-mug-hot', text: '来一杯温热的饮品，让身体慢慢苏醒。晨起一杯温水，唤醒脾胃。' },
    { icon: 'fa-spa', text: '晨起面向东方深呼吸三次，吸纳朝阳之气，有助于提升精气神。' },
    { icon: 'fa-leaf', text: '早餐宜温热、易消化，养好脾胃是健康长寿的基础。' },
  ],
  afternoon: [
    { icon: 'fa-walking', text: '午后适合短暂散步，让大脑得到休息，有助于恢复精力。' },
    { icon: 'fa-apple-whole', text: '补充一些水果和坚果，为身体提供持续的能量。' },
    { icon: 'fa-wind', text: '午后阳气渐收，适合处理需要细心和耐心的工作。' },
  ],
  evening: [
    { icon: 'fa-book', text: '晚间适合阅读和反思，记录今天的收获与感悟。' },
    { icon: 'fa-moon', text: '尽量在11点前入睡，充足的睡眠是最好的美容养生方式。' },
    { icon: 'fa-hot-tub-person', text: '睡前用温水泡脚15分钟，可以促进血液循环、安神助眠。' },
  ],
  general: [
    { icon: 'fa-heart', text: '今天试着对一个陌生人微笑，善意会带来意想不到的回报。' },
    { icon: 'fa-hands-holding-heart', text: '感恩是最高频的能量振动，列出三件值得感恩的事情。' },
    { icon: 'fa-palette', text: '生活需要仪式感，为自己准备一顿精致的餐食。' },
    { icon: 'fa-music', text: '听一首喜欢的音乐，让旋律带走烦恼。' },
    { icon: 'fa-om', text: '找一个安静的角落，闭目冥想5分钟，净化负面能量。' },
    { icon: 'fa-hand-holding-droplet', text: '今日宜多饮水，水为生命之源。' },
    { icon: 'fa-seedling', text: '接触大自然是最好的能量补充方式。' },
  ]
};

const YI_DATA = ['出行', '约会', '签约', '投资', '学习', '运动', '聚会', '购物', '表白', '面试', '旅行', '创作', '社交', '读书', '冥想'];
const JI_DATA = ['争吵', '熬夜', '赌博', '冒险', '借贷', '暴饮暴食', '冲动消费', '过度劳累', '与人争执', '做重大决定', '独处太久', '忽视健康'];
const KEYWORDS_POSITIVE = ['贵人相助', '心想事成', '好运连连', '步步高升', '财源广进', '桃花朵朵', '灵感涌现', '否极泰来', '一帆风顺', '万事如意'];
const KEYWORDS_NEUTRAL = ['稳中求进', '厚积薄发', '沉淀自我', '养精蓄锐', '韬光养晦', '以退为进', '静待花开', '随遇而安', '顺其自然', '蓄势待发'];
const KEYWORDS_CAUTION = ['谨慎行事', '量力而行', '三思后行', '避免冲动', '注意休息', '低调行事', '守正待时', '以静制动', '防微杜渐'];

// ===== 全局状态 =====
let selectedZodiac = null;
let selectedConstellation = null;
let cameraStream = null;
let capturedImageBlob = null;
let palmAnalysisResult = null;
let identifyResult = null;

// ===== 工具函数 =====
function seedRandom(seed) { let s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function getTodaySeed() { const now = new Date(); return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate(); }
function getFortuneLevel(score) {
  if (score >= 90) return { text: '大吉大利', color: '#FFD700', emoji: '🎊' };
  if (score >= 80) return { text: '吉星高照', color: '#FF9800', emoji: '✨' };
  if (score >= 70) return { text: '诸事顺遂', color: '#8BC34A', emoji: '🍀' };
  if (score >= 60) return { text: '平稳安顺', color: '#4FC3F7', emoji: '☘️' };
  if (score >= 50) return { text: '小有波折', color: '#CE93D8', emoji: '🌤️' };
  return { text: '韬光养晦', color: '#90A4AE', emoji: '🌙' };
}
function getScoreCategory(score) { if (score >= 70) return 'high'; if (score >= 40) return 'mid'; return 'low'; }
function formatDate() { const now = new Date(); const w = ['日', '一', '二', '三', '四', '五', '六']; return `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 星期${w[now.getDay()]}`; }
function getTimeOfDay() { const h = new Date().getHours(); if (h < 12) return 'morning'; if (h < 18) return 'afternoon'; return 'evening'; }
function pickRandom(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function pickMultipleRandom(arr, count, rng) { return [...arr].sort(() => rng() - 0.5).slice(0, count); }

// ===== 粒子背景 =====
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 12000);
    for (let i = 0; i < count; i++) {
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.8 + 0.3, speedX: (Math.random() - 0.5) * 0.3, speedY: (Math.random() - 0.5) * 0.3, alpha: Math.random() * 0.6 + 0.2, pulse: Math.random() * Math.PI * 2 });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.speedX; p.y += p.speedY; p.pulse += 0.02;
      if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      const alpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 132, 255, ${alpha})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize(); createParticles(); draw();
  window.addEventListener('resize', () => { resize(); createParticles(); });
}

function animateCountUp() {
  document.querySelectorAll('.trust-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    const start = Date.now();
    const step = () => {
      const progress = Math.min((Date.now() - start) / 2000, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - progress, 3)) * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    setTimeout(step, 300);
  });
}

function navigateTo(targetId, direction = 'forward') {
  const currentScreen = document.querySelector('.screen.active');
  const targetScreen = document.getElementById(targetId);
  if (!currentScreen || !targetScreen || currentScreen === targetScreen) return;
  if (direction === 'forward') { currentScreen.classList.remove('active'); currentScreen.classList.add('slide-out-left'); targetScreen.classList.add('slide-in-right'); }
  else { currentScreen.classList.remove('active'); currentScreen.classList.add('slide-out-right'); targetScreen.classList.add('slide-in-left'); }
  setTimeout(() => { currentScreen.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right'); targetScreen.classList.remove('slide-in-right', 'slide-in-left'); targetScreen.classList.add('active'); targetScreen.scrollTop = 0; }, 450);
}

function initGrids() {
  const zodiacGrid = document.getElementById('zodiac-grid');
  const constellationGrid = document.getElementById('constellation-grid');
  zodiacGrid.innerHTML = ZODIACS.map((z, i) => `<div class="zodiac-item" data-index="${i}"><span class="emoji">${z.emoji}</span><span>${z.name}</span></div>`).join('');
  constellationGrid.innerHTML = CONSTELLATIONS.map((c, i) => `<div class="constellation-item" data-index="${i}"><span class="emoji">${c.emoji}</span><span>${c.name}</span></div>`).join('');
  zodiacGrid.addEventListener('click', (e) => { const item = e.target.closest('.zodiac-item'); if (!item) return; zodiacGrid.querySelectorAll('.zodiac-item').forEach(el => el.classList.remove('selected')); item.classList.add('selected'); selectedZodiac = parseInt(item.dataset.index); updateNextButton(); });
  constellationGrid.addEventListener('click', (e) => { const item = e.target.closest('.constellation-item'); if (!item) return; constellationGrid.querySelectorAll('.constellation-item').forEach(el => el.classList.remove('selected')); item.classList.add('selected'); selectedConstellation = parseInt(item.dataset.index); checkConstellationMatch(); updateNextButton(); });
}

// 根据月日推算星座索引
function getConstellationFromDate(month, day) {
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
  const constellationIndices = [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (month > boundaries[i].month || (month === boundaries[i].month && day >= boundaries[i].day)) {
      return constellationIndices[i];
    }
  }
  return 9; // 摩羯座
}

function checkConstellationMatch() {
  const hintEl = document.getElementById('constellation-hint');
  if (!hintEl) return;
  if (selectedConstellation === null || !selectedMonth || !selectedDay) {
    hintEl.style.display = 'none';
    return;
  }
  const correctIndex = getConstellationFromDate(selectedMonth, selectedDay);
  if (selectedConstellation !== correctIndex) {
    const correctName = CONSTELLATIONS[correctIndex].name;
    hintEl.textContent = `⚠️ 根据您的出生日期，您的星座应该是「${correctName}」，已自动修正`;
    hintEl.style.display = 'block';
    selectedConstellation = correctIndex;
    const constellationGrid = document.getElementById('constellation-grid');
    constellationGrid.querySelectorAll('.constellation-item').forEach(el => el.classList.remove('selected'));
    const correctItem = constellationGrid.querySelector(`.constellation-item[data-index="${correctIndex}"]`);
    if (correctItem) correctItem.classList.add('selected');
  } else {
    hintEl.style.display = 'none';
  }
}

function autoDetectConstellation() {
  if (!selectedMonth || !selectedDay) return;
  const correctIndex = getConstellationFromDate(selectedMonth, selectedDay);
  if (selectedConstellation === null) {
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
    checkConstellationMatch();
  }
  updateNextButton();
}

function updateNextButton() {
  document.getElementById('btn-to-scan').disabled = !(selectedZodiac !== null);
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
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      showErrorToast('摄像头需要HTTPS安全连接，请使用HTTPS访问本页面');
    } else {
      showErrorToast('当前浏览器不支持摄像头功能');
    }
    enableUploadFallback();
    return;
  }

  // 依次尝试：后置摄像头 → 前置摄像头 → 不指定摄像头
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
  btnCapture.style.display = 'none';
  if (btnUpload) {
    btnUpload.style.display = 'block';
  }
}

// 处理文件上传
function handlePalmUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    showErrorToast('请上传 JPG/PNG/WebP 格式的图片');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showErrorToast('图片大小不能超过10MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('scan-canvas');
      const ctx = canvas.getContext('2d');

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

      const video = document.getElementById('camera-video');
      video.style.display = 'none';

      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'contain';
      canvas.style.borderRadius = '12px';

      canvas.toBlob(function(blob) {
        capturedImageBlob = blob;
        const btnUpload = document.getElementById('btn-upload-palm');
        if (btnUpload) btnUpload.style.display = 'none';
        document.getElementById('btn-capture').style.display = 'none';
        document.getElementById('btn-recapture').style.display = 'block';
        document.getElementById('btn-scan').style.display = 'block';
        document.getElementById('btn-scan').disabled = false;
        document.getElementById('btn-scan').innerHTML = '<i class="fas fa-hand-sparkles"></i> 开始掌纹分析';
      }, 'image/jpeg', 0.85);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; } }

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('scan-canvas');
  const ctx = canvas.getContext('2d');
  if (video.videoWidth > 0) {
    canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
    canvas.toBlob(function (blob) { capturedImageBlob = blob; video.pause(); document.getElementById('btn-capture').style.display = 'none'; document.getElementById('btn-recapture').style.display = 'none'; document.getElementById('btn-scan').style.display = 'none'; callIdentifyApi(); }, 'image/jpeg', 0.85);
  } else {
    canvas.width = 640; canvas.height = 480;
    const gradient = ctx.createRadialGradient(320, 240, 20, 320, 240, 300);
    gradient.addColorStop(0, '#e8c8a0'); gradient.addColorStop(0.5, '#d4a574'); gradient.addColorStop(1, '#8b6914');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 480);
    ctx.strokeStyle = '#a07040'; ctx.lineWidth = 2;
    for (let i = 0; i < 15; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * 640, Math.random() * 480); ctx.quadraticCurveTo(Math.random() * 640, Math.random() * 480, Math.random() * 640, Math.random() * 480); ctx.stroke(); }
    canvas.toBlob(function (blob) { capturedImageBlob = blob; document.getElementById('btn-capture').style.display = 'none'; document.getElementById('btn-recapture').style.display = 'none'; document.getElementById('btn-scan').style.display = 'none'; callIdentifyApi(); }, 'image/jpeg', 0.9);
  }
}

async function callIdentifyApi() {
  const resultCard = document.getElementById('identify-result-card');
  const identifyIcon = document.getElementById('identify-icon');
  const identifyTitle = document.getElementById('identify-title');
  const identifySubtitle = document.getElementById('identify-subtitle');
  const identifyDetails = document.getElementById('identify-details');
  const btnScan = document.getElementById('btn-scan');
  const btnRecapture = document.getElementById('btn-recapture');
  resultCard.style.display = 'block';
  identifyIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; identifyIcon.className = 'identify-icon loading';
  identifyTitle.textContent = '正在识别身份...'; identifySubtitle.textContent = '调用掌纹识别接口中'; identifyDetails.style.display = 'none';
  try {
    const formData = new FormData(); formData.append('file', capturedImageBlob, 'palm.jpg');
    const response = await authFetch(`${API_BASE}/readings`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json(); identifyResult = result.data; identifyDetails.style.display = 'block';
    if (result.data && result.data.identified) { identifyIcon.innerHTML = '<i class="fas fa-user-check"></i>'; identifyIcon.className = 'identify-icon success'; identifyTitle.textContent = '身份识别成功！'; identifySubtitle.textContent = '已在掌纹库中找到匹配用户'; document.getElementById('identify-userid').textContent = result.data.user_id || '-'; }
    else { identifyIcon.innerHTML = '<i class="fas fa-user-secret"></i>'; identifyIcon.className = 'identify-icon warning'; identifyTitle.textContent = '身份未匹配'; identifySubtitle.textContent = '掌纹库中暂未找到匹配用户'; document.getElementById('identify-userid').textContent = '未识别'; }
    btnScan.style.display = 'block'; btnScan.disabled = false; btnScan.innerHTML = '<i class="fas fa-hand-sparkles"></i> 开始掌纹分析'; btnRecapture.style.display = 'block';
  } catch (error) {
    identifyResult = null; identifyIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; identifyIcon.className = 'identify-icon error';
    identifyTitle.textContent = '混元模型连接失败'; identifySubtitle.textContent = error.message || '网络错误，请检查API密钥和网络连接'; identifyDetails.style.display = 'block'; document.getElementById('identify-userid').textContent = '-';
    btnScan.style.display = 'none'; btnScan.disabled = true; btnRecapture.style.display = 'block'; showErrorToast('混元模型连接失败: ' + (error.message || '网络错误'));
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
}

async function uploadPalmForAnalysis() {
  if (!capturedImageBlob) { showErrorToast('请先拍照采集掌纹'); return null; }
  try {
    const formData = new FormData();
    formData.append('file', capturedImageBlob, 'palm.jpg');
    // 超时58秒，略大于后端pipeline超时(55s)，确保能收到后端响应
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 58000);
    const response = await authFetch(`${API_BASE}/readings`, { method: 'POST', body: formData, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.code === 0) { palmAnalysisResult = result.data; return result.data; }
    else throw new Error(result.message || '分析失败');
  } catch (error) {
    console.error('掌纹分析API调用失败:', error);
    return null;
  }
}

function showErrorToast(message) {
  const toast = document.getElementById('error-toast'); const msgEl = document.getElementById('error-message');
  if (!toast || !msgEl) return; msgEl.textContent = message; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}