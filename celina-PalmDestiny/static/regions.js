/**
 * 中国省/市/县区三级行政区划数据（含经度）
 * 真太阳时修正仅需经度（纬度此处不用）。
 * 格式：{ name: '省名', cities: [{ name: '市名', districts: [{ name: '县/区名', lng: 经度 }] }] }
 *
 * 数据覆盖：34个省级行政区的常见城市与主要县区，经度精确到小数点后2位。
 * 若某县区未列出，用户可选择所属市（默认市辖区）。
 */
const CHINA_REGIONS = [
  {
    name: '北京', cities: [
      { name: '北京市', districts: [
        { name: '东城区', lng: 116.42 }, { name: '西城区', lng: 116.37 }, { name: '朝阳区', lng: 116.49 },
        { name: '海淀区', lng: 116.30 }, { name: '丰台区', lng: 116.29 }, { name: '石景山区', lng: 116.22 },
        { name: '通州区', lng: 116.66 }, { name: '昌平区', lng: 116.23 }, { name: '大兴区', lng: 116.34 },
        { name: '顺义区', lng: 116.65 }, { name: '房山区', lng: 115.97 }, { name: '门头沟区', lng: 116.10 },
        { name: '怀柔区', lng: 116.63 }, { name: '平谷区', lng: 117.12 }, { name: '密云区', lng: 116.83 },
        { name: '延庆区', lng: 115.97 }
      ] }
    ]
  },
  {
    name: '天津', cities: [
      { name: '天津市', districts: [
        { name: '和平区', lng: 117.21 }, { name: '河东区', lng: 117.25 }, { name: '河西区', lng: 117.22 },
        { name: '南开区', lng: 117.15 }, { name: '河北区', lng: 117.20 }, { name: '红桥区', lng: 117.15 },
        { name: '东丽区', lng: 117.31 }, { name: '西青区', lng: 117.01 }, { name: '津南区', lng: 117.39 },
        { name: '北辰区', lng: 117.14 }, { name: '武清区', lng: 117.04 }, { name: '宝坻区', lng: 117.31 },
        { name: '滨海新区', lng: 117.70 }, { name: '宁河区', lng: 117.82 }, { name: '静海区', lng: 116.97 },
        { name: '蓟州区', lng: 117.41 }
      ] }
    ]
  },
  {
    name: '河北', cities: [
      { name: '石家庄市', districts: [
        { name: '长安区', lng: 114.54 }, { name: '桥西区', lng: 114.46 }, { name: '新华区', lng: 114.46 },
        { name: '裕华区', lng: 114.53 }, { name: '藁城区', lng: 114.85 }, { name: '鹿泉区', lng: 114.31 },
        { name: '栾城区', lng: 114.65 }, { name: '井陉县', lng: 114.15 }, { name: '正定县', lng: 114.57 },
        { name: '行唐县', lng: 114.55 }, { name: '灵寿县', lng: 114.38 }, { name: '高邑县', lng: 114.61 },
        { name: '深泽县', lng: 115.20 }, { name: '赞皇县', lng: 114.38 }, { name: '无极县', lng: 114.96 },
        { name: '平山县', lng: 114.19 }, { name: '元氏县', lng: 114.52 }, { name: '赵县', lng: 114.78 },
        { name: '晋州市', lng: 115.04 }, { name: '新乐市', lng: 114.68 }
      ] },
      { name: '唐山市', districts: [
        { name: '路南区', lng: 118.17 }, { name: '路北区', lng: 118.20 }, { name: '古冶区', lng: 118.45 },
        { name: '开平区', lng: 118.26 }, { name: '丰南区', lng: 118.09 }, { name: '丰润区', lng: 118.16 },
        { name: '曹妃甸区', lng: 118.46 }, { name: '滦县', lng: 118.70 }, { name: '滦南县', lng: 118.68 },
        { name: '乐亭县', lng: 118.91 }, { name: '迁西县', lng: 118.32 }, { name: '玉田县', lng: 117.74 },
        { name: '遵化市', lng: 117.97 }, { name: '迁安市', lng: 118.70 }
      ] },
      { name: '秦皇岛市', districts: [
        { name: '海港区', lng: 119.61 }, { name: '山海关区', lng: 119.77 }, { name: '北戴河区', lng: 119.48 },
        { name: '昌黎县', lng: 119.16 }, { name: '卢龙县', lng: 118.89 }
      ] },
      { name: '邯郸市', districts: [
        { name: '邯山区', lng: 114.48 }, { name: '丛台区', lng: 114.49 }, { name: '复兴区', lng: 114.46 },
        { name: '峰峰矿区', lng: 114.21 }, { name: '永年区', lng: 114.49 }, { name: '武安市', lng: 114.20 }
      ] },
      { name: '邢台市', districts: [
        { name: '桥东区', lng: 114.51 }, { name: '桥西区', lng: 114.47 }, { name: '南宫市', lng: 115.38 },
        { name: '沙河市', lng: 114.50 }
      ] },
      { name: '保定市', districts: [
        { name: '竞秀区', lng: 115.46 }, { name: '莲池区', lng: 115.49 }, { name: '满城区', lng: 115.32 },
        { name: '清苑区', lng: 115.49 }, { name: '徐水区', lng: 115.66 }, { name: '涿州市', lng: 115.98 },
        { name: '定州市', lng: 114.99 }, { name: '安国市', lng: 115.33 }, { name: '高碑店市', lng: 115.87 }
      ] },
      { name: '张家口市', districts: [
        { name: '桥东区', lng: 114.89 }, { name: '桥西区', lng: 114.87 }, { name: '宣化区', lng: 115.05 },
        { name: '下花园区', lng: 115.29 }, { name: '崇礼区', lng: 115.28 }
      ] },
      { name: '承德市', districts: [
        { name: '双桥区', lng: 117.94 }, { name: '双滦区', lng: 117.80 }, { name: '鹰手营子矿区', lng: 117.66 }
      ] },
      { name: '沧州市', districts: [
        { name: '新华区', lng: 116.87 }, { name: '运河区', lng: 116.84 }, { name: '泊头市', lng: 116.57 },
        { name: '任丘市', lng: 116.10 }, { name: '黄骅市', lng: 117.34 }, { name: '河间市', lng: 116.10 }
      ] },
      { name: '廊坊市', districts: [
        { name: '安次区', lng: 116.71 }, { name: '广阳区', lng: 116.71 }, { name: '三河市', lng: 117.07 },
        { name: '霸州市', lng: 116.39 }
      ] },
      { name: '衡水市', districts: [
        { name: '桃城区', lng: 115.68 }, { name: '冀州区', lng: 115.58 }, { name: '深州市', lng: 115.55 }
      ] }
    ]
  },
  {
    name: '山西', cities: [
      { name: '太原市', districts: [
        { name: '小店区', lng: 112.56 }, { name: '迎泽区', lng: 112.56 }, { name: '杏花岭区', lng: 112.56 },
        { name: '尖草坪区', lng: 112.48 }, { name: '万柏林区', lng: 112.52 }, { name: '晋源区', lng: 112.48 },
        { name: '清徐县', lng: 112.35 }, { name: '阳曲县', lng: 112.68 }, { name: '娄烦县', lng: 111.80 },
        { name: '古交市', lng: 112.17 }
      ] },
      { name: '大同市', districts: [
        { name: '平城区', lng: 113.30 }, { name: '云冈区', lng: 113.16 }, { name: '新荣区', lng: 113.13 },
        { name: '云州区', lng: 113.60 }
      ] },
      { name: '阳泉市', districts: [
        { name: '城区', lng: 113.58 }, { name: '矿区', lng: 113.55 }, { name: '郊区', lng: 113.58 }
      ] },
      { name: '长治市', districts: [
        { name: '潞州区', lng: 113.12 }, { name: '上党区', lng: 113.05 }, { name: '屯留区', lng: 112.89 },
        { name: '潞城区', lng: 113.23 }
      ] },
      { name: '晋城市', districts: [
        { name: '城区', lng: 112.85 }, { name: '高平市', lng: 112.92 }
      ] },
      { name: '朔州市', districts: [
        { name: '朔城区', lng: 112.43 }, { name: '平鲁区', lng: 112.29 }, { name: '怀仁市', lng: 113.10 }
      ] },
      { name: '晋中市', districts: [
        { name: '榆次区', lng: 112.71 }, { name: '介休市', lng: 111.92 }
      ] },
      { name: '运城市', districts: [
        { name: '盐湖区', lng: 110.99 }, { name: '永济市', lng: 110.44 }, { name: '河津市', lng: 110.71 }
      ] },
      { name: '忻州市', districts: [
        { name: '忻府区', lng: 112.75 }, { name: '原平市', lng: 112.70 }
      ] },
      { name: '临汾市', districts: [
        { name: '尧都区', lng: 111.58 }, { name: '侯马市', lng: 111.37 }, { name: '霍州市', lng: 111.76 }
      ] },
      { name: '吕梁市', districts: [
        { name: '离石区', lng: 111.15 }, { name: '孝义市', lng: 111.78 }, { name: '汾阳市', lng: 111.78 }
      ] }
    ]
  },
  {
    name: '内蒙古', cities: [
      { name: '呼和浩特市', districts: [
        { name: '新城区', lng: 111.67 }, { name: '回民区', lng: 111.62 }, { name: '玉泉区', lng: 111.67 },
        { name: '赛罕区', lng: 111.70 }, { name: '土默特左旗', lng: 111.15 }, { name: '托克托县', lng: 111.19 },
        { name: '和林格尔县', lng: 111.82 }, { name: '武川县', lng: 111.45 }
      ] },
      { name: '包头市', districts: [
        { name: '昆都仑区', lng: 109.84 }, { name: '东河区', lng: 110.05 }, { name: '青山区', lng: 109.90 },
        { name: '九原区', lng: 109.97 }, { name: '石拐区', lng: 110.27 }
      ] },
      { name: '乌海市', districts: [
        { name: '海勃湾区', lng: 106.82 }, { name: '海南区', lng: 106.89 }, { name: '乌达区', lng: 106.73 }
      ] },
      { name: '赤峰市', districts: [
        { name: '红山区', lng: 118.96 }, { name: '元宝山区', lng: 119.29 }, { name: '松山区', lng: 118.93 }
      ] },
      { name: '通辽市', districts: [
        { name: '科尔沁区', lng: 122.26 }, { name: '霍林郭勒市', lng: 119.65 }
      ] },
      { name: '鄂尔多斯市', districts: [
        { name: '东胜区', lng: 109.96 }, { name: '康巴什区', lng: 109.87 }
      ] },
      { name: '呼伦贝尔市', districts: [
        { name: '海拉尔区', lng: 119.76 }, { name: '满洲里市', lng: 117.48 }, { name: '牙克石市', lng: 120.74 }
      ] },
      { name: '巴彦淖尔市', districts: [
        { name: '临河区', lng: 107.43 }
      ] },
      { name: '乌兰察布市', districts: [
        { name: '集宁区', lng: 113.11 }, { name: '丰镇市', lng: 113.11 }
      ] },
      { name: '兴安盟', districts: [
        { name: '乌兰浩特市', lng: 122.06 }, { name: '阿尔山市', lng: 119.93 }
      ] },
      { name: '锡林郭勒盟', districts: [
        { name: '锡林浩特市', lng: 116.09 }, { name: '二连浩特市', lng: 111.98 }
      ] },
      { name: '阿拉善盟', districts: [
        { name: '阿拉善左旗', lng: 105.67 }
      ] }
    ]
  },
  {
    name: '辽宁', cities: [
      { name: '沈阳市', districts: [
        { name: '和平区', lng: 123.42 }, { name: '沈河区', lng: 123.45 }, { name: '大东区', lng: 123.47 },
        { name: '皇姑区', lng: 123.42 }, { name: '铁西区', lng: 123.37 }, { name: '苏家屯区', lng: 123.34 },
        { name: '浑南区', lng: 123.46 }, { name: '沈北新区', lng: 123.52 }, { name: '于洪区', lng: 123.30 },
        { name: '辽中区', lng: 122.73 }, { name: '新民市', lng: 122.83 }
      ] },
      { name: '大连市', districts: [
        { name: '中山区', lng: 121.64 }, { name: '西岗区', lng: 121.61 }, { name: '沙河口区', lng: 121.59 },
        { name: '甘井子区', lng: 121.57 }, { name: '旅顺口区', lng: 121.26 }, { name: '金州区', lng: 121.72 },
        { name: '普兰店区', lng: 121.96 }, { name: '长海县', lng: 122.59 }, { name: '瓦房店市', lng: 122.00 },
        { name: '庄河市', lng: 122.97 }
      ] },
      { name: '鞍山市', districts: [
        { name: '铁东区', lng: 122.99 }, { name: '铁西区', lng: 122.97 }, { name: '立山区', lng: 123.03 },
        { name: '千山区', lng: 122.96 }, { name: '海城市', lng: 122.69 }
      ] },
      { name: '抚顺市', districts: [
        { name: '新抚区', lng: 123.91 }, { name: '东洲区', lng: 124.04 }, { name: '望花区', lng: 123.78 }
      ] },
      { name: '本溪市', districts: [
        { name: '平山区', lng: 123.77 }, { name: '溪湖区', lng: 123.77 }, { name: '明山区', lng: 123.82 }
      ] },
      { name: '丹东市', districts: [
        { name: '元宝区', lng: 124.40 }, { name: '振兴区', lng: 124.36 }, { name: '东港市', lng: 124.15 }
      ] },
      { name: '锦州市', districts: [
        { name: '古塔区', lng: 121.13 }, { name: '凌河区', lng: 121.15 }, { name: '凌海市', lng: 121.36 }
      ] },
      { name: '营口市', districts: [
        { name: '站前区', lng: 122.26 }, { name: '西市区', lng: 122.21 }, { name: '鲅鱼圈区', lng: 122.13 },
        { name: '盖州市', lng: 122.35 }
      ] },
      { name: '阜新市', districts: [
        { name: '海州区', lng: 121.66 }, { name: '新邱区', lng: 121.79 }
      ] },
      { name: '辽阳市', districts: [
        { name: '白塔区', lng: 123.18 }, { name: '文圣区', lng: 123.19 }
      ] },
      { name: '盘锦市', districts: [
        { name: '双台子区', lng: 122.06 }, { name: '兴隆台区', lng: 122.07 }
      ] },
      { name: '铁岭市', districts: [
        { name: '银州区', lng: 123.84 }, { name: '调兵山市', lng: 123.56 }, { name: '开原市', lng: 124.04 }
      ] },
      { name: '朝阳市', districts: [
        { name: '双塔区', lng: 120.46 }, { name: '龙城区', lng: 120.43 }, { name: '北票市', lng: 120.77 }
      ] },
      { name: '葫芦岛市', districts: [
        { name: '连山区', lng: 120.83 }, { name: '龙港区', lng: 120.94 }, { name: '兴城市', lng: 120.73 }
      ] }
    ]
  },
  {
    name: '吉林', cities: [
      { name: '长春市', districts: [
        { name: '南关区', lng: 125.35 }, { name: '宽城区', lng: 125.33 }, { name: '朝阳区', lng: 125.29 },
        { name: '二道区', lng: 125.37 }, { name: '绿园区', lng: 125.26 }, { name: '双阳区', lng: 125.66 },
        { name: '九台区', lng: 125.84 }, { name: '榆树市', lng: 126.55 }, { name: '德惠市', lng: 125.70 }
      ] },
      { name: '吉林市', districts: [
        { name: '昌邑区', lng: 126.57 }, { name: '龙潭区', lng: 126.56 }, { name: '船营区', lng: 126.55 },
        { name: '丰满区', lng: 126.56 }, { name: '蛟河市', lng: 127.34 }, { name: '桦甸市', lng: 126.75 },
        { name: '舒兰市', lng: 126.95 }, { name: '磐石市', lng: 126.06 }
      ] },
      { name: '四平市', districts: [
        { name: '铁西区', lng: 124.34 }, { name: '铁东区', lng: 124.41 }, { name: '公主岭市', lng: 124.82 }
      ] },
      { name: '辽源市', districts: [
        { name: '龙山区', lng: 125.14 }, { name: '西安区', lng: 125.15 }
      ] },
      { name: '通化市', districts: [
        { name: '东昌区', lng: 125.96 }, { name: '二道江区', lng: 126.04 }
      ] },
      { name: '白山市', districts: [
        { name: '浑江区', lng: 126.42 }, { name: '江源区', lng: 126.59 }
      ] },
      { name: '松原市', districts: [
        { name: '宁江区', lng: 124.82 }
      ] },
      { name: '白城市', districts: [
        { name: '洮北区', lng: 122.84 }, { name: '洮南市', lng: 122.78 }, { name: '大安市', lng: 124.29 }
      ] },
      { name: '延边朝鲜族自治州', districts: [
        { name: '延吉市', lng: 129.51 }, { name: '图们市', lng: 129.84 }, { name: '敦化市', lng: 128.23 },
        { name: '珲春市', lng: 130.37 }, { name: '龙井市', lng: 129.43 }
      ] }
    ]
  },
  {
    name: '黑龙江', cities: [
      { name: '哈尔滨市', districts: [
        { name: '道里区', lng: 126.62 }, { name: '南岗区', lng: 126.67 }, { name: '道外区', lng: 126.65 },
        { name: '平房区', lng: 126.62 }, { name: '松北区', lng: 126.56 }, { name: '香坊区', lng: 126.68 },
        { name: '呼兰区', lng: 126.59 }, { name: '阿城区', lng: 126.97 }, { name: '双城区', lng: 126.31 },
        { name: '尚志市', lng: 127.95 }, { name: '五常市', lng: 127.16 }
      ] },
      { name: '齐齐哈尔市', districts: [
        { name: '龙沙区', lng: 123.96 }, { name: '建华区', lng: 123.96 }, { name: '铁锋区', lng: 123.98 },
        { name: '昂昂溪区', lng: 123.82 }, { name: '讷河市', lng: 124.87 }
      ] },
      { name: '鸡西市', districts: [
        { name: '鸡冠区', lng: 130.97 }, { name: '恒山区', lng: 130.93 }, { name: '密山市', lng: 131.85 }
      ] },
      { name: '鹤岗市', districts: [
        { name: '向阳区', lng: 130.29 }, { name: '工农区', lng: 130.27 }
      ] },
      { name: '双鸭山市', districts: [
        { name: '尖山区', lng: 131.16 }, { name: '岭东区', lng: 131.16 }
      ] },
      { name: '大庆市', districts: [
        { name: '萨尔图区', lng: 125.09 }, { name: '龙凤区', lng: 125.12 }, { name: '让胡路区', lng: 124.87 },
        { name: '红岗区', lng: 124.89 }, { name: '大同区', lng: 124.83 }
      ] },
      { name: '伊春市', districts: [
        { name: '伊春区', lng: 128.91 }
      ] },
      { name: '佳木斯市', districts: [
        { name: '向阳区', lng: 130.37 }, { name: '前进区', lng: 130.38 }, { name: '同江市', lng: 132.51 }
      ] },
      { name: '七台河市', districts: [
        { name: '桃山区', lng: 131.02 }, { name: '新兴区', lng: 130.93 }
      ] },
      { name: '牡丹江市', districts: [
        { name: '东安区', lng: 129.63 }, { name: '阳明区', lng: 129.64 }, { name: '绥芬河市', lng: 131.16 }
      ] },
      { name: '黑河市', districts: [
        { name: '爱辉区', lng: 127.50 }, { name: '北安市', lng: 126.51 }, { name: '五大连池市', lng: 126.20 }
      ] },
      { name: '绥化市', districts: [
        { name: '北林区', lng: 126.99 }, { name: '安达市', lng: 125.34 }, { name: '肇东市', lng: 125.99 }
      ] },
      { name: '大兴安岭地区', districts: [
        { name: '加格达奇区', lng: 124.12 }, { name: '漠河市', lng: 122.53 }
      ] }
    ]
  },
  {
    name: '上海', cities: [
      { name: '上海市', districts: [
        { name: '黄浦区', lng: 121.49 }, { name: '徐汇区', lng: 121.44 }, { name: '长宁区', lng: 121.42 },
        { name: '静安区', lng: 121.45 }, { name: '普陀区', lng: 121.40 }, { name: '虹口区', lng: 121.48 },
        { name: '杨浦区', lng: 121.53 }, { name: '闵行区', lng: 121.38 }, { name: '宝山区', lng: 121.49 },
        { name: '嘉定区', lng: 121.27 }, { name: '浦东新区', lng: 121.54 }, { name: '金山区', lng: 121.34 },
        { name: '松江区', lng: 121.23 }, { name: '青浦区', lng: 121.12 }, { name: '奉贤区', lng: 121.47 },
        { name: '崇明区', lng: 121.39 }
      ] }
    ]
  },
  {
    name: '江苏', cities: [
      { name: '南京市', districts: [
        { name: '玄武区', lng: 118.80 }, { name: '秦淮区', lng: 118.80 }, { name: '建邺区', lng: 118.73 },
        { name: '鼓楼区', lng: 118.77 }, { name: '浦口区', lng: 118.63 }, { name: '栖霞区', lng: 118.88 },
        { name: '雨花台区', lng: 118.78 }, { name: '江宁区', lng: 118.83 }, { name: '六合区', lng: 118.84 },
        { name: '溧水区', lng: 119.03 }, { name: '高淳区', lng: 118.87 }
      ] },
      { name: '无锡市', districts: [
        { name: '锡山区', lng: 120.36 }, { name: '惠山区', lng: 120.30 }, { name: '滨湖区', lng: 120.26 },
        { name: '梁溪区', lng: 120.30 }, { name: '新吴区', lng: 120.36 }, { name: '江阴市', lng: 120.28 },
        { name: '宜兴市', lng: 119.82 }
      ] },
      { name: '徐州市', districts: [
        { name: '鼓楼区', lng: 117.19 }, { name: '云龙区', lng: 117.24 }, { name: '贾汪区', lng: 117.45 },
        { name: '泉山区', lng: 117.19 }, { name: '铜山区', lng: 117.18 }, { name: '邳州市', lng: 117.95 },
        { name: '新沂市', lng: 118.35 }
      ] },
      { name: '常州市', districts: [
        { name: '天宁区', lng: 119.96 }, { name: '钟楼区', lng: 119.90 }, { name: '新北区', lng: 119.97 },
        { name: '武进区', lng: 119.94 }, { name: '金坛区', lng: 119.58 }, { name: '溧阳市', lng: 119.48 }
      ] },
      { name: '苏州市', districts: [
        { name: '姑苏区', lng: 120.61 }, { name: '虎丘区', lng: 120.57 }, { name: '吴中区', lng: 120.63 },
        { name: '相城区', lng: 120.64 }, { name: '吴江区', lng: 120.64 }, { name: '常熟市', lng: 120.74 },
        { name: '张家港市', lng: 120.56 }, { name: '昆山市', lng: 120.98 }, { name: '太仓市', lng: 121.11 }
      ] },
      { name: '南通市', districts: [
        { name: '崇川区', lng: 120.86 }, { name: '港闸区', lng: 120.82 }, { name: '通州区', lng: 121.07 },
        { name: '启东市', lng: 121.66 }, { name: '如皋市', lng: 120.56 }, { name: '海门区', lng: 121.17 }
      ] },
      { name: '连云港市', districts: [
        { name: '连云区', lng: 119.37 }, { name: '海州区', lng: 119.16 }, { name: '赣榆区', lng: 119.13 }
      ] },
      { name: '淮安市', districts: [
        { name: '清江浦区', lng: 119.03 }, { name: '淮安区', lng: 119.02 }, { name: '淮阴区', lng: 119.03 }
      ] },
      { name: '盐城市', districts: [
        { name: '亭湖区', lng: 120.20 }, { name: '盐都区', lng: 120.13 }, { name: '东台市', lng: 120.31 }
      ] },
      { name: '扬州市', districts: [
        { name: '广陵区', lng: 119.43 }, { name: '邗江区', lng: 119.39 }, { name: '江都区', lng: 119.57 },
        { name: '仪征市', lng: 119.18 }, { name: '高邮市', lng: 119.45 }
      ] },
      { name: '镇江市', districts: [
        { name: '京口区', lng: 119.47 }, { name: '润州区', lng: 119.41 }, { name: '丹徒区', lng: 119.43 },
        { name: '丹阳市', lng: 119.57 }, { name: '扬中市', lng: 119.80 }, { name: '句容市', lng: 119.16 }
      ] },
      { name: '泰州市', districts: [
        { name: '海陵区', lng: 119.92 }, { name: '高港区', lng: 119.88 }, { name: '姜堰区', lng: 120.15 },
        { name: '靖江市', lng: 120.26 }, { name: '泰兴市', lng: 120.05 }
      ] },
      { name: '宿迁市', districts: [
        { name: '宿城区', lng: 118.25 }, { name: '宿豫区', lng: 118.33 }
      ] }
    ]
  },
  {
    name: '浙江', cities: [
      { name: '杭州市', districts: [
        { name: '上城区', lng: 120.17 }, { name: '下城区', lng: 120.18 }, { name: '江干区', lng: 120.20 },
        { name: '拱墅区', lng: 120.14 }, { name: '西湖区', lng: 120.13 }, { name: '滨江区', lng: 120.21 },
        { name: '萧山区', lng: 120.26 }, { name: '余杭区', lng: 120.30 }, { name: '临平区', lng: 120.30 },
        { name: '钱塘区', lng: 120.42 }, { name: '富阳区', lng: 119.96 }, { name: '临安区', lng: 119.72 },
        { name: '桐庐县', lng: 119.69 }, { name: '淳安县', lng: 119.03 }, { name: '建德市', lng: 119.28 }
      ] },
      { name: '宁波市', districts: [
        { name: '海曙区', lng: 121.55 }, { name: '江北区', lng: 121.56 }, { name: '北仑区', lng: 121.85 },
        { name: '镇海区', lng: 121.72 }, { name: '鄞州区', lng: 121.55 }, { name: '奉化区', lng: 121.41 },
        { name: '余姚市', lng: 121.15 }, { name: '慈溪市', lng: 121.27 }, { name: '宁海县', lng: 121.43 },
        { name: '象山县', lng: 121.87 }
      ] },
      { name: '温州市', districts: [
        { name: '鹿城区', lng: 120.66 }, { name: '龙湾区', lng: 120.83 }, { name: '瓯海区', lng: 120.64 },
        { name: '洞头区', lng: 121.15 }, { name: '乐清市', lng: 120.96 }, { name: '瑞安市', lng: 120.64 },
        { name: '永嘉县', lng: 120.69 }, { name: '平阳县', lng: 120.56 }, { name: '苍南县', lng: 120.43 },
        { name: '文成县', lng: 120.09 }, { name: '泰顺县', lng: 119.72 }
      ] },
      { name: '嘉兴市', districts: [
        { name: '南湖区', lng: 120.79 }, { name: '秀洲区', lng: 120.71 }, { name: '海宁市', lng: 120.68 },
        { name: '平湖市', lng: 121.02 }, { name: '桐乡市', lng: 120.55 }, { name: '嘉善县', lng: 120.93 },
        { name: '海盐县', lng: 120.95 }
      ] },
      { name: '湖州市', districts: [
        { name: '吴兴区', lng: 120.12 }, { name: '南浔区', lng: 120.41 }, { name: '德清县', lng: 119.98 },
        { name: '长兴县', lng: 119.91 }, { name: '安吉县', lng: 119.68 }
      ] },
      { name: '绍兴市', districts: [
        { name: '越城区', lng: 120.58 }, { name: '柯桥区', lng: 120.49 }, { name: '上虞区', lng: 120.87 },
        { name: '诸暨市', lng: 120.24 }, { name: '嵊州市', lng: 120.83 }, { name: '新昌县', lng: 120.90 }
      ] },
      { name: '金华市', districts: [
        { name: '婺城区', lng: 119.57 }, { name: '金东区', lng: 119.69 }, { name: '兰溪市', lng: 119.46 },
        { name: '义乌市', lng: 120.07 }, { name: '东阳市', lng: 120.23 }, { name: '永康市', lng: 120.05 }
      ] },
      { name: '衢州市', districts: [
        { name: '柯城区', lng: 118.87 }, { name: '衢江区', lng: 118.96 }, { name: '江山市', lng: 118.62 }
      ] },
      { name: '舟山市', districts: [
        { name: '定海区', lng: 122.10 }, { name: '普陀区', lng: 122.30 }, { name: '岱山县', lng: 122.20 },
        { name: '嵊泗县', lng: 122.45 }
      ] },
      { name: '台州市', districts: [
        { name: '椒江区', lng: 121.44 }, { name: '黄岩区', lng: 121.26 }, { name: '路桥区', lng: 121.37 },
        { name: '临海市', lng: 121.13 }, { name: '温岭市', lng: 121.38 }, { name: '玉环市', lng: 121.23 }
      ] },
      { name: '丽水市', districts: [
        { name: '莲都区', lng: 119.92 }, { name: '龙泉市', lng: 119.14 }, { name: '青田县', lng: 120.29 }
      ] }
    ]
  },
  {
    name: '安徽', cities: [
      { name: '合肥市', districts: [
        { name: '瑶海区', lng: 117.31 }, { name: '庐阳区', lng: 117.27 }, { name: '蜀山区', lng: 117.26 },
        { name: '包河区', lng: 117.29 }, { name: '长丰县', lng: 117.17 }, { name: '肥东县', lng: 117.47 },
        { name: '肥西县', lng: 117.17 }, { name: '庐江县', lng: 117.28 }, { name: '巢湖市', lng: 117.87 }
      ] },
      { name: '芜湖市', districts: [
        { name: '镜湖区', lng: 118.38 }, { name: '弋江区', lng: 118.37 }, { name: '鸠江区', lng: 118.39 },
        { name: '三山区', lng: 118.22 }, { name: '无为市', lng: 117.92 }
      ] },
      { name: '蚌埠市', districts: [
        { name: '龙子湖区', lng: 117.38 }, { name: '蚌山区', lng: 117.37 }, { name: '禹会区', lng: 117.35 }
      ] },
      { name: '淮南市', districts: [
        { name: '大通区', lng: 117.05 }, { name: '田家庵区', lng: 117.02 }, { name: '谢家集区', lng: 116.87 }
      ] },
      { name: '马鞍山市', districts: [
        { name: '花山区', lng: 118.51 }, { name: '雨山区', lng: 118.50 }, { name: '博望区', lng: 118.85 }
      ] },
      { name: '淮北市', districts: [
        { name: '杜集区', lng: 116.83 }, { name: '相山区', lng: 116.79 }
      ] },
      { name: '铜陵市', districts: [
        { name: '铜官区', lng: 117.81 }, { name: '郊区', lng: 117.81 }
      ] },
      { name: '安庆市', districts: [
        { name: '迎江区', lng: 117.04 }, { name: '大观区', lng: 117.02 }, { name: '宜秀区', lng: 117.06 },
        { name: '桐城市', lng: 116.95 }, { name: '潜山市', lng: 116.57 }
      ] },
      { name: '黄山市', districts: [
        { name: '屯溪区', lng: 118.34 }, { name: '黄山区', lng: 118.14 }, { name: '徽州区', lng: 118.34 }
      ] },
      { name: '滁州市', districts: [
        { name: '琅琊区', lng: 118.31 }, { name: '南谯区', lng: 118.31 }, { name: '天长市', lng: 118.99 },
        { name: '明光市', lng: 117.99 }
      ] },
      { name: '阜阳市', districts: [
        { name: '颍州区', lng: 115.81 }, { name: '颍东区', lng: 115.85 }, { name: '颍泉区', lng: 115.80 },
        { name: '界首市', lng: 115.37 }
      ] },
      { name: '宿州市', districts: [
        { name: '埇桥区', lng: 116.98 }
      ] },
      { name: '六安市', districts: [
        { name: '金安区', lng: 116.51 }, { name: '裕安区', lng: 116.48 }, { name: '叶集区', lng: 115.94 }
      ] },
      { name: '亳州市', districts: [
        { name: '谯城区', lng: 115.78 }
      ] },
      { name: '池州市', districts: [
        { name: '贵池区', lng: 117.49 }
      ] },
      { name: '宣城市', districts: [
        { name: '宣州区', lng: 118.76 }, { name: '宁国市', lng: 118.98 }
      ] }
    ]
  },
  {
    name: '福建', cities: [
      { name: '福州市', districts: [
        { name: '鼓楼区', lng: 119.30 }, { name: '台江区', lng: 119.31 }, { name: '仓山区', lng: 119.31 },
        { name: '马尾区', lng: 119.46 }, { name: '晋安区', lng: 119.33 }, { name: '长乐区', lng: 119.52 },
        { name: '闽侯县', lng: 119.13 }, { name: '连江县', lng: 119.54 }, { name: '福清市', lng: 119.38 }
      ] },
      { name: '厦门市', districts: [
        { name: '思明区', lng: 118.08 }, { name: '海沧区', lng: 118.03 }, { name: '湖里区', lng: 118.15 },
        { name: '集美区', lng: 118.10 }, { name: '同安区', lng: 118.15 }, { name: '翔安区', lng: 118.25 }
      ] },
      { name: '莆田市', districts: [
        { name: '城厢区', lng: 119.00 }, { name: '涵江区', lng: 119.12 }, { name: '荔城区', lng: 119.02 },
        { name: '秀屿区', lng: 119.10 }
      ] },
      { name: '三明市', districts: [
        { name: '梅列区', lng: 117.64 }, { name: '三元区', lng: 117.61 }, { name: '永安市', lng: 117.37 }
      ] },
      { name: '泉州市', districts: [
        { name: '鲤城区', lng: 118.59 }, { name: '丰泽区', lng: 118.61 }, { name: '洛江区', lng: 118.67 },
        { name: '泉港区', lng: 118.92 }, { name: '石狮市', lng: 118.65 }, { name: '晋江市', lng: 118.55 },
        { name: '南安市', lng: 118.39 }
      ] },
      { name: '漳州市', districts: [
        { name: '芗城区', lng: 117.65 }, { name: '龙文区', lng: 117.71 }, { name: '龙海市', lng: 117.82 }
      ] },
      { name: '南平市', districts: [
        { name: '延平区', lng: 118.18 }, { name: '建阳区', lng: 118.12 }, { name: '邵武市', lng: 117.49 },
        { name: '武夷山市', lng: 118.04 }
      ] },
      { name: '龙岩市', districts: [
        { name: '新罗区', lng: 117.04 }, { name: '永定区', lng: 116.74 }, { name: '漳平市', lng: 117.42 }
      ] },
      { name: '宁德市', districts: [
        { name: '蕉城区', lng: 119.53 }, { name: '福安市', lng: 119.65 }, { name: '福鼎市', lng: 120.22 }
      ] }
    ]
  },
  {
    name: '江西', cities: [
      { name: '南昌市', districts: [
        { name: '东湖区', lng: 115.90 }, { name: '西湖区', lng: 115.87 }, { name: '青云谱区', lng: 115.91 },
        { name: '青山湖区', lng: 115.96 }, { name: '新建区', lng: 115.82 }, { name: '红谷滩区', lng: 115.83 }
      ] },
      { name: '景德镇市', districts: [
        { name: '昌江区', lng: 117.18 }, { name: '珠山区', lng: 117.20 }, { name: '乐平市', lng: 117.14 }
      ] },
      { name: '萍乡市', districts: [
        { name: '安源区', lng: 113.87 }, { name: '湘东区', lng: 113.73 }
      ] },
      { name: '九江市', districts: [
        { name: '濂溪区', lng: 115.99 }, { name: '浔阳区', lng: 115.99 }, { name: '柴桑区', lng: 115.89 },
        { name: '瑞昌市', lng: 115.67 }, { name: '共青城市', lng: 115.81 }
      ] },
      { name: '新余市', districts: [
        { name: '渝水区', lng: 114.95 }, { name: '分宜县', lng: 114.69 }
      ] },
      { name: '鹰潭市', districts: [
        { name: '月湖区', lng: 117.03 }, { name: '贵溪市', lng: 117.25 }
      ] },
      { name: '赣州市', districts: [
        { name: '章贡区', lng: 114.94 }, { name: '南康区', lng: 114.76 }, { name: '赣县区', lng: 115.01 },
        { name: '瑞金市', lng: 116.03 }
      ] },
      { name: '吉安市', districts: [
        { name: '吉州区', lng: 114.99 }, { name: '青原区', lng: 115.01 }, { name: '井冈山市', lng: 114.29 }
      ] },
      { name: '宜春市', districts: [
        { name: '袁州区', lng: 114.39 }, { name: '丰城市', lng: 115.78 }, { name: '樟树市', lng: 115.55 }
      ] },
      { name: '抚州市', districts: [
        { name: '临川区', lng: 116.36 }, { name: '东乡区', lng: 116.60 }
      ] },
      { name: '上饶市', districts: [
        { name: '信州区', lng: 117.97 }, { name: '广丰区', lng: 118.19 }, { name: '德兴市', lng: 117.58 }
      ] }
    ]
  },
  {
    name: '山东', cities: [
      { name: '济南市', districts: [
        { name: '历下区', lng: 117.08 }, { name: '市中区', lng: 116.99 }, { name: '槐荫区', lng: 116.90 },
        { name: '天桥区', lng: 116.99 }, { name: '历城区', lng: 117.07 }, { name: '长清区', lng: 116.75 },
        { name: '章丘区', lng: 117.53 }, { name: '济阳区', lng: 117.17 }, { name: '莱芜区', lng: 117.66 },
        { name: '钢城区', lng: 117.81 }
      ] },
      { name: '青岛市', districts: [
        { name: '市南区', lng: 120.41 }, { name: '市北区', lng: 120.37 }, { name: '黄岛区', lng: 120.19 },
        { name: '崂山区', lng: 120.47 }, { name: '李沧区', lng: 120.43 }, { name: '城阳区', lng: 120.40 },
        { name: '即墨区', lng: 120.45 }, { name: '胶州市', lng: 120.03 }, { name: '平度市', lng: 119.96 },
        { name: '莱西市', lng: 120.52 }
      ] },
      { name: '淄博市', districts: [
        { name: '淄川区', lng: 117.97 }, { name: '张店区', lng: 118.02 }, { name: '博山区', lng: 117.86 },
        { name: '临淄区', lng: 118.31 }, { name: '周村区', lng: 117.87 }
      ] },
      { name: '枣庄市', districts: [
        { name: '市中区', lng: 117.56 }, { name: '薛城区', lng: 117.26 }, { name: '峄城区', lng: 117.59 },
        { name: '滕州市', lng: 117.17 }
      ] },
      { name: '东营市', districts: [
        { name: '东营区', lng: 118.58 }, { name: '河口区', lng: 118.53 }, { name: '垦利区', lng: 118.55 }
      ] },
      { name: '烟台市', districts: [
        { name: '芝罘区', lng: 121.40 }, { name: '福山区', lng: 121.27 }, { name: '牟平区', lng: 121.60 },
        { name: '莱山区', lng: 121.45 }, { name: '龙口市', lng: 120.48 }, { name: '莱阳市', lng: 120.71 },
        { name: '招远市', lng: 120.40 }, { name: '蓬莱区', lng: 120.76 }
      ] },
      { name: '潍坊市', districts: [
        { name: '潍城区', lng: 119.11 }, { name: '寒亭区', lng: 119.22 }, { name: '坊子区', lng: 119.17 },
        { name: '奎文区', lng: 119.13 }, { name: '青州市', lng: 118.48 }, { name: '诸城市', lng: 119.41 },
        { name: '寿光市', lng: 118.79 }, { name: '安丘市', lng: 119.22 }, { name: '高密市', lng: 119.76 }
      ] },
      { name: '济宁市', districts: [
        { name: '任城区', lng: 116.60 }, { name: '兖州区', lng: 116.83 }, { name: '曲阜市', lng: 116.99 },
        { name: '邹城市', lng: 117.01 }
      ] },
      { name: '泰安市', districts: [
        { name: '泰山区', lng: 117.14 }, { name: '岱岳区', lng: 117.05 }, { name: '新泰市', lng: 117.77 },
        { name: '肥城市', lng: 116.77 }
      ] },
      { name: '威海市', districts: [
        { name: '环翠区', lng: 122.12 }, { name: '文登区', lng: 122.06 }, { name: '荣成市', lng: 122.49 },
        { name: '乳山市', lng: 121.54 }
      ] },
      { name: '日照市', districts: [
        { name: '东港区', lng: 119.46 }, { name: '岚山区', lng: 119.32 }
      ] },
      { name: '临沂市', districts: [
        { name: '兰山区', lng: 118.35 }, { name: '罗庄区', lng: 118.28 }, { name: '河东区', lng: 118.40 }
      ] },
      { name: '德州市', districts: [
        { name: '德城区', lng: 116.30 }, { name: '陵城区', lng: 116.58 }, { name: '乐陵市', lng: 117.23 },
        { name: '禹城市', lng: 116.64 }
      ] },
      { name: '聊城市', districts: [
        { name: '东昌府区', lng: 115.99 }, { name: '茌平区', lng: 116.26 }, { name: '临清市', lng: 115.71 }
      ] },
      { name: '滨州市', districts: [
        { name: '滨城区', lng: 118.02 }, { name: '沾化区', lng: 118.13 }, { name: '邹平市', lng: 117.74 }
      ] },
      { name: '菏泽市', districts: [
        { name: '牡丹区', lng: 115.43 }, { name: '定陶区', lng: 115.57 }
      ] }
    ]
  },
  {
    name: '河南', cities: [
      { name: '郑州市', districts: [
        { name: '中原区', lng: 113.61 }, { name: '二七区', lng: 113.64 }, { name: '管城回族区', lng: 113.68 },
        { name: '金水区', lng: 113.66 }, { name: '上街区', lng: 113.31 }, { name: '惠济区', lng: 113.62 },
        { name: '中牟县', lng: 113.98 }, { name: '巩义市', lng: 113.02 }, { name: '荥阳市', lng: 113.38 },
        { name: '新密市', lng: 113.39 }, { name: '新郑市', lng: 113.74 }, { name: '登封市', lng: 113.05 }
      ] },
      { name: '开封市', districts: [
        { name: '龙亭区', lng: 114.36 }, { name: '顺河回族区', lng: 114.36 }, { name: '鼓楼区', lng: 114.35 },
        { name: '禹王台区', lng: 114.35 }, { name: '祥符区', lng: 114.44 }
      ] },
      { name: '洛阳市', districts: [
        { name: '老城区', lng: 112.47 }, { name: '西工区', lng: 112.43 }, { name: '瀍河回族区', lng: 112.50 },
        { name: '涧西区', lng: 112.40 }, { name: '偃师区', lng: 112.79 }, { name: '孟津区', lng: 112.44 }
      ] },
      { name: '平顶山市', districts: [
        { name: '新华区', lng: 113.29 }, { name: '卫东区', lng: 113.34 }, { name: '舞钢市', lng: 113.52 }
      ] },
      { name: '安阳市', districts: [
        { name: '文峰区', lng: 114.36 }, { name: '北关区', lng: 114.36 }, { name: '林州市', lng: 113.82 }
      ] },
      { name: '鹤壁市', districts: [
        { name: '鹤山区', lng: 114.16 }, { name: '山城区', lng: 114.18 }, { name: '淇滨区', lng: 114.30 }
      ] },
      { name: '新乡市', districts: [
        { name: '红旗区', lng: 113.88 }, { name: '卫滨区', lng: 113.87 }, { name: '凤泉区', lng: 113.91 },
        { name: '牧野区', lng: 113.91 }, { name: '卫辉市', lng: 114.07 }, { name: '辉县市', lng: 113.81 }
      ] },
      { name: '焦作市', districts: [
        { name: '解放区', lng: 113.23 }, { name: '中站区', lng: 113.18 }, { name: '马村区', lng: 113.32 },
        { name: '山阳区', lng: 113.26 }
      ] },
      { name: '濮阳市', districts: [
        { name: '华龙区', lng: 115.07 }
      ] },
      { name: '许昌市', districts: [
        { name: '魏都区', lng: 113.82 }, { name: '建安区', lng: 113.82 }, { name: '禹州市', lng: 113.47 }
      ] },
      { name: '漯河市', districts: [
        { name: '源汇区', lng: 114.01 }, { name: '郾城区', lng: 114.01 }, { name: '召陵区', lng: 114.09 }
      ] },
      { name: '三门峡市', districts: [
        { name: '湖滨区', lng: 111.20 }, { name: '陕州区', lng: 111.10 }, { name: '义马市', lng: 111.87 }
      ] },
      { name: '南阳市', districts: [
        { name: '宛城区', lng: 112.54 }, { name: '卧龙区', lng: 112.53 }, { name: '邓州市', lng: 112.09 }
      ] },
      { name: '商丘市', districts: [
        { name: '梁园区', lng: 115.64 }, { name: '睢阳区', lng: 115.65 }, { name: '永城市', lng: 116.45 }
      ] },
      { name: '信阳市', districts: [
        { name: '浉河区', lng: 114.06 }, { name: '平桥区', lng: 114.12 }
      ] },
      { name: '周口市', districts: [
        { name: '川汇区', lng: 114.64 }, { name: '淮阳区', lng: 114.88 }, { name: '项城市', lng: 114.87 }
      ] },
      { name: '驻马店市', districts: [
        { name: '驿城区', lng: 114.02 }
      ] },
      { name: '济源市', districts: [
        { name: '济源市区', lng: 112.59 }
      ] }
    ]
  },
  {
    name: '湖北', cities: [
      { name: '武汉市', districts: [
        { name: '江岸区', lng: 114.31 }, { name: '江汉区', lng: 114.27 }, { name: '硚口区', lng: 114.26 },
        { name: '汉阳区', lng: 114.27 }, { name: '武昌区', lng: 114.31 }, { name: '青山区', lng: 114.39 },
        { name: '洪山区', lng: 114.34 }, { name: '东西湖区', lng: 114.14 }, { name: '汉南区', lng: 114.08 },
        { name: '蔡甸区', lng: 114.03 }, { name: '江夏区', lng: 114.31 }, { name: '黄陂区', lng: 114.38 },
        { name: '新洲区', lng: 114.80 }
      ] },
      { name: '黄石市', districts: [
        { name: '黄石港区', lng: 115.07 }, { name: '西塞山区', lng: 115.11 }, { name: '下陆区', lng: 114.96 },
        { name: '大冶市', lng: 114.97 }
      ] },
      { name: '十堰市', districts: [
        { name: '茅箭区', lng: 110.82 }, { name: '张湾区', lng: 110.77 }, { name: '丹江口市', lng: 111.51 }
      ] },
      { name: '宜昌市', districts: [
        { name: '西陵区', lng: 111.29 }, { name: '伍家岗区', lng: 111.36 }, { name: '点军区', lng: 111.27 },
        { name: '猇亭区', lng: 111.43 }, { name: '夷陵区', lng: 111.33 }, { name: '宜都市', lng: 111.45 },
        { name: '当阳市', lng: 111.79 }, { name: '枝江市', lng: 111.76 }
      ] },
      { name: '襄阳市', districts: [
        { name: '襄城区', lng: 112.15 }, { name: '樊城区', lng: 112.13 }, { name: '襄州区', lng: 112.15 },
        { name: '枣阳市', lng: 112.76 }, { name: '宜城市', lng: 112.26 }
      ] },
      { name: '鄂州市', districts: [
        { name: '梁子湖区', lng: 114.68 }, { name: '华容区', lng: 114.74 }, { name: '鄂城区', lng: 114.89 }
      ] },
      { name: '荆门市', districts: [
        { name: '东宝区', lng: 112.20 }, { name: '掇刀区', lng: 112.21 }, { name: '钟祥市', lng: 112.59 }
      ] },
      { name: '孝感市', districts: [
        { name: '孝南区', lng: 113.92 }, { name: '应城市', lng: 113.57 }, { name: '安陆市', lng: 113.68 }
      ] },
      { name: '荆州市', districts: [
        { name: '沙市区', lng: 112.25 }, { name: '荆州区', lng: 112.19 }, { name: '石首市', lng: 112.43 },
        { name: '洪湖市', lng: 113.48 }
      ] },
      { name: '黄冈市', districts: [
        { name: '黄州区', lng: 114.88 }, { name: '麻城市', lng: 115.03 }, { name: '武穴市', lng: 115.56 }
      ] },
      { name: '咸宁市', districts: [
        { name: '咸安区', lng: 114.30 }, { name: '赤壁市', lng: 113.90 }
      ] },
      { name: '随州市', districts: [
        { name: '曾都区', lng: 113.37 }, { name: '广水市', lng: 113.83 }
      ] },
      { name: '恩施州', districts: [
        { name: '恩施市', lng: 109.49 }, { name: '利川市', lng: 108.94 }
      ] },
      { name: '仙桃市', districts: [
        { name: '仙桃市区', lng: 113.45 }
      ] },
      { name: '潜江市', districts: [
        { name: '潜江市区', lng: 112.90 }
      ] },
      { name: '天门市', districts: [
        { name: '天门市区', lng: 113.16 }
      ] },
      { name: '神农架林区', districts: [
        { name: '神农架', lng: 110.68 }
      ] }
    ]
  },
  {
    name: '湖南', cities: [
      { name: '长沙市', districts: [
        { name: '芙蓉区', lng: 113.03 }, { name: '天心区', lng: 112.99 }, { name: '岳麓区', lng: 112.94 },
        { name: '开福区', lng: 112.99 }, { name: '雨花区', lng: 113.04 }, { name: '望城区', lng: 112.82 },
        { name: '长沙县', lng: 113.08 }, { name: '浏阳市', lng: 113.63 }, { name: '宁乡市', lng: 112.56 }
      ] },
      { name: '株洲市', districts: [
        { name: '荷塘区', lng: 113.17 }, { name: '芦淞区', lng: 113.15 }, { name: '石峰区', lng: 113.12 },
        { name: '天元区', lng: 113.14 }, { name: '渌口区', lng: 113.13 }, { name: '醴陵市', lng: 113.50 }
      ] },
      { name: '湘潭市', districts: [
        { name: '雨湖区', lng: 112.90 }, { name: '岳塘区', lng: 112.96 }, { name: '湘乡市', lng: 112.55 },
        { name: '韶山市', lng: 112.53 }
      ] },
      { name: '衡阳市', districts: [
        { name: '珠晖区', lng: 112.62 }, { name: '雁峰区', lng: 112.61 }, { name: '石鼓区', lng: 112.61 },
        { name: '蒸湘区', lng: 112.58 }, { name: '南岳区', lng: 112.74 }, { name: '耒阳市', lng: 112.85 },
        { name: '常宁市', lng: 112.40 }
      ] },
      { name: '邵阳市', districts: [
        { name: '双清区', lng: 111.50 }, { name: '大祥区', lng: 111.45 }, { name: '北塔区', lng: 111.45 },
        { name: '武冈市', lng: 110.63 }
      ] },
      { name: '岳阳市', districts: [
        { name: '岳阳楼区', lng: 113.13 }, { name: '云溪区', lng: 113.28 }, { name: '君山区', lng: 113.01 },
        { name: '汨罗市', lng: 113.07 }, { name: '临湘市', lng: 113.45 }
      ] },
      { name: '常德市', districts: [
        { name: '武陵区', lng: 111.69 }, { name: '鼎城区', lng: 111.68 }, { name: '津市市', lng: 111.88 }
      ] },
      { name: '张家界市', districts: [
        { name: '永定区', lng: 110.53 }, { name: '武陵源区', lng: 110.56 }
      ] },
      { name: '益阳市', districts: [
        { name: '资阳区', lng: 112.33 }, { name: '赫山区', lng: 112.37 }, { name: '沅江市', lng: 112.35 }
      ] },
      { name: '郴州市', districts: [
        { name: '北湖区', lng: 113.01 }, { name: '苏仙区', lng: 113.04 }, { name: '资兴市', lng: 113.24 }
      ] },
      { name: '永州市', districts: [
        { name: '零陵区', lng: 111.62 }, { name: '冷水滩区', lng: 111.59 }
      ] },
      { name: '怀化市', districts: [
        { name: '鹤城区', lng: 109.95 }, { name: '洪江市', lng: 109.83 }
      ] },
      { name: '娄底市', districts: [
        { name: '娄星区', lng: 112.00 }, { name: '冷水江市', lng: 111.43 }, { name: '涟源市', lng: 111.67 }
      ] },
      { name: '湘西州', districts: [
        { name: '吉首市', lng: 109.70 }
      ] }
    ]
  },
  {
    name: '广东', cities: [
      { name: '广州市', districts: [
        { name: '荔湾区', lng: 113.24 }, { name: '越秀区', lng: 113.27 }, { name: '海珠区', lng: 113.32 },
        { name: '天河区', lng: 113.36 }, { name: '白云区', lng: 113.27 }, { name: '黄埔区', lng: 113.48 },
        { name: '番禺区', lng: 113.38 }, { name: '花都区', lng: 113.22 }, { name: '南沙区', lng: 113.53 },
        { name: '从化区', lng: 113.59 }, { name: '增城区', lng: 113.83 }
      ] },
      { name: '深圳市', districts: [
        { name: '罗湖区', lng: 114.13 }, { name: '福田区', lng: 114.06 }, { name: '南山区', lng: 113.93 },
        { name: '宝安区', lng: 113.88 }, { name: '龙岗区', lng: 114.25 }, { name: '盐田区', lng: 114.24 },
        { name: '龙华区', lng: 114.04 }, { name: '坪山区', lng: 114.35 }, { name: '光明区', lng: 113.94 },
        { name: '大鹏新区', lng: 114.47 }
      ] },
      { name: '珠海市', districts: [
        { name: '香洲区', lng: 113.55 }, { name: '斗门区', lng: 113.30 }, { name: '金湾区', lng: 113.36 }
      ] },
      { name: '汕头市', districts: [
        { name: '龙湖区', lng: 116.72 }, { name: '金平区', lng: 116.70 }, { name: '濠江区', lng: 116.73 },
        { name: '潮阳区', lng: 116.60 }, { name: '潮南区', lng: 116.44 }, { name: '澄海区', lng: 116.76 }
      ] },
      { name: '佛山市', districts: [
        { name: '禅城区', lng: 113.12 }, { name: '南海区', lng: 113.14 }, { name: '顺德区', lng: 113.29 },
        { name: '三水区', lng: 112.89 }, { name: '高明区', lng: 112.89 }
      ] },
      { name: '韶关市', districts: [
        { name: '武江区', lng: 113.58 }, { name: '浈江区', lng: 113.61 }, { name: '曲江区', lng: 113.60 },
        { name: '乐昌市', lng: 113.35 }
      ] },
      { name: '湛江市', districts: [
        { name: '赤坎区', lng: 110.36 }, { name: '霞山区', lng: 110.39 }, { name: '坡头区', lng: 110.45 },
        { name: '麻章区', lng: 110.33 }, { name: '吴川市', lng: 110.78 }, { name: '廉江市', lng: 110.28 },
        { name: '雷州市', lng: 110.10 }
      ] },
      { name: '肇庆市', districts: [
        { name: '端州区', lng: 112.48 }, { name: '鼎湖区', lng: 112.57 }, { name: '高要区', lng: 112.46 },
        { name: '四会市', lng: 112.74 }
      ] },
      { name: '江门市', districts: [
        { name: '蓬江区', lng: 113.08 }, { name: '江海区', lng: 113.11 }, { name: '新会区', lng: 113.03 },
        { name: '台山市', lng: 112.79 }, { name: '开平市', lng: 112.70 }, { name: '鹤山市', lng: 112.96 }
      ] },
      { name: '茂名市', districts: [
        { name: '茂南区', lng: 110.92 }, { name: '电白区', lng: 111.02 }, { name: '高州市', lng: 110.85 },
        { name: '化州市', lng: 110.64 }, { name: '信宜市', lng: 110.94 }
      ] },
      { name: '惠州市', districts: [
        { name: '惠城区', lng: 114.38 }, { name: '惠阳区', lng: 114.46 }
      ] },
      { name: '梅州市', districts: [
        { name: '梅江区', lng: 116.11 }, { name: '梅县区', lng: 116.10 }, { name: '兴宁市', lng: 115.73 }
      ] },
      { name: '汕尾市', districts: [
        { name: '城区', lng: 115.36 }, { name: '陆丰市', lng: 115.65 }
      ] },
      { name: '河源市', districts: [
        { name: '源城区', lng: 114.70 }
      ] },
      { name: '阳江市', districts: [
        { name: '江城区', lng: 111.95 }, { name: '阳东区', lng: 112.01 }, { name: '阳春市', lng: 111.79 }
      ] },
      { name: '清远市', districts: [
        { name: '清城区', lng: 113.06 }, { name: '清新区', lng: 113.02 }, { name: '英德市', lng: 113.41 },
        { name: '连州市', lng: 112.37 }
      ] },
      { name: '东莞市', districts: [
        { name: '莞城街道', lng: 113.75 }, { name: '南城街道', lng: 113.75 }, { name: '东城街道', lng: 113.78 },
        { name: '万江街道', lng: 113.72 }
      ] },
      { name: '中山市', districts: [
        { name: '石岐区街道', lng: 113.38 }, { name: '东区街道', lng: 113.41 }, { name: '西区街道', lng: 113.38 }
      ] },
      { name: '潮州市', districts: [
        { name: '湘桥区', lng: 116.63 }, { name: '潮安区', lng: 116.68 }
      ] },
      { name: '揭阳市', districts: [
        { name: '榕城区', lng: 116.37 }, { name: '揭东区', lng: 116.41 }, { name: '普宁市', lng: 116.17 }
      ] },
      { name: '云浮市', districts: [
        { name: '云城区', lng: 112.04 }, { name: '罗定市', lng: 111.57 }
      ] }
    ]
  },
  {
    name: '广西', cities: [
      { name: '南宁市', districts: [
        { name: '兴宁区', lng: 108.37 }, { name: '青秀区', lng: 108.49 }, { name: '江南区', lng: 108.27 },
        { name: '西乡塘区', lng: 108.31 }, { name: '良庆区', lng: 108.41 }, { name: '邕宁区', lng: 108.49 }
      ] },
      { name: '柳州市', districts: [
        { name: '城中区', lng: 109.41 }, { name: '鱼峰区', lng: 109.45 }, { name: '柳南区', lng: 109.39 },
        { name: '柳北区', lng: 109.40 }, { name: '柳江区', lng: 109.34 }
      ] },
      { name: '桂林市', districts: [
        { name: '秀峰区', lng: 110.28 }, { name: '叠彩区', lng: 110.30 }, { name: '象山区', lng: 110.28 },
        { name: '七星区', lng: 110.32 }, { name: '雁山区', lng: 110.31 }, { name: '临桂区', lng: 110.21 }
      ] },
      { name: '梧州市', districts: [
        { name: '万秀区', lng: 111.32 }, { name: '长洲区', lng: 111.28 }, { name: '龙圩区', lng: 111.25 },
        { name: '岑溪市', lng: 111.00 }
      ] },
      { name: '北海市', districts: [
        { name: '海城区', lng: 109.12 }, { name: '银海区', lng: 109.14 }, { name: '铁山港区', lng: 109.48 }
      ] },
      { name: '防城港市', districts: [
        { name: '港口区', lng: 108.38 }, { name: '防城区', lng: 108.35 }, { name: '东兴市', lng: 107.97 }
      ] },
      { name: '钦州市', districts: [
        { name: '钦南区', lng: 108.66 }, { name: '钦北区', lng: 108.63 }
      ] },
      { name: '贵港市', districts: [
        { name: '港北区', lng: 109.57 }, { name: '港南区', lng: 109.60 }, { name: '桂平市', lng: 110.08 }
      ] },
      { name: '玉林市', districts: [
        { name: '玉州区', lng: 110.15 }, { name: '福绵区', lng: 110.06 }, { name: '北流市', lng: 110.35 }
      ] },
      { name: '百色市', districts: [
        { name: '右江区', lng: 106.62 }, { name: '平果市', lng: 107.59 }
      ] },
      { name: '贺州市', districts: [
        { name: '八步区', lng: 111.55 }, { name: '平桂区', lng: 111.48 }
      ] },
      { name: '河池市', districts: [
        { name: '金城江区', lng: 108.04 }, { name: '宜州区', lng: 108.65 }
      ] },
      { name: '来宾市', districts: [
        { name: '兴宾区', lng: 109.22 }, { name: '合山市', lng: 108.88 }
      ] },
      { name: '崇左市', districts: [
        { name: '江州区', lng: 107.35 }, { name: '凭祥市', lng: 106.77 }
      ] }
    ]
  },
  {
    name: '海南', cities: [
      { name: '海口市', districts: [
        { name: '秀英区', lng: 110.29 }, { name: '龙华区', lng: 110.33 }, { name: '琼山区', lng: 110.35 },
        { name: '美兰区', lng: 110.37 }
      ] },
      { name: '三亚市', districts: [
        { name: '海棠区', lng: 109.75 }, { name: '吉阳区', lng: 109.58 }, { name: '天涯区', lng: 109.48 },
        { name: '崖州区', lng: 109.18 }
      ] },
      { name: '三沙市', districts: [
        { name: '西沙区', lng: 112.34 }, { name: '南沙区', lng: 116.00 }
      ] },
      { name: '儋州市', districts: [
        { name: '那大镇', lng: 109.58 }
      ] },
      { name: '其他市县', districts: [
        { name: '五指山市', lng: 109.52 }, { name: '琼海市', lng: 110.47 }, { name: '文昌市', lng: 110.80 },
        { name: '万宁市', lng: 110.39 }, { name: '东方市', lng: 108.65 }, { name: '定安县', lng: 110.32 },
        { name: '屯昌县', lng: 110.10 }, { name: '澄迈县', lng: 110.01 }, { name: '临高县', lng: 109.69 },
        { name: '白沙县', lng: 109.45 }, { name: '昌江县', lng: 109.05 }, { name: '乐东县', lng: 109.17 },
        { name: '陵水县', lng: 109.99 }, { name: '保亭县', lng: 109.71 }, { name: '琼中县', lng: 109.84 }
      ] }
    ]
  },
  {
    name: '重庆', cities: [
      { name: '重庆市', districts: [
        { name: '渝中区', lng: 106.57 }, { name: '大渡口区', lng: 106.48 }, { name: '江北区', lng: 106.57 },
        { name: '沙坪坝区', lng: 106.46 }, { name: '九龙坡区', lng: 106.51 }, { name: '南岸区', lng: 106.56 },
        { name: '北碚区', lng: 106.44 }, { name: '渝北区', lng: 106.63 }, { name: '巴南区', lng: 106.52 },
        { name: '万州区', lng: 108.41 }, { name: '涪陵区', lng: 107.39 }, { name: '綦江区', lng: 106.65 },
        { name: '大足区', lng: 105.72 }, { name: '黔江区', lng: 108.77 }, { name: '长寿区', lng: 107.08 },
        { name: '江津区', lng: 106.26 }, { name: '合川区', lng: 106.28 }, { name: '永川区', lng: 105.93 },
        { name: '南川区', lng: 107.10 }, { name: '璧山区', lng: 106.23 }, { name: '铜梁区', lng: 106.06 },
        { name: '潼南区', lng: 105.84 }, { name: '荣昌区', lng: 105.59 }, { name: '开州区', lng: 108.39 },
        { name: '梁平区', lng: 107.80 }, { name: '武隆区', lng: 107.76 }
      ] }
    ]
  },
  {
    name: '四川', cities: [
      { name: '成都市', districts: [
        { name: '锦江区', lng: 104.08 }, { name: '青羊区', lng: 104.06 }, { name: '金牛区', lng: 104.05 },
        { name: '武侯区', lng: 104.04 }, { name: '成华区', lng: 104.10 }, { name: '龙泉驿区', lng: 104.27 },
        { name: '青白江区', lng: 104.25 }, { name: '新都区', lng: 104.16 }, { name: '温江区', lng: 103.84 },
        { name: '双流区', lng: 103.93 }, { name: '郫都区', lng: 103.89 }, { name: '都江堰市', lng: 103.62 },
        { name: '彭州市', lng: 103.96 }, { name: '邛崃市', lng: 103.46 }, { name: '崇州市', lng: 103.67 },
        { name: '简阳市', lng: 104.55 }
      ] },
      { name: '自贡市', districts: [
        { name: '自流井区', lng: 104.77 }, { name: '贡井区', lng: 104.72 }, { name: '大安区', lng: 104.77 }
      ] },
      { name: '攀枝花市', districts: [
        { name: '东区', lng: 101.70 }, { name: '西区', lng: 101.63 }
      ] },
      { name: '泸州市', districts: [
        { name: '江阳区', lng: 105.44 }, { name: '纳溪区', lng: 105.38 }, { name: '龙马潭区', lng: 105.44 }
      ] },
      { name: '德阳市', districts: [
        { name: '旌阳区', lng: 104.40 }, { name: '罗江区', lng: 104.51 }, { name: '广汉市', lng: 104.28 },
        { name: '绵竹市', lng: 104.22 }
      ] },
      { name: '绵阳市', districts: [
        { name: '涪城区', lng: 104.76 }, { name: '游仙区', lng: 104.77 }, { name: '安州区', lng: 104.57 },
        { name: '江油市', lng: 104.75 }
      ] },
      { name: '广元市', districts: [
        { name: '利州区', lng: 105.84 }, { name: '昭化区', lng: 105.57 }
      ] },
      { name: '遂宁市', districts: [
        { name: '船山区', lng: 105.57 }, { name: '安居区', lng: 105.46 }
      ] },
      { name: '内江市', districts: [
        { name: '市中区', lng: 105.07 }, { name: '东兴区', lng: 105.08 }
      ] },
      { name: '乐山市', districts: [
        { name: '市中区', lng: 103.76 }, { name: '沙湾区', lng: 103.55 }, { name: '峨眉山市', lng: 103.48 }
      ] },
      { name: '南充市', districts: [
        { name: '顺庆区', lng: 106.09 }, { name: '高坪区', lng: 106.12 }, { name: '嘉陵区', lng: 106.07 },
        { name: '阆中市', lng: 106.00 }
      ] },
      { name: '眉山市', districts: [
        { name: '东坡区', lng: 103.83 }, { name: '彭山区', lng: 103.88 }
      ] },
      { name: '宜宾市', districts: [
        { name: '翠屏区', lng: 104.62 }, { name: '南溪区', lng: 104.98 }
      ] },
      { name: '广安市', districts: [
        { name: '广安区', lng: 106.64 }, { name: '前锋区', lng: 106.89 }, { name: '华蓥市', lng: 106.78 }
      ] },
      { name: '达州市', districts: [
        { name: '通川区', lng: 107.50 }, { name: '达川区', lng: 107.51 }, { name: '万源市', lng: 108.04 }
      ] },
      { name: '雅安市', districts: [
        { name: '雨城区', lng: 103.03 }, { name: '名山区', lng: 103.11 }
      ] },
      { name: '巴中市', districts: [
        { name: '巴州区', lng: 106.77 }, { name: '恩阳区', lng: 106.65 }
      ] },
      { name: '资阳市', districts: [
        { name: '雁江区', lng: 104.68 }
      ] },
      { name: '阿坝州', districts: [
        { name: '马尔康市', lng: 102.21 }, { name: '九寨沟县', lng: 104.24 }
      ] },
      { name: '甘孜州', districts: [
        { name: '康定市', lng: 101.96 }, { name: '稻城县', lng: 100.30 }
      ] },
      { name: '凉山州', districts: [
        { name: '西昌市', lng: 102.26 }, { name: '会理市', lng: 102.24 }
      ] }
    ]
  },
  {
    name: '贵州', cities: [
      { name: '贵阳市', districts: [
        { name: '南明区', lng: 106.71 }, { name: '云岩区', lng: 106.72 }, { name: '花溪区', lng: 106.67 },
        { name: '乌当区', lng: 106.75 }, { name: '白云区', lng: 106.63 }, { name: '观山湖区', lng: 106.63 },
        { name: '清镇市', lng: 106.47 }
      ] },
      { name: '六盘水市', districts: [
        { name: '钟山区', lng: 104.88 }, { name: '六枝特区', lng: 105.48 }, { name: '盘州市', lng: 104.47 }
      ] },
      { name: '遵义市', districts: [
        { name: '红花岗区', lng: 106.89 }, { name: '汇川区', lng: 106.94 }, { name: '播州区', lng: 106.83 },
        { name: '仁怀市', lng: 106.41 }, { name: '赤水市', lng: 105.70 }
      ] },
      { name: '安顺市', districts: [
        { name: '西秀区', lng: 105.96 }, { name: '平坝区', lng: 106.26 }
      ] },
      { name: '毕节市', districts: [
        { name: '七星关区', lng: 105.29 }, { name: '大方县', lng: 105.61 }, { name: '黔西市', lng: 106.04 }
      ] },
      { name: '铜仁市', districts: [
        { name: '碧江区', lng: 109.18 }, { name: '万山区', lng: 109.21 }
      ] },
      { name: '黔西南州', districts: [
        { name: '兴义市', lng: 104.90 }, { name: '兴仁市', lng: 105.19 }
      ] },
      { name: '黔东南州', districts: [
        { name: '凯里市', lng: 107.98 }
      ] },
      { name: '黔南州', districts: [
        { name: '都匀市', lng: 107.52 }, { name: '福泉市', lng: 107.51 }
      ] }
    ]
  },
  {
    name: '云南', cities: [
      { name: '昆明市', districts: [
        { name: '五华区', lng: 102.71 }, { name: '盘龙区', lng: 102.72 }, { name: '官渡区', lng: 102.74 },
        { name: '西山区', lng: 102.66 }, { name: '东川区', lng: 103.19 }, { name: '呈贡区', lng: 102.80 },
        { name: '晋宁区', lng: 102.59 }, { name: '安宁市', lng: 102.48 }
      ] },
      { name: '曲靖市', districts: [
        { name: '麒麟区', lng: 103.80 }, { name: '沾益区', lng: 103.82 }, { name: '宣威市', lng: 104.10 }
      ] },
      { name: '玉溪市', districts: [
        { name: '红塔区', lng: 102.54 }, { name: '江川区', lng: 102.75 }
      ] },
      { name: '保山市', districts: [
        { name: '隆阳区', lng: 99.16 }, { name: '腾冲市', lng: 98.49 }
      ] },
      { name: '昭通市', districts: [
        { name: '昭阳区', lng: 103.72 }, { name: '鲁甸县', lng: 103.55 }
      ] },
      { name: '丽江市', districts: [
        { name: '古城区', lng: 100.23 }, { name: '玉龙县', lng: 100.24 }
      ] },
      { name: '普洱市', districts: [
        { name: '思茅区', lng: 100.98 }
      ] },
      { name: '临沧市', districts: [
        { name: '临翔区', lng: 100.08 }
      ] },
      { name: '楚雄州', districts: [
        { name: '楚雄市', lng: 101.55 }, { name: '禄丰市', lng: 102.08 }
      ] },
      { name: '红河州', districts: [
        { name: '蒙自市', lng: 103.41 }, { name: '个旧市', lng: 103.16 }, { name: '开远市', lng: 103.27 }
      ] },
      { name: '文山州', districts: [
        { name: '文山市', lng: 104.24 }
      ] },
      { name: '西双版纳州', districts: [
        { name: '景洪市', lng: 100.80 }
      ] },
      { name: '大理州', districts: [
        { name: '大理市', lng: 100.23 }
      ] },
      { name: '德宏州', districts: [
        { name: '芒市', lng: 98.58 }, { name: '瑞丽市', lng: 97.85 }
      ] },
      { name: '怒江州', districts: [
        { name: '泸水市', lng: 98.86 }
      ] },
      { name: '迪庆州', districts: [
        { name: '香格里拉市', lng: 99.71 }
      ] }
    ]
  },
  {
    name: '西藏', cities: [
      { name: '拉萨市', districts: [
        { name: '城关区', lng: 91.13 }, { name: '堆龙德庆区', lng: 91.00 }, { name: '达孜区', lng: 91.36 }
      ] },
      { name: '日喀则市', districts: [
        { name: '桑珠孜区', lng: 88.88 }
      ] },
      { name: '昌都市', districts: [
        { name: '卡若区', lng: 97.18 }
      ] },
      { name: '林芝市', districts: [
        { name: '巴宜区', lng: 94.36 }
      ] },
      { name: '山南市', districts: [
        { name: '乃东区', lng: 91.77 }
      ] },
      { name: '那曲市', districts: [
        { name: '色尼区', lng: 92.05 }
      ] },
      { name: '阿里地区', districts: [
        { name: '噶尔县', lng: 80.10 }
      ] }
    ]
  },
  {
    name: '陕西', cities: [
      { name: '西安市', districts: [
        { name: '新城区', lng: 108.96 }, { name: '碑林区', lng: 108.93 }, { name: '莲湖区', lng: 108.94 },
        { name: '灞桥区', lng: 109.07 }, { name: '未央区', lng: 108.95 }, { name: '雁塔区', lng: 108.95 },
        { name: '阎良区', lng: 109.23 }, { name: '临潼区', lng: 109.21 }, { name: '长安区', lng: 108.91 },
        { name: '高陵区', lng: 109.09 }, { name: '鄠邑区', lng: 108.61 }
      ] },
      { name: '铜川市', districts: [
        { name: '王益区', lng: 109.08 }, { name: '印台区', lng: 109.10 }, { name: '耀州区', lng: 108.98 }
      ] },
      { name: '宝鸡市', districts: [
        { name: '渭滨区', lng: 107.15 }, { name: '金台区', lng: 107.15 }, { name: '陈仓区', lng: 107.39 }
      ] },
      { name: '咸阳市', districts: [
        { name: '秦都区', lng: 108.71 }, { name: '杨陵区', lng: 108.08 }, { name: '渭城区', lng: 108.74 },
        { name: '兴平市', lng: 108.49 }, { name: '彬州市', lng: 108.08 }
      ] },
      { name: '渭南市', districts: [
        { name: '临渭区', lng: 109.50 }, { name: '华州区', lng: 109.77 }, { name: '韩城市', lng: 110.45 },
        { name: '华阴市', lng: 110.08 }
      ] },
      { name: '延安市', districts: [
        { name: '宝塔区', lng: 109.49 }, { name: '安塞区', lng: 109.33 }, { name: '子长市', lng: 109.67 }
      ] },
      { name: '汉中市', districts: [
        { name: '汉台区', lng: 107.03 }, { name: '南郑区', lng: 106.94 }
      ] },
      { name: '榆林市', districts: [
        { name: '榆阳区', lng: 109.73 }, { name: '横山区', lng: 109.30 }, { name: '神木市', lng: 110.50 }
      ] },
      { name: '安康市', districts: [
        { name: '汉滨区', lng: 109.03 }
      ] },
      { name: '商洛市', districts: [
        { name: '商州区', lng: 109.94 }
      ] }
    ]
  },
  {
    name: '甘肃', cities: [
      { name: '兰州市', districts: [
        { name: '城关区', lng: 103.83 }, { name: '七里河区', lng: 103.79 }, { name: '西固区', lng: 103.62 },
        { name: '安宁区', lng: 103.72 }, { name: '红古区', lng: 102.86 }
      ] },
      { name: '嘉峪关市', districts: [
        { name: '嘉峪关市区', lng: 98.29 }
      ] },
      { name: '金昌市', districts: [
        { name: '金川区', lng: 102.19 }
      ] },
      { name: '白银市', districts: [
        { name: '白银区', lng: 104.17 }, { name: '平川区', lng: 104.83 }
      ] },
      { name: '天水市', districts: [
        { name: '秦州区', lng: 105.72 }, { name: '麦积区', lng: 105.89 }
      ] },
      { name: '武威市', districts: [
        { name: '凉州区', lng: 102.64 }
      ] },
      { name: '张掖市', districts: [
        { name: '甘州区', lng: 100.45 }
      ] },
      { name: '平凉市', districts: [
        { name: '崆峒区', lng: 106.67 }, { name: '华亭市', lng: 106.65 }
      ] },
      { name: '酒泉市', districts: [
        { name: '肃州区', lng: 98.51 }, { name: '玉门市', lng: 97.05 }, { name: '敦煌市', lng: 94.66 }
      ] },
      { name: '庆阳市', districts: [
        { name: '西峰区', lng: 107.65 }
      ] },
      { name: '定西市', districts: [
        { name: '安定区', lng: 104.61 }
      ] },
      { name: '陇南市', districts: [
        { name: '武都区', lng: 104.93 }
      ] },
      { name: '临夏州', districts: [
        { name: '临夏市', lng: 103.21 }
      ] },
      { name: '甘南州', districts: [
        { name: '合作市', lng: 102.91 }
      ] }
    ]
  },
  {
    name: '青海', cities: [
      { name: '西宁市', districts: [
        { name: '城东区', lng: 101.81 }, { name: '城中区', lng: 101.78 }, { name: '城西区', lng: 101.76 },
        { name: '城北区', lng: 101.76 }
      ] },
      { name: '海东市', districts: [
        { name: '乐都区', lng: 102.40 }, { name: '平安区', lng: 102.11 }
      ] },
      { name: '海北州', districts: [
        { name: '海晏县', lng: 100.99 }
      ] },
      { name: '黄南州', districts: [
        { name: '同仁市', lng: 102.02 }
      ] },
      { name: '海南州', districts: [
        { name: '共和县', lng: 100.62 }
      ] },
      { name: '果洛州', districts: [
        { name: '玛沁县', lng: 100.24 }
      ] },
      { name: '玉树州', districts: [
        { name: '玉树市', lng: 97.01 }
      ] },
      { name: '海西州', districts: [
        { name: '德令哈市', lng: 97.36 }, { name: '格尔木市', lng: 94.90 }
      ] }
    ]
  },
  {
    name: '宁夏', cities: [
      { name: '银川市', districts: [
        { name: '兴庆区', lng: 106.29 }, { name: '西夏区', lng: 106.15 }, { name: '金凤区', lng: 106.24 },
        { name: '灵武市', lng: 106.34 }
      ] },
      { name: '石嘴山市', districts: [
        { name: '大武口区', lng: 106.38 }, { name: '惠农区', lng: 106.78 }
      ] },
      { name: '吴忠市', districts: [
        { name: '利通区', lng: 106.20 }, { name: '红寺堡区', lng: 106.20 }, { name: '青铜峡市', lng: 106.07 }
      ] },
      { name: '固原市', districts: [
        { name: '原州区', lng: 106.28 }
      ] },
      { name: '中卫市', districts: [
        { name: '沙坡头区', lng: 105.19 }
      ] }
    ]
  },
  {
    name: '新疆', cities: [
      { name: '乌鲁木齐市', districts: [
        { name: '天山区', lng: 87.63 }, { name: '沙依巴克区', lng: 87.60 }, { name: '新市区', lng: 87.57 },
        { name: '水磨沟区', lng: 87.64 }, { name: '头屯河区', lng: 87.29 }, { name: '达坂城区', lng: 88.31 },
        { name: '米东区', lng: 87.69 }
      ] },
      { name: '克拉玛依市', districts: [
        { name: '克拉玛依区', lng: 84.87 }, { name: '独山子区', lng: 84.89 }
      ] },
      { name: '吐鲁番市', districts: [
        { name: '高昌区', lng: 89.19 }
      ] },
      { name: '哈密市', districts: [
        { name: '伊州区', lng: 93.51 }
      ] },
      { name: '昌吉州', districts: [
        { name: '昌吉市', lng: 87.30 }, { name: '阜康市', lng: 87.99 }
      ] },
      { name: '博尔塔拉州', districts: [
        { name: '博乐市', lng: 82.07 }
      ] },
      { name: '巴音郭楞州', districts: [
        { name: '库尔勒市', lng: 86.15 }
      ] },
      { name: '阿克苏地区', districts: [
        { name: '阿克苏市', lng: 80.27 }
      ] },
      { name: '克孜勒苏州', districts: [
        { name: '阿图什市', lng: 76.17 }
      ] },
      { name: '喀什地区', districts: [
        { name: '喀什市', lng: 75.99 }
      ] },
      { name: '和田地区', districts: [
        { name: '和田市', lng: 79.92 }
      ] },
      { name: '伊犁州', districts: [
        { name: '伊宁市', lng: 81.33 }, { name: '奎屯市', lng: 84.90 }
      ] },
      { name: '塔城地区', districts: [
        { name: '塔城市', lng: 82.99 }
      ] },
      { name: '阿勒泰地区', districts: [
        { name: '阿勒泰市', lng: 88.14 }
      ] },
      { name: '直辖县级市', districts: [
        { name: '石河子市', lng: 86.04 }, { name: '阿拉尔市', lng: 81.28 }, { name: '图木舒克市', lng: 79.13 },
        { name: '五家渠市', lng: 87.54 }, { name: '北屯市', lng: 87.81 }, { name: '铁门关市', lng: 85.67 },
        { name: '双河市', lng: 82.35 }, { name: '可克达拉市', lng: 81.05 }, { name: '昆玉市', lng: 79.29 }
      ] }
    ]
  },
  {
    name: '香港', cities: [
      { name: '香港', districts: [
        { name: '中西区', lng: 114.15 }, { name: '湾仔区', lng: 114.17 }, { name: '东区', lng: 114.22 },
        { name: '南区', lng: 114.16 }, { name: '油尖旺区', lng: 114.17 }, { name: '深水埗区', lng: 114.16 },
        { name: '九龙城区', lng: 114.19 }, { name: '黄大仙区', lng: 114.20 }, { name: '观塘区', lng: 114.23 },
        { name: '荃湾区', lng: 114.12 }, { name: '屯门区', lng: 113.97 }, { name: '元朗区', lng: 114.03 },
        { name: '北区', lng: 114.15 }, { name: '大埔区', lng: 114.16 }, { name: '西贡区', lng: 114.27 },
        { name: '沙田区', lng: 114.19 }, { name: '葵青区', lng: 114.14 }, { name: '离岛区', lng: 113.95 }
      ] }
    ]
  },
  {
    name: '澳门', cities: [
      { name: '澳门', districts: [
        { name: '花地玛堂区', lng: 113.55 }, { name: '圣安多尼堂区', lng: 113.55 }, { name: '大堂区', lng: 113.55 },
        { name: '望德堂区', lng: 113.55 }, { name: '风顺堂区', lng: 113.54 }, { name: '嘉模堂区', lng: 113.57 },
        { name: '圣方济各堂区', lng: 113.56 }, { name: '路氹城', lng: 113.57 }
      ] }
    ]
  },
  {
    name: '台湾', cities: [
      { name: '台北市', districts: [
        { name: '中正区', lng: 121.52 }, { name: '大同区', lng: 121.52 }, { name: '中山区', lng: 121.53 },
        { name: '松山区', lng: 121.58 }, { name: '大安区', lng: 121.54 }, { name: '万华区', lng: 121.50 },
        { name: '信义区', lng: 121.57 }, { name: '士林区', lng: 121.53 }, { name: '北投区', lng: 121.50 },
        { name: '内湖区', lng: 121.59 }, { name: '南港区', lng: 121.61 }, { name: '文山区', lng: 121.57 }
      ] },
      { name: '新北市', districts: [
        { name: '板桥区', lng: 121.46 }, { name: '三重区', lng: 121.49 }, { name: '中和区', lng: 121.50 },
        { name: '永和区', lng: 121.51 }, { name: '新庄区', lng: 121.45 }, { name: '新店区', lng: 121.54 }
      ] },
      { name: '桃园市', districts: [
        { name: '桃园区', lng: 121.31 }, { name: '中坜区', lng: 121.22 }, { name: '平镇区', lng: 121.22 }
      ] },
      { name: '台中市', districts: [
        { name: '中区', lng: 120.68 }, { name: '东区', lng: 120.69 }, { name: '南区', lng: 120.66 },
        { name: '西区', lng: 120.66 }, { name: '北区', lng: 120.68 }
      ] },
      { name: '台南市', districts: [
        { name: '中西区', lng: 120.20 }, { name: '东区', lng: 120.22 }, { name: '南区', lng: 120.20 }
      ] },
      { name: '高雄市', districts: [
        { name: '楠梓区', lng: 120.33 }, { name: '左营区', lng: 120.30 }, { name: '鼓山区', lng: 120.28 },
        { name: '三民区', lng: 120.30 }, { name: '盐埕区', lng: 120.28 }, { name: '前金区', lng: 120.29 }
      ] },
      { name: '其他县市', districts: [
        { name: '基隆市', lng: 121.75 }, { name: '新竹市', lng: 120.97 }, { name: '嘉义市', lng: 120.45 },
        { name: '新竹县', lng: 121.02 }, { name: '苗栗县', lng: 120.82 }, { name: '彰化县', lng: 120.54 },
        { name: '南投县', lng: 120.69 }, { name: '云林县', lng: 120.54 }, { name: '嘉义县', lng: 120.30 },
        { name: '屏东县', lng: 120.49 }, { name: '宜兰县', lng: 121.75 }, { name: '花莲县', lng: 121.61 },
        { name: '台东县', lng: 121.15 }, { name: '澎湖县', lng: 119.57 }, { name: '金门县', lng: 118.32 },
        { name: '连江县', lng: 119.95 }
      ] }
    ]
  }
];

// 根据省/市/县区名称查找经度
function getLongitudeByRegion(provinceName, cityName, districtName) {
  const province = CHINA_REGIONS.find(p => p.name === provinceName);
  if (!province) return null;
  const city = province.cities.find(c => c.name === cityName);
  if (!city) return null;
  const district = city.districts.find(d => d.name === districtName);
  if (!district) return null;
  return district.lng;
}
