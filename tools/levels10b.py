# -*- coding: utf-8 -*-
"""v10.7 十关地图设计稿生成器（24 列 x 22 行）。
规则变更：
  1) 去掉分裂2球道具：分裂球统一分裂为 3 球（仅 T 类型）；
  2) 道具总量 P = ceil(可消除总方块数 * 6%)；
  3) 道具比例 分裂:爆炸:生命+1:挡板加强:墙体隐形 = 4:1:1:2:2（最大余数法分配）；
  4) 无内部墙体的关卡不投放墙体隐形（其权重按比例转给其余四类），沿用旧引擎规则；
  5) 道具位置固定：优先镜像对放置（保持整体对称），奇数余量放中线邻列(11/12)；
  6) 造型左右对称、缝隙宽 2-5 格每关固定（沿用 v10.4 造型与缝隙）。
输出：design sheet HTML/PNG 数据 + levels10b.json（待确认后写入 config.ts）。
"""
import io, json, math, random

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

def bottom_row(g, gaps):
    for c in range(W):
        g[BOTTOM][c] = 'W'
    for a, b in gaps:
        for c in range(a, b + 1):
            g[BOTTOM][c] = '.'

# ---------------- 造型（沿用 v10.4，仅 B/W） ----------------
SHAPES = []
def shape(_id, name, gaps, build, note):
    g = blank()
    build(g)
    bottom_row(g, gaps)
    SHAPES.append({'id': _id, 'name': name, 'gaps': gaps, 'grid': g, 'note': note})

def b1(g):
    runs(g, 4, [(5, 9), (14, 18)]); runs(g, 5, [(4, 10), (13, 19)])
    runs(g, 6, [(3, 20)]); runs(g, 7, [(3, 20)]); runs(g, 8, [(4, 19)])
    runs(g, 9, [(5, 18)]); runs(g, 10, [(6, 17)]); runs(g, 11, [(7, 16)])
    runs(g, 12, [(8, 15)]); runs(g, 13, [(9, 14)]); runs(g, 14, [(10, 13)])
    runs(g, 15, [(11, 12)])
shape(1, '爱心初动', [(10, 13)], b1, '缝隙 w4 x1 居中')

def b2(g):
    widths = {3: (11, 12), 4: (10, 13), 5: (9, 14), 6: (8, 15), 7: (7, 16), 8: (6, 17),
              9: (5, 18), 10: (4, 19), 11: (5, 18), 12: (6, 17), 13: (7, 16), 14: (8, 15),
              15: (9, 14), 16: (10, 13), 17: (11, 12)}
    for r, (a, b) in widths.items():
        runs(g, r, [(a, b)])
    for r in range(8, 13):
        for c in range(10, 14):
            g[r][c] = 'W'
shape(2, '菱形迷城', [(4, 6), (17, 19)], b2, '缝隙 w3 x2 对称')

def b3(g):
    seq = [(3, (2, 21)), (4, (3, 20)), (5, (4, 19)), (6, (5, 18)), (7, (6, 17)), (8, (7, 16)),
           (9, (8, 15)), (10, (9, 14)), (11, (8, 15)), (12, (7, 16)), (13, (6, 17)), (14, (5, 18)),
           (15, (4, 19)), (16, (3, 20)), (17, (2, 21))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
shape(3, '沙漏迷阵', [(11, 12)], b3, '缝隙 w2 x1 居中(最难)')

def b4(g):
    outer = {3: (9, 14), 4: (7, 16), 5: (6, 17), 6: (5, 18), 7: (4, 19), 8: (4, 19),
             9: (3, 20), 10: (3, 20), 11: (3, 20), 12: (4, 19), 13: (4, 19), 14: (5, 18),
             15: (6, 17), 16: (7, 16), 17: (9, 14)}
    for r, (a, b) in outer.items():
        runs(g, r, [(a, b)])
    for r in range(7, 14):
        for c in range(9, 15):
            g[r][c] = '.'
shape(4, '空心圆环', [(3, 7), (16, 20)], b4, '缝隙 w5 x2 对称')

def b5(g):
    seq = [(3, (10, 13)), (4, (9, 14)), (5, (9, 14)), (6, (7, 16)), (7, (4, 19)), (8, (2, 21)),
           (9, (2, 21)), (10, (2, 21)), (11, (2, 21)), (12, (4, 19)), (13, (7, 16)), (14, (9, 14)),
           (15, (9, 14)), (16, (10, 13)), (17, (10, 13))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    for r in range(8, 12):
        g[r][11] = 'W'; g[r][12] = 'W'
shape(5, '十字雷阵', [(6, 8), (15, 17)], b5, '缝隙 w3 x2 对称')

def b6(g):
    runs(g, 3, [(2, 21)]); runs(g, 4, [(2, 21)])
    for r in range(5, 18):
        runs(g, r, [(2, 7), (16, 21)])
    for r in range(5, 18):
        g[r][7] = 'W'; g[r][16] = 'W'
shape(6, '拱门守卫', [(2, 3), (11, 12), (20, 21)], b6, '缝隙 w2 x3')

def b7(g):
    seq = [(3, (2, 21)), (4, (2, 21)), (5, (2, 21)), (6, (3, 20)), (7, (3, 20)), (8, (4, 19)),
           (9, (4, 19)), (10, (5, 18)), (11, (6, 17)), (12, (7, 16)), (13, (8, 15)), (14, (9, 14)),
           (15, (10, 13)), (16, (11, 12)), (17, (11, 12))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    for r in range(8, 11):
        g[r][11] = 'W'; g[r][12] = 'W'
shape(7, '盾牌密纹', [(8, 11)], b7, '缝隙 w4 x1 偏左')

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
shape(8, '蝶舞双谷', [(5, 6), (17, 18)], b8, '缝隙 w2 x2 对称')

def b9(g):
    seq = [(3, (11, 12)), (4, (10, 13)), (5, (9, 14)), (6, (8, 15)), (7, (7, 16)), (8, (6, 17)),
           (9, (5, 18)), (10, (4, 19)), (11, (3, 20)), (12, (2, 21)),
           (13, (9, 14)), (14, (9, 14)), (15, (9, 14)), (16, (9, 14)), (17, (9, 14))]
    for r, (a, b) in seq:
        runs(g, r, [(a, b)])
    g[10][11] = 'W'; g[10][12] = 'W'
shape(9, '箭头之树', [(9, 13)], b9, '缝隙 w5 x1 居中')

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
shape(10, '糖果堡垒', [(4, 6), (12, 14), (19, 21)], b10, '缝隙 w3 x3')

# ---------------- 道具分配 ----------------
ORDER = ['T', 'X', 'L', 'P', 'G']
NAMES = {'T': '分裂球(3)', 'X': '爆炸', 'L': '生命+1', 'P': '挡板加强', 'G': '墙体隐形'}

def alloc(P, has_wall):
    weights = {'T': 4, 'X': 1, 'L': 1, 'P': 2, 'G': 2 if has_wall else 0}
    tot_w = sum(weights.values())
    exact = {k: P * weights[k] / float(tot_w) for k in ORDER}
    cnt = {k: int(math.floor(exact[k])) for k in ORDER}
    rem = P - sum(cnt.values())
    for k in sorted(ORDER, key=lambda k: -(exact[k] - cnt[k])):
        if rem <= 0:
            break
        cnt[k] += 1; rem -= 1
    return cnt

def place_props(g, cnt, seed):
    rnd = random.Random(seed)
    placed = {}
    used = set()
    # 镜像对槽位
    pairs = []
    for r in range(BOTTOM):
        for c in range(W // 2):
            c2 = W - 1 - c
            if g[r][c] == 'B' and g[r][c2] == 'B':
                pairs.append((r, c, c2))
    rnd.shuffle(pairs)
    pi = 0
    for k in ORDER:
        n = cnt[k]
        npairs = n // 2
        cells = []
        for _ in range(npairs):
            while pi < len(pairs):
                r, c, c2 = pairs[pi]; pi += 1
                if (r, c) in used or (r, c2) in used:
                    continue
                used.add((r, c)); used.add((r, c2))
                cells.append((r, c)); cells.append((r, c2))
                break
        if n % 2 == 1:
            # 奇数颗：优先中线邻列单格（保持对称）；无中线空格则随机单格（仅该颗不对称）
            cands = [(r, c) for r in range(BOTTOM) for c in (11, 12)
                     if g[r][c] == 'B' and (r, c) not in used]
            if not cands:
                cands = [(r, c) for r in range(BOTTOM) for c in range(W)
                         if g[r][c] == 'B' and (r, c) not in used]
            rnd.shuffle(cands)
            r, c = cands[0]
            used.add((r, c)); cells.append((r, c))
        for (r, c) in cells:
            g[r][c] = k
        placed[k] = len(cells)
    return placed

LEVELS = []
for sh in SHAPES:
    g = [row[:] for row in sh['grid']]
    T = sum(row.count('B') for row in g)
    has_wall = any('W' in row for row in g[:BOTTOM])
    P = int(math.ceil(T * 0.06))
    cnt = alloc(P, has_wall)
    placed = place_props(g, cnt, 1000 + sh['id'])
    assert placed == cnt, (sh['id'], placed, cnt)
    assert sum(placed.values()) == P, (sh['id'], placed, P)
    B = sum(row.count('B') for row in g)
    assert B == T - P
    LEVELS.append({'id': sh['id'], 'name': sh['name'], 'gaps': sh['gaps'], 'note': sh['note'],
                   'grid': g, 'T': T, 'P': P, 'cnt': placed, 'has_wall': has_wall})

# ---------------- 校验 ----------------
for lv in LEVELS:
    g = lv['grid']
    # 占位对称：镜像格"有/无"必须一致（道具类型允许个别单颗不对称）
    for r in range(BOTTOM):
        for c in range(W // 2):
            assert (g[r][c] != '.') == (g[r][W - 1 - c] != '.'), (lv['id'], r, c)
    for a, b in lv['gaps']:
        assert 2 <= b - a + 1 <= 5

# ---------------- 输出 sheet ----------------
PROP_COLOR = {'T': '#C9A6FF', 'X': '#5B9BE0', 'L': '#FF8FB2', 'P': '#8FD98A', 'G': '#B9C4E8'}
PROP_GLYPH = {'T': '3', 'X': '*', 'L': '\u2665', 'P': '\u2014', 'G': '\u25c7'}

cards = []
for lv in LEVELS:
    cells = []
    for r in range(ROWS):
        for c in range(W):
            ch = lv['grid'][r][c]
            if r == BOTTOM:
                cells.append('<i class="w"></i>' if ch == 'W' else '<i class="gap"></i>')
            elif ch == '.':
                cells.append('<i class="e"></i>')
            elif ch == 'B':
                cells.append('<i class="b"></i>')
            elif ch == 'W':
                cells.append('<i class="w"></i>')
            else:
                cells.append('<i class="p" style="background:%s">%s</i>' % (PROP_COLOR[ch], PROP_GLYPH[ch]))
    inv = ' · '.join('%s×%d' % (NAMES[k], lv['cnt'][k]) for k in ORDER if lv['cnt'].get(k))
    gaps_txt = ' + '.join('w%d@%d-%d' % (b - a + 1, a, b) for a, b in lv['gaps'])
    wall_note = '' if lv['has_wall'] else ' · 无墙:墙隐权重转其余'
    cards.append(
        '<div class="card"><div class="hd"><span class="no">%d</span><span class="nm">%s</span>'
        '<span class="meta">总%d · 道具%d=⌈%d×6%%⌉</span></div>'
        '<div class="grid">%s</div>'
        '<div class="ft"><span>缝隙：%s</span></div>'
        '<div class="ft inv">%s%s</div></div>'
        % (lv['id'], lv['name'], lv['T'], lv['P'], lv['T'], ''.join(cells), gaps_txt, inv, wall_note))

html = u'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>疯狂小球弹一弹 · 十关地图设计稿 v10.7</title><style>
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
.w{background:#e8dcc6;border:1.5px solid #4a3f35;background-image:repeating-linear-gradient(90deg,transparent 0 10px,#c9b892 10px 12px)}
.gap{background:#DFF3FF;border:1.5px dashed #59C3F0}
.p{border:1.5px solid #4a3f35;color:#fff;font-size:9px;font-weight:900;font-style:normal;display:flex;align-items:center;justify-content:center;line-height:1}
.ft{display:flex;justify-content:space-between;margin-top:8px;font-size:10px;font-weight:800;color:#8a6d4f}
.ft.inv{margin-top:3px;color:#4a3f35}
.legend{max-width:820px;margin:26px auto 0;background:#fff;border:3px solid #4a3f35;border-radius:16px;box-shadow:4px 5px 0 rgba(74,63,53,.9);padding:12px 16px;font-size:12px;font-weight:800;color:#4a3f35;display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.legend i{display:inline-block;width:13px;height:13px;border:1.5px solid #4a3f35;border-radius:3px;vertical-align:-2px;margin-right:4px}
</style></head><body>
<h1>疯狂小球弹一弹 · 十关地图设计稿 v10.7</h1>
<div class="sub">24 列 x 22 行 · 造型对称 · 墙/道具位置固定 · 道具数=⌈总方块×6% · 比例 分裂4:爆炸1:生命1:挡板2:墙隐2 · 分裂球统一分裂3球 · 末行=底墙+缝隙(宽2-5)</div>
<div class="wrap">''' + '\n'.join(cards) + u'''</div>
<div class="legend">
<span><i style="background:#FFD166"></i>普通方块</span>
<span><i style="background:#e8dcc6;background-image:repeating-linear-gradient(90deg,transparent 0 6px,#c9b892 6px 7px)"></i>墙体(不可消除)</span>
<span><i style="background:#C9A6FF"></i>分裂球(消后生3球)</span>
<span><i style="background:#5B9BE0"></i>爆炸(3×3)</span>
<span><i style="background:#FF8FB2"></i>生命+1</span>
<span><i style="background:#8FD98A"></i>挡板加强</span>
<span><i style="background:#B9C4E8"></i>墙体隐形</span>
<span><i style="background:#DFF3FF;border-style:dashed"></i>底墙缝隙(入口)</span>
</div>
</body></html>'''

out = r'C:\Users\Administrator\Desktop\tantan-design\levels-10-sheet.html'
io.open(out, 'w', encoding='utf-8').write(html)
print('sheet written:', out)

maps = []
for lv in LEVELS:
    maps.append({'id': lv['id'], 'name': lv['name'], 'gaps': lv['gaps'],
                 'map': [''.join(r) for r in lv['grid']]})
io.open(r'C:\Users\Administrator\Desktop\tantan\tools\levels10b.json', 'w', encoding='utf-8').write(
    json.dumps(maps, ensure_ascii=False, indent=1))
print('maps json written: tools/levels10b.json')
for lv in LEVELS:
    print(lv['id'], lv['name'], 'T=%d P=%d' % (lv['T'], lv['P']),
          ' '.join('%s%d' % (k, lv['cnt'][k]) for k in ORDER if lv['cnt'].get(k)), lv['note'])
