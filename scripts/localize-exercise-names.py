#!/usr/bin/env python3
"""Give every bundled exercise a concise Chinese display name.

This is a terminology transliterator, not a general translation model. Exercise names keep a
stable English original next to the Chinese label, so uncommon variations remain identifiable.
"""
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'exercises.json'

OVERRIDES = {
    'skin the cat': '猫式翻越',
    'world greatest stretch': '世界最伟大拉伸',
    'butterfly yoga pose': '蝴蝶式瑜伽',
    'potty squat': '蹲便式深蹲',
    'prisoner half sit-up': '抱头半程仰卧起坐',
    'captains chair straight leg raise': '队长椅直腿举腿',
    'stalder press': '斯托德推举',
    'maltese': '马耳他十字',
    'svend press': '斯文德推胸',
    'tate press': '泰特推举',
    'bradford rocky press': '布拉德福德推举',
    'zottman curl': '佐特曼弯举',
    'zercher squat': '泽奇深蹲',
    'hack squat': '哈克深蹲',
    'sissy squat': '西西深蹲',
    'pistol squat': '手枪深蹲',
    'cossack squat': '哥萨克深蹲',
    'curtsey squat': '屈膝礼深蹲',
    'donkey kick': '驴踢',
    'donkey calf raise': '驴式提踵',
    'good morning': '早安式',
    'superman': '超人式',
    'burpee': '波比跳',
    'inchworm': '尺蠖爬行',
    'bear crawl': '熊爬',
    'crab walk': '蟹行',
    'mountain climber': '登山跑',
    'battling ropes': '战绳',
    'tire flip': '轮胎翻转',
    'farmers walk': '农夫行走',
    'windmill': '风车',
    'turkish get-up': '土耳其起身',
    'turkish get up': '土耳其起身',
    'clean and press': '翻站推举',
    'muscle-up': '双力臂',
    'l-sit': 'L 型坐',
    'v-sit': 'V 型坐',
    'london bridge': '伦敦桥',
    'frankenstein squat': '弗兰肯斯坦深蹲',
    'gironda sternum chin': '吉隆达胸骨反手引体',
    'otis up': '奥蒂斯起身',
    'iron cross': '铁十字',
    'janda sit-up': '扬达仰卧起坐',
    'russian twist': '俄罗斯转体',
    'v-up': 'V 字两头起',
    'jackknife sit-up': '折刀仰卧起坐',
    'star jump': '星星跳',
    'broad jump': '立定跳远',
    'jump squat': '深蹲跳',
    'squat jump': '深蹲跳',
    'box jump': '跳箱',
    'step-up': '登台阶',
    'bear crawl': '熊爬',
    'world greatest stretch': '世界最伟大拉伸',
    'bulgarian split squat': '保加利亚分腿蹲',
    'dumbbell lying extension (across face)': '哑铃仰卧跨脸臂屈伸',
    'exercise ball': '健身球',
    'bosu ball': '波速球',
    'stability ball': '瑞士球',
    'semi squat': '半蹲',
    'all fours': '四点支撑',
    'iron cross stretch': '铁十字拉伸',
    'dumbbell incline breeding': '哑铃上斜推举',
    'spell caster': '施法者式',
    'left hook. boxing': '左勾拳（拳击）',
    'all fours squad stretch': '四点支撑深蹲拉伸',
    'dumbbell peacher hammer curl': '哑铃牧师凳锤式弯举',
    'sled closer hack squat': '倒蹬机窄距哈克深蹲',
    'hug keens to chest': '抱膝至胸',
    'kettlebell pirate supper legs': '壶铃海盗式抬腿',
    'medicine ball catch and overhead throw': '药球接球过头抛球',
    'medicine ball chest push single response': '药球胸前推（单人反应）',
    'medicine ball chest push multiple response': '药球胸前推（多人反应）',
    'dumbbell bicep curl lunge with bowling motion': '哑铃弯举箭步蹲（保龄球摆臂）',
    'arm slingers hanging bent knee legs': '悬垂屈膝摆腿',
    'arm slingers hanging straight legs': '悬垂直腿摆腿',
    'alternate heel touchers': '交替脚跟触地',
    'hands clasped circular toe touch': '扣手画圈触脚',
    'hands reversed clasped circular toe touch': '反手扣手画圈触脚',
    'hands reversed clasped circular toe touch (male)': '反手扣手画圈触脚',
    'barbell lying lifting (on hip)': '杠铃仰卧髋部上抬',
    'exercise ball alternating arm ups': '健身球交替抬臂',
    'exercise ball hug': '抱健身球',
    'dumbbell standing around world': '站姿哑铃绕世界',
    'isometric wipers': '等长雨刷式',
    'jack jump (male)': '开合跳',
    'star jump (male)': '星式跳',
    'semi squat jump (male)': '半蹲跳',
    'bodyweight drop jump squat': '自重落地深蹲跳',
    'drop push up': '落差俯卧撑',
    'weighted drop push up': '负重落差俯卧撑',
    'modified hindu push-up (male)': '改良印度式俯卧撑',
    'upward facing dog': '上犬式',
    'runners stretch': '跑者拉伸',
    'rocking frog stretch': '摇摆蛙式拉伸',
    'cable cross-over variation': '绳索交叉变式',
    'one arm slam (with medicine ball)': '单臂药球砸球',
    'medicine ball overhead slam': '药球过头砸球',
    'impossible dips': '极限双杠臂屈伸',
    'korean dips': '韩式双杠臂屈伸',
    'ring dips': '吊环臂屈伸',
    'sledge hammer': '大锤挥击',
    'flag': '人体旗式',
    'cocoons': '蚕茧式卷腹',
    'walk elliptical cross trainer': '椭圆机行走',
    'cycle cross trainer': '椭圆机骑行',
    'ski ergometer': '滑雪功率车',
    'run (equipment)': '跑步机跑',
    'walking on stepmill': '登楼机行走',
    'walking on incline treadmill': '上斜跑步机行走',
    'stationary bike run v. 3': '固定单车骑行变式3',
    'stationary bike walk': '固定单车慢骑',
    'landmine 180': '地雷管 180° 转体',
    'wind sprints': '冲刺跑',
    'assisted seated pectoralis major stretch with stability ball': '瑞士球辅助坐姿胸大肌拉伸',
    'roller seated shoulder flexor depresor retractor': '跪坐健腹轮肩屈肌下压肌回缩',
    'roller seated single leg shoulder flexor depresor retractor': '跪坐单腿健腹轮肩屈肌下压肌回缩',
    'suspended abdominal fallout': '悬吊腹肌滑出',
    'hug keens to chest': '抱膝至胸',
    'pelvic tilt into bridge': '骨盆后倾接臀桥',
    'one arm slam (with medicine ball)': '单臂药球砸球',
    'barbell lying triceps extension skull crusher': '杠铃仰卧碎颅式臂屈伸',
    'sled 45° leg press (side pov)': '倒蹬机 45° 腿举',
    'barbell full squat': '杠铃深蹲',
    'weighted front plank': '负重平板支撑',
}

# Longest phrases are replaced first. Only terminology, never full sentences.
PHRASES = {
    'resistance band': '弹力带',
    'ez barbell': '曲杆',
    'ez-bar': '曲杆',
    'sz-bar': '曲杆',
    'olympic barbell': '奥杠',
    'trap bar': '六角杠',
    'smith machine': '史密斯机',
    'leverage machine': '器械',
    'sled machine': '倒蹬机',
    'body weight': '自重',
    'body-weight': '自重',
    'medicine ball': '药球',
    'stability ball': '瑞士球',
    'exercise ball': '健身球',
    'bosu ball': '波速球',
    'wheel roller': '健腹轮',
    'ab wheel': '健腹轮',
    'arm blaster': '臂托',
    'lat pulldown': '高位下拉',
    'lat pull-down': '高位下拉',
    'full range of motion': '全幅度',
    'range of motion': '活动幅度',
    'close-grip': '窄距',
    'close grip': '窄距',
    'wide-grip': '宽距',
    'wide grip': '宽距',
    'reverse-grip': '反握',
    'reverse grip': '反握',
    'pronate-grip': '正握',
    'neutral grip': '对握',
    'parallel grip': '对握',
    'bent-over': '俯身',
    'bent over': '俯身',
    'one arm': '单臂',
    'one-arm': '单臂',
    'one leg': '单腿',
    'one-leg': '单腿',
    'single arm': '单臂',
    'single leg': '单腿',
    'two arm': '双臂',
    'two legs': '双腿',
    'high bar': '高杠',
    'low bar': '低杠',
    'good morning': '早安式',
    'push-up': '俯卧撑',
    'push up': '俯卧撑',
    'pull-up': '引体向上',
    'pull up': '引体向上',
    'chin-up': '反手引体向上',
    'chin up': '反手引体向上',
    'sit-up': '仰卧起坐',
    'sit up': '仰卧起坐',
    'step-up': '登台阶',
    'step up': '登台阶',
    'box jump': '跳箱',
    'jump squat': '深蹲跳',
    'squat jump': '深蹲跳',
    'mountain climber': '登山跑',
    'battling ropes': '战绳',
    'farmers walk': '农夫行走',
    'waiter walk': '侍者行走',
    'tire flip': '轮胎翻转',
    'clean and press': '翻站推举',
    'clean-grip': '翻握',
    'turkish get-up': '土耳其起身',
    'turkish get up': '土耳其起身',
    'thin bar': '细杆',
    'pro lat bar': '宽距下拉杆',
    'rope attachment': '绳索把手',
    'v-bar': 'V 型把手',
    'with rope': '绳索',
    'with towel': '毛巾',
    'with arm blaster': '臂托',
    'on stability ball': '（瑞士球）',
    'on exercise ball': '（健身球）',
    'on bench': '（凳上）',
    'on knees': '跪姿',
    'against wall': '靠墙',
    'all fours': '四点支撑',
    'brazilian': '巴西式',
    'narrow stance': '窄站距',
    'wide stance': '宽站距',
    'shoulder width': '与肩同宽',
    'side-to-side': '左右',
    'bottoms-up': '底部朝上',
    'two-one': '二比一',
    'up-down': '上下',
    'elbow-to-knee': '肘触膝',
    'pike-to-cobra': '折体到眼镜蛇式',
    'pull-in': '收腿',
    'butt-ups': '抬臀',
    'body-up': '身体撑起',
    'handstand': '手倒立',
    'planche': '水平支撑',
    'pistol': '手枪',
    'jump': '跳跃',
}
WORDS = {
    'a': '', 'an': '', 'the': '', 'of': '', 'and': '和', 'to': '至', 'from': '从', 'in': '内', 'into': '进入',
    'with': '配合', 'without': '无', 'against': '靠', 'on': '', 'off': '离开', 'over': '越过', 'under': '下方',
    'across': '横跨', 'around': '环绕', 'behind': '身后', 'between': '之间', 'above': '上方', 'through': '穿过',
    'apart': '分开', 'together': '并拢', 'forth': '向前', 'forward': '向前', 'backward': '向后', 'upward': '向上',
    'down': '向下', 'up': '向上', 'out': '向外', 'big': '大', 'small': '小', 'short': '短', 'long': '长',
    'barbell': '杠铃', 'dumbbell': '哑铃', 'dumbbells': '哑铃', 'cable': '绳索', 'band': '弹力带', 'kettlebell': '壶铃',
    'machine': '器械', 'lever': '器械', 'smith': '史密斯', 'sled': '倒蹬机', 'weighted': '负重', 'bodyweight': '自重',
    'assisted': '辅助', 'resistance': '阻力', 'rope': '绳索', 'ropes': '绳索', 'bar': '杆', 'bars': '杆', 'bench': '训练凳',
    'benches': '训练凳', 'chair': '椅子', 'wheel': '健腹轮', 'roller': '健腹轮', 'rollerer': '健腹轮', 'rollerout': '健腹轮',
    'wall': '墙', 'floor': '地面', 'ground': '地面', 'platform': '平台', 'box': '跳箱', 'board': '板', 'cage': '训练架',
    'rack': '训练架', 'pad': '垫', 'strap': '助力带', 'straps': '助力带', 'towel': '毛巾', 'band': '弹力带',
    'seated': '坐姿', 'sitted': '坐姿', 'standing': '站姿', 'lying': '仰卧', 'prone': '俯卧', 'supine': '仰卧',
    'reclining': '斜卧', 'kneeling': '跪姿', 'half-kneeling': '半跪姿', 'astride': '分腿', 'split': '分腿', 'straddle': '分腿',
    'side': '侧向', 'lateral': '侧向', 'front': '前', 'rear': '后', 'back': '后', 'reverse': '反向', 'overhead': '过头',
    'upright': '直立', 'incline': '上斜', 'decline': '下斜', 'flat': '平卧', 'bent': '屈', 'straight': '直',
    'close': '窄', 'wide': '宽', 'underhand': '反握', 'overhand': '正握', 'neutral': '对握', 'palms': '掌心',
    'palm': '掌心', 'palm-in': '掌心相对', 'pronated': '旋前', 'supinated': '旋后', 'pronation': '旋前', 'supination': '旋后',
    'grip': '握法', 'gripless': '无握', 'gripper': '握力器', 'elevated': '垫高', 'supported': '有支撑', 'suspended': '悬吊',
    'hanging': '悬垂', 'inverted': '倒立', 'hollow': '空心', 'tuck': '蜷缩', 'pike': '折体', 'archer': '弓箭手',
    'sissy': '西西', 'cossack': '哥萨克', 'curtsey': '屈膝礼', 'hack': '哈克', 'zercher': '泽奇', 'jefferson': '杰斐逊',
    'goblet': '高脚杯', 'sumo': '相扑', 'skater': '滑冰式', 'windmill': '风车', 'superman': '超人式',
    'burpee': '波比跳', 'inchworm': '尺蠖爬行', 'donkey': '驴式', 'gorilla': '大猩猩式', 'spider': '蜘蛛式',
    'crab': '蟹式', 'frog': '蛙式', 'sphinx': '狮身人面式', 'maltese': '马耳他', 'stalder': '斯托德',
    'pirate': '海盗式', 'russian': '俄罗斯式', 'scott': '斯科特', 'bradford': '布拉德福德', 'rocky': '洛奇',
    'zottman': '佐特曼', 'jm': 'JM', 'tate': '泰特', 'svend': '斯文德', 'otis': '奥蒂斯', 'gironda': '吉隆达',
    'frankenstein': '弗兰肯斯坦', 'london': '伦敦', 'potty': '蹲便式', 'prisoner': '抱头', 'captains': '队长',
    'chair': '椅', 'kipping': '蝶式摆荡', 'muscle': '肌肉', 'muscle-up': '双力臂',
    'arm': '手臂', 'arms': '手臂', 'leg': '腿', 'legs': '腿', 'ankle': '踝', 'ankles': '踝', 'knee': '膝', 'knees': '膝',
    'hip': '髋', 'glute': '臀肌', 'glutes': '臀肌', 'gluteus': '臀肌', 'butt': '臀', 'hamstring': '腘绳肌',
    'hamstrings': '腘绳肌', 'quad': '股四头肌', 'quads': '股四头肌', 'calf': '小腿', 'calves': '小腿',
    'adductor': '内收肌', 'adductors': '内收肌', 'abductor': '外展肌', 'abduction': '外展', 'adduction': '内收',
    'bicep': '肱二头肌', 'biceps': '肱二头肌', 'tricep': '肱三头肌', 'triceps': '肱三头肌',
    'chest': '胸肌', 'pec': '胸肌', 'pecs': '胸肌', 'pectoralis': '胸肌', 'back': '背', 'lat': '背阔肌',
    'shoulder': '肩', 'shoulders': '肩', 'delt': '三角肌', 'delts': '三角肌', 'deltoid': '三角肌',
    'trap': '斜方肌', 'traps': '斜方肌', 'neck': '颈部', 'head': '头', 'spine': '脊柱', 'core': '核心',
    'abdominal': '腹肌', 'ab': '腹肌', 'abs': '腹肌', 'oblique': '腹斜肌', 'wrist': '手腕', 'forearm': '前臂',
    'elbow': '肘', 'femoral': '股', 'femoris': '股肌', 'rectus': '直肌', 'scapula': '肩胛', 'scapular': '肩胛',
    'sternum': '胸骨', 'rib': '肋骨', 'tibialis': '胫骨肌', 'peroneals': '腓骨肌', 'piriformis': '梨状肌',
    'thigh': '大腿', 'thighs': '大腿', 'foot': '脚', 'feet': '脚', 'toe': '脚尖', 'toes': '脚尖', 'heel': '脚跟',
    'press': '推举', 'presses': '推举', 'curl': '弯举', 'curls': '弯举', 'extension': '伸展', 'raise': '平举',
    'raises': '平举', 'row': '划船', 'pulldown': '下拉', 'pull': '拉', 'pullup': '引体向上', 'dip': '臂屈伸', 'dips': '臂屈伸',
    'squat': '深蹲', 'squats': '深蹲', 'deadlift': '硬拉', 'lunge': '箭步蹲', 'crunch': '卷腹', 'crunches': '卷腹',
    'plank': '平板支撑', 'twist': '转体', 'twists': '转体', 'twisting': '扭转', 'kickback': '后踢', 'kickbacks': '后踢',
    'pushdown': '下压', 'pullover': '上拉', 'shrug': '耸肩', 'stretch': '拉伸', 'run': '跑', 'sprint': '冲刺',
    'sprints': '冲刺', 'walk': '行走', 'walking': '行走', 'bike': '骑行', 'cycle': '骑行', 'jump': '跳跃',
    'jumps': '跳跃', 'hop': '跳跃', 'hops': '跳跃', 'clean': '翻站', 'snatch': '抓举', 'jerk': '挺举',
    'thruster': '深蹲推举', 'carry': '搬运', 'climb': '攀爬', 'crawl': '爬行', 'swing': '摆动', 'swimmer': '游泳式',
    'flexion': '屈曲', 'hyperextension': '背伸展', 'flexor': '屈肌', 'release': '释放', 'retractor': '回缩',
    'stabilization': '稳定', 'balance': '平衡', 'rotation': '旋转', 'rotational': '旋转', 'rotate': '旋转',
    'circular': '画圈', 'circles': '画圈', 'circle': '画圈', 'raise': '平举', 'lower': '下放', 'lift': '抬起',
    'lifted': '抬起', 'hang': '悬垂', 'hold': '保持', 'touch': '触碰', 'tap': '轻触', 'reach': '触及',
    'squeeze': '挤压', 'squeezes': '挤压', 'slide': '滑动', 'march': '踏步', 'clap': '拍手', 'throw': '抛',
    'touchdown': '触地', 'downward': '向下', 'upward': '向上', 'skullcrusher': '碎颅式臂屈伸', 'kick': '踢',
    'kicks': '踢', 'flip': '翻转', 'drag': '拖拽', 'drive': '驱动', 'depth': '深度', 'height': '高度',
    'front': '前', 'back': '后', 'side': '侧', 'left': '左', 'right': '右', 'both': '双', 'all': '全',
    'one': '单', 'two': '双', 'three': '三', 'four': '四', 'alternate': '交替', 'alternating': '交替',
    'unilateral': '单侧', 'single': '单', 'double': '双', 'twin': '双', 'multiple': '多次', 'reps': '次',
    'full': '全程', 'half': '半程', 'quarter': '四分之一', 'deep': '深度', 'high': '高', 'low': '低',
    'middle': '中', 'upper': '上', 'lower': '下', 'inner': '内侧', 'inside': '内侧', 'outer': '外侧',
    'outside': '外侧', 'top': '顶部', 'bottom': '底部', 'bottoms': '底部', 'top-down': '由上至下',
    'elevator': '电梯式', 'hyper': '超伸', 'negative': '离心', 'isometric': '等长', 'dynamic': '动态',
    'plyo': '爆发式', 'speed': '速度', 'power': '爆发', 'advanced': '进阶', 'basic': '基础', 'modified': '改良',
    'assisted': '辅助', 'support': '支撑', 'self': '自我', 'manual': '手动', 'fixed': '固定', 'straight': '直',
    'bend': '屈', 'bends': '屈', 'bent': '屈', 'extended': '伸展', 'outstretched': '伸直', 'cross': '交叉',
    'cross-over': '交叉', 'crossover': '交叉', 'crossovers': '交叉', 'reverse': '反向', 'reversed': '反向',
    'reversal': '反向', 'revers': '反向', 'opposite': '对侧', 'contralateral': '对侧', 'same': '同侧',
    'staggered': '错步', 'stagger': '错步', 'stork': '鹳式', 'stance': '站姿', 'stride': '步幅',
    'step': '踏步', 'stepbox': '跳箱', 'staircase': '楼梯', 'stairs': '楼梯', 'ramp': '斜坡', 'angle': '角度',
    'angled': '斜角', 'degrees': '度', 'vertical': '垂直', 'horizontal': '水平', 'diagonal': '对角',
    'deep': '深度', 'short': '短', 'quick': '快速', 'slow': '缓慢', 'wide': '宽', 'narrow': '窄',
    'feet': '双脚', 'hands': '双手', 'hand': '手', 'elbows': '双肘', 'knees': '双膝', 'ankles': '脚踝',
    'leg-hip': '腿髋', 'glute-ham': '臀腿', 'elbow-to-knee': '肘触膝', 'knife': '刀式', 'scissor': '剪刀式',
    'flutter': '交替打水', 'bicycle': '自行车式', 'air': '空中', 'plyometric': '爆发式',
    'grip': '握法', 'pronate-grip': '正握', 'finger': '手指', 'fingers': '手指', 'thumb': '拇指',
    'towel': '毛巾', 'cambered': '弧面', 'fat': '粗', 'thick': '粗', 'thin': '细', 'standard': '标准',
    'male': '', 'female': '', 'pov': '', 'v.': '变式', 'v': '变式', '2': '2', '3': '3', '4': '4',
    'the': '', 'a': '', 'an': '', 'of': '', 'with': '', 'and': '和', 'plus': '加',
    'side-to-side': '左右', 'isometric': '等长', 'one': '单', 'two': '双',
    'point': '点', 'points': '点', 'position': '姿势', 'ex': '动作', 'exercise': '训练',
    'motion': '动作', 'muscle': '肌肉', 'pose': '姿势', 'yoga': '瑜伽', 'figure': '花样', 'four': '四',
    'clock': '钟面', 'bridge': '桥式', 'bridge-up': '桥式撑起', 'wrestlers': '摔跤式',
    'cuban': '古巴式', ' rotational': '旋转', 'turkish': '土耳其', 'get-up': '起身',
    'iron': '铁', 'cross': '十字', 'reverse': '反向', 'plank': '平板支撑',
}

PHRASES.update({
    'ez bar': '曲杆', 'skull crusher': '碎颅式臂屈伸', 'external rotation': '外旋', 'internal rotation': '内旋',
    'military press': '军事推举', 'pectoralis major': '胸大肌', 'jack knife': '折刀', 'jack jump': '开合跳',
    'figure 8': '8 字绕环', 'cross body': '交叉身体', 'around world': '绕世界', 'chest push': '胸前推',
    'chest pass': '胸前传球', 'one legged': '单腿', 'straight leg': '直腿', 'stiff leg': '直腿',
    'full can lateral raise': '满罐侧平举', 'bench support': '凳上支撑', 'on parallel bars': '双杠上',
    'parallel bars': '双杠', 'high pulley': '高位滑轮', 'low pulley': '低位滑轮', 'with rope attachment': '绳索把手',
    'knee touch': '触膝', 'cross body crunch': '交叉卷腹', 'air bike': '空中自行车', 'body saw': '身体锯式',
    'posterior step': '后撤步', 'pass through': '换手', 'anti gravity': '抗重力', 'front plank': '平板支撑',
    'bench press': '卧推', 'calf raise': '提踵', 'calf press': '提踵', 'leg extension': '腿屈伸',
    'leg curl': '腿弯举', 'triceps extension': '肱三头肌臂屈伸', 'tricep extension': '肱三头肌臂屈伸',
    'rear delt': '三角肌后束', 'behind head': '颈后', 'behind neck': '颈后', 'over bench': '凳上',
    'push press': '借力推举', 'reverse hyperextension': '反向背伸展', 'reverse hyper extension': '反向背伸展',
    'hyperextension': '背伸展', 'hyper extension': '背伸展', 'cable rope': '绳索', 'wheel rollerout': '健腹轮',
    'rollerout': '健腹轮', 'push up on bosu ball': '波速球俯卧撑', 'squat on bosu ball': '波速球深蹲',
    'on the wall': '靠墙', 'dip cage': '双杠架', 'pull-up cable machine': '引体绳索机', 'leg press machine': '倒蹬机',
    'pull-up pulldown': '引体下拉', 'hip thrusts': '臀推', 'hip thrust': '臀推', 'close grip bench press': '窄距卧推',
    'incline bench press': '上斜卧推', 'decline bench press': '下斜卧推', 'one arm row': '单臂划船',
    'good morning': '早安式',     'dumbbell row': '哑铃划船', 'barbell row': '杠铃划船',
    'chest press': '推胸', 'leg press': '腿举', 'floor crunch': '地面卷腹', 'leg raise': '举腿',
    'front squat': '前蹲', 'full squat': '深蹲', 'rear delt fly': '三角肌后束飞鸟',
    'lateral raise': '侧平举', 'front raise': '前平举', 'rear raise': '后平举', 'overhead press': '过头推举',
    'bench dip': '凳上臂屈伸', 'bench pull-ups': '凳上引体向上', 'front chest squat': '前蹲',
    'parallel close grip': '对握窄距', 'calf raises': '提踵', 'reverse hyper': '反向背伸展',
    'on floor': '地面', 'on the floor': '地面', 'on flat bench': '（平凳）', 'on bosu ball': '（波速球）',
    'on hip': '髋部',
})
WORDS.update({
    'rocky': '洛奇', 'self': '自主', 'pulldown': '下拉', 'pull': '拉', 'bent': '屈', 'arm': '手臂',
})
PHRASES.update({'over a bench': '（训练凳）', 'with exercise ball': '（健身球）', 'chest throw': '胸推', 'between benches': '（双凳之间）', 'tennis ball between ankles': '双踝夹网球', 'tennis ball between knees': '双膝夹网球', 'throw down': '下抛', 'leg pull in': '仰卧屈腿', 'flat bench': '平凳', 'arms straight': '手臂伸直', 'dumbbell raise': '哑铃上举', 'rocky pull-up pulldown': '洛奇引体下拉', 'dumbbell jm bench press': '哑铃 JM 卧推'})

WORDS.update({
    '8': '8 字', 'anti': '抗', 'arnold': '阿诺德', 'attachment': '把手', 'ball': '球', 'body': '身体',
    'bowling': '保龄球式', 'boxing': '拳击', 'breeding': '推举', 'can': '罐式', 'caster': '施法者', 'catch': '接球',
    'chin': '反手引体', 'clasped': '扣手', 'closer': '窄距', 'cocoons': '蚕茧式', 'concentration': '集中',
    'crusher': '挤压', 'depresor': '下压肌', 'diamond': '钻石', 'dip-pull-up': '双杠引体架', 'dog': '狗式',
    'drop': '落差', 'elliptical': '椭圆机', 'equipment': '器械', 'ergometer': '功率车', 'external': '外旋',
    'ez': '曲杆', 'ez-barbell': '曲杆', 'face': '面部', 'facing': '面向', 'fallout': '滑出', 'flag': '旗式',
    'fly': '飞鸟', 'flyes': '飞鸟', 'french': '法式', 'gravity': '重力', 'groin': '腹股沟', 'guillotine': '断头台式',
    'hammer': '锤式', 'handle': '把手', 'hindu': '印度式', 'hook': '勾拳', 'hug': '抱', 'hyght': '海特式',
    'impossible': '极限', 'intermediate': '中级', 'internal': '内旋', 'inverse': '反向', 'jack': '开合',
    'judo': '柔道', 'kayak': '皮划艇', 'keens': '膝', 'korean': '韩式', 'landmine': '地雷管', 'lean': '倾斜',
    'legged': '腿', 'lifting': '抬起', 'major': '大肌', 'military': '军事', 'mixed': '混合', 'monster': '怪兽式',
    'pallof': '帕洛夫', 'parallel': '平行', 'pass': '传递', 'peacher': '牧师凳', 'pelvic': '骨盆', 'pendlay': '彭德利',
    'pin': '固定架', 'posterior': '后侧', 'preacher': '牧师凳', 'pulley': '滑轮', 'push': '推', 'pyramid': '金字塔式',
    'raised': '抬高', 'range': '幅度', 'renegade': '叛徒式', 'response': '反应', 'ring': '吊环', 'rocking': '摇摆',
    'romanian': '罗马尼亚', 'rotary': '旋转', 'round': '圆形', 'runners': '跑者', 'saw': '锯式', 'seesaw': '跷跷板',
    'semi': '半', 'sequence': '序列', 'sit': '坐姿', 'ski': '滑雪', 'skier': '滑雪式', 'skull': '颅',
    'slam': '砸球', 'sledge': '大锤', 'slingers': '摆腿', 'spell': '施法', 'squad': '深蹲', 'squatting': '蹲姿',
    'star': '星式', 'stationary': '固定', 'stepmill': '登楼机', 'stiff': '直腿', 'stirrups': '脚蹬', 'style': '式',
    'supper': '抬腿', 't': 'T', 'tennis': '网球', 'thibaudeau': '蒂博多', 'thrusts': '挺髋', 'tilt': '倾斜',
    'touchers': '触地', 'trainer': '训练器', 'treadmill': '跑步机', 'twisted': '扭转', 'ups': '抬举',
    'variation': '变式', 'waiter': '侍者', 'wind': '风', 'wipers': '雨刷式', 'world': '世界',
})

SUFFIXES = {
    'male': '', 'female': '', 'pov': '', 'back pov': '背面视角', 'side pov': '侧面视角', 'front pov': '正面视角',
    'v. 2': '变式2', 'v. 3': '变式3', 'v. 2.': '变式2',
}
UNKNOWN = set()

for _key, _value in {
    'sit-up': '仰卧起坐', 'push-up': '俯卧撑', 'pull-up': '引体向上', 'chin-up': '反手引体向上',
    'step-up': '登台阶', 'bent-over': '俯身', 'close-grip': '窄距', 'wide-grip': '宽距',
    'reverse-grip': '反握', 'ez-bar': '曲杆', 'sz-bar': '曲杆', 'v-bar': 'V 型把手',
    't-bar': 'T 杠', 't-raise': 'T 字平举', 'y-raise': 'Y 字平举', 'w-press': 'W 推举',
    'l-sit': 'L 型坐', 'v-sit': 'V 型坐', 'v-up': 'V 字两头起', 'l-pull-up': 'L 型引体向上',
    'muscle-up': '双力臂', 'curl-up': '卷腹起身', 'pull-ups': '引体向上', 'chin-ups': '反手引体向上',
    'body-up': '身体撑起', 'butt-ups': '抬臀', 'pike-to-cobra': '折体到眼镜蛇式', 'side-to-side': '左右',
    'bottoms-up': '底部朝上', 'two-one': '二比一', 'up-down': '上下', 'elbow-to-knee': '肘触膝',
    'pull-in': '收腿', 'clean-grip': '翻握', 'dead bug': '死虫式',
}.items():
    PHRASES.setdefault(_key, _value)

SPECIAL_WORDS = {
    '3/4': '四分之三', '1/2': '二分之一', '180': '180°', '360': '360°', '45': '45', '45°': '45°',
}


def translate_piece(text: str) -> str:
    text = text.lower().strip()
    if text in SUFFIXES:
        return SUFFIXES[text]
    tokens = re.findall(r"[a-zA-Z]+(?:[-'][a-zA-Z]+)*|\d+(?:[./]\d+)?°?", text)
    output = []
    index = 0
    while index < len(tokens):
        matched = None
        for length in range(min(5, len(tokens) - index), 0, -1):
            phrase = ' '.join(tokens[index:index + length])
            if phrase in PHRASES:
                matched = (length, PHRASES[phrase])
                break
        if matched:
            output.append(matched[1])
            index += matched[0]
            continue
        token = tokens[index]
        if token in SPECIAL_WORDS:
            output.append(SPECIAL_WORDS[token])
        elif token in WORDS:
            output.append(WORDS[token])
        else:
            UNKNOWN.add(token)
            output.append(token)
        index += 1
    return ''.join(output)


def chinese_name(english: str) -> str:
    key = english.lower().strip()
    if key in OVERRIDES:
        return OVERRIDES[key]
    main = re.sub(r'\([^)]*\)', ' ', english)
    notes = re.findall(r'\(([^)]*)\)', english.lower())
    variants = re.findall(r'\bv\.\s*(\d+)\.?', main, flags=re.I)
    main = re.sub(r'\bv\.\s*\d+\.?', ' ', main, flags=re.I)
    main = re.sub(r'\s+', ' ', main).strip(' ,-')
    translated = translate_piece(main)
    note_parts = [translate_piece(note) for note in notes]
    note_parts = [note for note in note_parts if note]
    if note_parts:
        translated += '（' + '，'.join(note_parts) + '）'
    if variants:
        translated += ' 变式' + '、'.join(dict.fromkeys(variants))
    # Phrases such as "on exercise ball" already carry their own brackets; fold them
    # into the surrounding note instead of emitting （（健身球））.
    translated = re.sub(r'（（([^（）]*)）([^（）]*)）', r'（\1，\2）', translated)
    translated = re.sub(r'（（([^（）]*)））', r'（\1）', translated)
    translated = translated.replace('）（', '，')
    translated = translated.replace('背部伸展', '背伸展').replace('拉拉伸', '拉伸')
    # Latin shape symbols (V-bar, T-raise, JM press) need breathing room around them.
    translated = re.sub(r'([\u4e00-\u9fff])([VTYLW])(?=[\s字型杆杠])', r'\1 \2 ', translated)
    translated = re.sub(r'([\u4e00-\u9fff])(JM)(?=[\u4e00-\u9fff])', r'\1 \2 ', translated)
    translated = re.sub(r'\s+', ' ', translated).strip()
    return translated or english


if __name__ == '__main__':
    items = json.loads(DATA.read_text(encoding='utf-8'))
    for item in items:
        item['nameZh'] = chinese_name(item['name'])
    DATA.write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'localized {len(items)} exercises')
    print('unknown tokens:', ' '.join(sorted(UNKNOWN)))
    for item in items[:20]:
        print(item['name'], '=>', item['nameZh'])
