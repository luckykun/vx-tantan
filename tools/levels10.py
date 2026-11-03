# -*- coding: utf-8 -*-
"""v10.4 十关地图设计生成器（24 列 x 22 行，末行=底墙+缝隙）。
规则：造型左右对称、轮廓步进<=1~2 格；缝隙宽 2-5、个数/位置按关固定（设计期随机、运行期固定）；
墙体(W)与道具(S/T/L/X/P/G)全部写在地图里 = 位置固定。
输出：design sheet HTML（供预览）+ 打印 config.ts 可用地图数组。
"""
import io, json, random

W, ROWS = 24, 22
BOTTOM = ROWS - 1

def blank():
    return [['.'] * W for _ in range(ROWS)]

def runs(g, r, pairs):
    for a, b in pairs:
        for c in range(a, b + 1):
            g[r][c] = 'B'

def put(g, cells, ch):
    for r, c in cells:
        g[r][c] = ch

def mirror(pairs_cols, center=12):
    """给定左侧列集合，返回对称的 (r,c) 对列表输入用 helper 外部处理"""
    return [(2 * center - 1 - c) for c in pairs_cols]

def bottom_row(g, gaps):
    for c in range(W):
        g[BOTTOM][c] = 'W'
    for a, b in gaps:
        for c in range(a, b + 1):
            g[BOTTOM][c] = '.'

LEVELS = []

def level(_id, name, gaps, build, note):
    g = blank()
    build(g)
    bottom_row(g, gaps)
    LEVELS.append({'id': _id, 'name': name, 'gaps': gaps, 'grid': g, 'note': note})

# ---------- L1 爱心（平滑轮廓） ----------
def b1(g):
    runs(g, 4, [(5, 9), (14, 18)])
    runs(g, 5, [(4, 10), (13, 19)])
    runs(g, 6, [(3, 20)])
    runs(g, 7, [(3, 20)])
    runs(g, 8, [(4, 19)])
    runs(g, 9, [(5, 18)])
    runs(g, 10, [(6, 17)])
    runs(g, 11, [(7, 16)])
    runs(g, 12, [(8, 15)])
    runs(g, 13, [(9, 14)])
    runs(g, 14, [(10, 13)])
    runs(g, 15, [(11, 12)])
    put(g, [(7, 5), (7, 18)], 'S')
    put(g, [(9, 7), (9, 16)], 'T')
    put(g, [(11, 9), (11, 14)], 'L')
    put(g, [(12, 10), (12, 13)], 'P')
level(1, '爱心初动', [(10, 13)], b1, '缝隙 w4 x1 居中')

# ---------- L2 菱形+墙核 ----------
def b2(g):
    widths = {3: (11, 12), 4: (10, 13), 5: (9, 14), 6: (8, 15), 7: (7, 16), 8: (6, 17),
              9: (5, 18), 10: (4, 19), 11: (5, 18), 12: (6, 17), 13: (7, 16), 14: (8, 15),
              15: (9, 14), 16: (10, 13), 17: (11, 12)}
    for r, (a, b) in widths.items():
        runs(g, r, [(a, b)])
    for r in range(8, 13):
        for c in range(10, 14):
            g[r][c] = 'W'
    put(g, [(6, 8), (6, 15)], 'S')
    put(g, [(10, 6), (10, 17)], 'X')
    put(g, [(12, 7), (12, 16)], 'T')
    put(g, [(14, 9), (14, 14)], 'L')
    put(g, [(8, 6), (8, 17)], 'G')
    put(g, [(16, 10), (16, 13)], 'P')
level(2, '菱形迷城', [(4, 6), (17, 19)], b2, '缝隙 w3 x2 对称')

# ---------- L3 沙漏 ----------
def b3(g):
    seq = [(3, (2, 21)), (4, (3, 20)), (5, (4, 19)), (6, (5, 18)), (7, (6, 17)), (8, (7, 16)),
           (9, (8, 15)), (10, (9, 14)), (11, (8, 15)), (12, (7, 16)), (13, (6, 17)), (14, (5, 18)),
           (15, (4, 19)), (16, (3, 20)), (17, (2, 21))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    put(g, [(4, 4), (4, 19)], 'S')
    put(g, [(6, 6), (6, 17)], 'T')
    put(g, [(9, 9), (9, 14)], 'X')
    put(g, [(12, 7), (12, 16)], 'L')
    put(g, [(15, 4), (15, 19)], 'P')
level(3, '沙漏迷阵', [(11, 12)], b3, '缝隙 w2 x1 居中(最难)')

# ---------- L4 圆环 ----------
def b4(g):
    outer = {3: (9, 14), 4: (7, 16), 5: (6, 17), 6: (5, 18), 7: (4, 19), 8: (4, 19),
             9: (3, 20), 10: (3, 20), 11: (3, 20), 12: (4, 19), 13: (4, 19), 14: (5, 18),
             15: (6, 17), 16: (7, 16), 17: (9, 14)}
    for r, (a, b) in outer.items():
        runs(g, r, [(a, b)])
    for r in range(7, 14):
        for c in range(9, 15):
            g[r][c] = '.'
    put(g, [(5, 6), (5, 17)], 'S')
    put(g, [(7, 5), (7, 18)], 'X')
    put(g, [(9, 4), (9, 19)], 'T')
    put(g, [(12, 5), (12, 18)], 'L')
    put(g, [(15, 6), (15, 17)], 'P')
level(4, '空心圆环', [(3, 7), (16, 20)], b4, '缝隙 w5 x2 对称')

# ---------- L5 十字+中墙柱 ----------
def b5(g):
    seq = [(3, (10, 13)), (4, (9, 14)), (5, (9, 14)), (6, (7, 16)), (7, (4, 19)), (8, (2, 21)),
           (9, (2, 21)), (10, (2, 21)), (11, (2, 21)), (12, (4, 19)), (13, (7, 16)), (14, (9, 14)),
           (15, (9, 14)), (16, (10, 13)), (17, (10, 13))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    for r in range(8, 12):
        g[r][11] = 'W'; g[r][12] = 'W'
    put(g, [(4, 9), (4, 14)], 'S')
    put(g, [(9, 3), (9, 20)], 'X')
    put(g, [(9, 10), (9, 13)], 'T')
    put(g, [(13, 8), (13, 15)], 'L')
    put(g, [(16, 10), (16, 13)], 'P')
    put(g, [(7, 5), (7, 18)], 'G')
level(5, '十字雷阵', [(6, 8), (15, 17)], b5, '缝隙 w3 x2 对称')

# ---------- L6 拱门(双柱+顶梁) ----------
def b6(g):
    runs(g, 3, [(2, 21)]); runs(g, 4, [(2, 21)])
    for r in range(5, 18):
        runs(g, r, [(2, 7), (16, 21)])
    for r in range(5, 18):
        g[r][7] = 'W'; g[r][16] = 'W'
    put(g, [(3, 3), (3, 20)], 'X')
    put(g, [(6, 3), (6, 20)], 'S')
    put(g, [(6, 6), (6, 17)], 'G')
    put(g, [(9, 4), (9, 19)], 'T')
    put(g, [(12, 3), (12, 20)], 'L')
    put(g, [(15, 4), (15, 19)], 'P')
level(6, '拱门守卫', [(2, 3), (11, 12), (20, 21)], b6, '缝隙 w2 x3')

# ---------- L7 盾牌+V墙 ----------
def b7(g):
    seq = [(3, (2, 21)), (4, (2, 21)), (5, (2, 21)), (6, (3, 20)), (7, (3, 20)), (8, (4, 19)),
           (9, (4, 19)), (10, (5, 18)), (11, (6, 17)), (12, (7, 16)), (13, (8, 15)), (14, (9, 14)),
           (15, (10, 13)), (16, (11, 12)), (17, (11, 12))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    for r in range(8, 11):
        g[r][11] = 'W'; g[r][12] = 'W'
    put(g, [(4, 3), (4, 20)], 'S')
    put(g, [(5, 2), (5, 21)], 'G')
    put(g, [(6, 4), (6, 19)], 'X')
    put(g, [(9, 5), (9, 18)], 'T')
    put(g, [(12, 8), (12, 15)], 'L')
    put(g, [(14, 9), (14, 14)], 'P')
level(7, '盾牌密纹', [(8, 11)], b7, '缝隙 w4 x1 偏左')

# ---------- L8 蝴蝶(墙身) ----------
def b8(g):
    wings = {3: [(4, 10), (13, 19)], 4: [(3, 10), (13, 20)], 5: [(2, 10), (13, 21)],
             6: [(2, 10), (13, 21)], 7: [(3, 10), (13, 20)], 8: [(4, 10), (13, 19)],
             9: [(5, 10), (13, 18)], 10: [(6, 10), (13, 17)], 11: [(7, 10), (13, 16)],
             12: [(8, 10), (13, 15)], 13: [(9, 10), (13, 14)], 14: [(10, 10), (13, 13)],
             15: [(8, 10), (13, 15)], 16: [(7, 10), (13, 16)], 17: [(6, 10), (13, 17)]}
    for r, pr in wings.items():
        runs(g, r, pr)
    for r in range(3, 18):
        g[r][11] = 'W'; g[r][12] = 'W'
    put(g, [(4, 4), (4, 19)], 'S')
    put(g, [(5, 2), (5, 21)], 'G')
    put(g, [(6, 3), (6, 20)], 'T')
    put(g, [(9, 6), (9, 17)], 'L')
    put(g, [(12, 9), (12, 14)], 'P')
    put(g, [(15, 8), (15, 15)], 'X')
level(8, '蝶舞双谷', [(5, 6), (17, 18)], b8, '缝隙 w2 x2 对称')

# ---------- L9 箭树+墙心 ----------
def b9(g):
    seq = [(3, (11, 12)), (4, (10, 13)), (5, (9, 14)), (6, (8, 15)), (7, (7, 16)), (8, (6, 17)),
           (9, (5, 18)), (10, (4, 19)), (11, (3, 20)), (12, (2, 21)),
           (13, (9, 14)), (14, (9, 14)), (15, (9, 14)), (16, (9, 14)), (17, (9, 14))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    g[10][11] = 'W'; g[10][12] = 'W'
    put(g, [(5, 9), (5, 14)], 'S')
    put(g, [(8, 7), (8, 16)], 'T')
    put(g, [(9, 5), (9, 18)], 'G')
    put(g, [(11, 3), (11, 20)], 'X')
    put(g, [(11, 10), (11, 13)], 'L')
    put(g, [(14, 9), (14, 14)], 'P')
level(9, '箭头之树', [(9, 13)], b9, '缝隙 w5 x1 居中')

# ---------- L10 糖果堡垒(满填+庭院+墙柱) ----------
def b10(g):
    for r in range(2, 18):
        runs(g, r, [(1, 22)])
    for r in range(6, 10):
        for c in list(range(5, 9)) + list(range(15, 19)):
            g[r][c] = '.'
    for r in range(12, 15):
        for c in range(10, 14):
            g[r][c] = '.'
    for r in list(range(2, 6)) + list(range(10, 12)) + list(range(15, 18)):
        g[r][11] = 'W'; g[r][12] = 'W'
    put(g, [(3, 2), (3, 21)], 'S')
    put(g, [(4, 4), (4, 19)], 'T')
    put(g, [(6, 9), (6, 14)], 'G')
    put(g, [(7, 4), (7, 19)], 'X')
    put(g, [(8, 9), (8, 14)], 'L')
    put(g, [(13, 9), (13, 14)], 'P')
    put(g, [(15, 3), (15, 20)], 'S')
    put(g, [(16, 5), (16, 18)], 'X')
level(10, '糖果堡垒', [(4, 6), (12, 14), (19, 21)], b10, '缝隙 w3 x3')

# ---------- 校验 ----------
for lv in LEVELS:
    g = lv['grid']
    assert all(len(r) == W for r in g)
    assert len(g) == ROWS
    # 对称校验（忽略道具字母差异，按"非空"对称）
    for r in range(BOTTOM):
        for c in range(W // 2):
            a, b = g[r][c] != '.', g[r][W - 1 - c] != '.'
            assert a == b, (lv['id'], r, c)
    # 缝隙宽度校验 2-5
    for a, b in lv['gaps']:
        assert 2 <= b - a + 1 <= 5, (lv['id'], lv['gaps'])
    # 统计
    cnt = {}
    for r in g:
        for ch in r:
            cnt[ch] = cnt.get(ch, 0) + 1
    lv['stats'] = cnt

# ---------- 输出 HTML sheet ----------
PROP_COLOR = {'S': '#C9A6FF', 'T': '#C9A6FF', 'X': '#5B9BE0', 'L': '#FF8FB2', 'P': '#8FD98A', 'G': '#B9C4E8'}
PROP_GLYPH = {'S': '2', 'T': '3', 'X': '*', 'L': '\u2665', 'P': '\u2014', 'G': '\u25c7'}
PROP_NAME = {'S': '分裂2球', 'T': '分裂3球', 'X': '爆炸', 'L': '生命+1', 'P': '挡板加强', 'G': '墙体隐形'}

cards = []
for lv in LEVELS:
    cells = []
    for r in range(ROWS):
        for c in range(W):
            ch = lv['grid'][r][c]
            if r == BOTTOM:
                if ch == 'W':
                    cells.append('<i class="w"></i>')
                else:
                    cells.append('<i class="gap"></i>')
            elif ch == '.':
                cells.append('<i class="e"></i>')
            elif ch == 'B':
                cells.append('<i class="b"></i>')
            elif ch == 'W':
                cells.append('<i class="w"></i>')
            else:
                cells.append('<i class="p" style="background:%s">%s</i>' % (PROP_COLOR[ch], PROP_GLYPH[ch]))
    inv = ', '.join('%s x%d' % (PROP_NAME[k], lv['stats'].get(k, 0)) for k in ['S', 'T', 'X', 'L', 'P', 'G'] if lv['stats'].get(k))
    gaps_txt = ' + '.join('w%d@%d-%d' % (b - a + 1, a, b) for a, b in lv['gaps'])
    cards.append(
        '<div class="card"><div class="hd"><span class="no">%d</span><span class="nm">%s</span>'
        '<span class="meta">砖%d · %s</span></div>'
        '<div class="grid">%s</div>'
        '<div class="ft"><span>缝隙：%s</span><span>%s</span></div></div>'
        % (lv['id'], lv['name'], lv['stats'].get('B', 0), lv['note'], ''.join(cells), gaps_txt, inv))

html = u'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>疯狂小球弹一弹 · 十关地图设计稿 v10.4</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e8e2d6;font-family:"PingFang SC","Microsoft YaHei",sans-serif;padding:36px 24px 60px}
h1{text-align:center;font-size:30px;font-weight:900;color:#fff;letter-spacing:2px;
 text-shadow:2px 0 0 #4a3f35,-2px 0 0 #4a3f35,0 2px 0 #4a3f35,0 -2px 0 #4a3f35,2px 2px 0 #4a3f35,-2px 2px 0 #4a3f35,2px -2px 0 #4a3f35,-2px -2px 0 #4a3f35,4px 5px 0 rgba(74,63,53,.3)}
.sub{text-align:center;margin:10px 0 26px;font-size:13px;font-weight:800;color:#8a6d4f;letter-spacing:1px}
.wrap{display:flex;flex-wrap:wrap;gap:26px;justify-content:center;max-width:820px;margin:0 auto}
.card{background:#fff;border:3px solid #4a3f35;border-radius:20px;box-shadow:5px 6px 0 rgba(74,63,53,.9);padding:12px 14px 10px;width:380px}
.hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.no{background:#FFD166;border:2px solid #4a3f35;border-radius:8px;font-size:14px;font-weight:900;color:#4a3f35;padding:1px 9px}
.nm{font-size:15px;font-weight:900;color:#4a3f35}
.meta{margin-left:auto;font-size:10px;font-weight:800;color:#b08a5a}
.grid{display:grid;grid-template-columns:repeat(24,14px);grid-auto-rows:14px;gap:1px;background:#f4ecdd;border:2px solid #4a3f35;border-bottom:none;border-radius:10px 10px 0 0;padding:1px;justify-content:center}
.grid i{display:block;border-radius:3px}
.e{background:#fffdf7}
.b{background:#FFD166;border:1.5px solid #4a3f35}
.w{background:#97835a;border:1.5px solid #4a3f35}
.gap{background:#DFF3FF;border:1.5px dashed #59C3F0}
.p{border:1.5px solid #4a3f35;color:#fff;font-size:9px;font-weight:900;font-style:normal;display:flex;align-items:center;justify-content:center;line-height:1}
.ft{display:flex;justify-content:space-between;margin-top:8px;font-size:10px;font-weight:800;color:#8a6d4f}
.legend{max-width:820px;margin:26px auto 0;background:#fff;border:3px solid #4a3f35;border-radius:16px;box-shadow:4px 5px 0 rgba(74,63,53,.9);padding:12px 16px;font-size:12px;font-weight:800;color:#4a3f35;display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.legend i{display:inline-block;width:13px;height:13px;border:1.5px solid #4a3f35;border-radius:3px;vertical-align:-2px;margin-right:4px}
</style></head><body>
<h1>疯狂小球弹一弹 · 十关地图设计稿</h1>
<div class="sub">24 列 x 22 行 · 造型左右对称 · 墙体/道具位置固定 · 底墙缝隙宽 2-5 格（每关固定）· 末行=底墙+缝隙</div>
<div class="wrap">''' + '\n'.join(cards) + u'''</div>
<div class="legend">
<span><i style="background:#FFD166"></i>普通方块</span>
<span><i style="background:#97835a"></i>墙体(不可消除)</span>
<span><i style="background:#C9A6FF"></i>分裂2球(2)/分裂3球(3)</span>
<span><i style="background:#5B9BE0"></i>爆炸(*)</span>
<span><i style="background:#FF8FB2"></i>生命+1(♥)</span>
<span><i style="background:#8FD98A"></i>挡板加强(—)</span>
<span><i style="background:#B9C4E8"></i>墙体隐形(◇)</span>
<span><i style="background:#DFF3FF;border-style:dashed"></i>底墙缝隙(入口)</span>
</div>
</body></html>'''

out = r'C:\Users\Administrator\Desktop\tantan-design\levels-10-sheet.html'
io.open(out, 'w', encoding='utf-8').write(html)
print('sheet written:', out)

# 打印 config.ts 地图数组（后续替换用）
maps = []
for lv in LEVELS:
    maps.append({'id': lv['id'], 'name': lv['name'], 'gaps': lv['gaps'],
                 'map': [''.join(r) for r in lv['grid']]})
io.open(r'C:\Users\Administrator\Desktop\tantan\tools\levels10.json', 'w', encoding='utf-8').write(
    json.dumps(maps, ensure_ascii=False, indent=1))
print('maps json written')
for lv in LEVELS:
    print(lv['id'], lv['name'], 'bricks=%d' % lv['stats'].get('B', 0), lv['note'])
