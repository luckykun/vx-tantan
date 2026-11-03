# -*- coding: utf-8 -*-
"""把 levels.ts 前 N 关渲染成 SVG 预览图（用于快速核对网格/形状是否对称）。

用法：python tools/gen_preview.py [关卡数] [输出路径]
"""
import io
import os
import re
import sys

COLS, ROWS = 26, 22          # 需与 config.ts / gen_levels.py 保持一致
CELL = 11                    # 预览格子边长（px）
COL = {'B': '#FFD166', 'W': '#e8dcc6', 'T': '#C9A6FF',
       'L': '#FF8FB2', 'P': '#8FD98A', 'G': '#B9C4E8'}
INK = '#4a3f35'

root = os.path.dirname(os.path.abspath(__file__))
src = io.open(os.path.join(root, '..', 'src', 'core', 'levels.ts'), encoding='utf-8').read().splitlines()
HDR = re.compile(r"  \{ id:(\d+), name:'(.+?)', balls:3, starScores:\[(\d+),(\d+),(\d+)\], map:\[")
ROW = re.compile(r"    '([.BWTLPG]{%d})'," % COLS)

levels, cur, rows = [], None, []
for l in src:
    m = HDR.match(l)
    if m:
        cur = (int(m.group(1)), m.group(2))
        rows = []
        continue
    m2 = ROW.match(l)
    if m2 and cur is not None:
        rows.append(m2.group(1))
        continue
    if l.strip() == '] },' and cur is not None:
        levels.append((cur, rows))
        cur = None

n_show = int(sys.argv[1]) if len(sys.argv) > 1 else 6
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, '..', '..', 'tantan-design', 'levels-preview.svg')

BW, BH = COLS * CELL, ROWS * CELL
per_row = 3
cols_n = min(per_row, n_show)
rows_n = (n_show + per_row - 1) // per_row
W = 30 * 2 + cols_n * BW + 15 * (cols_n - 1)
H = 50 + rows_n * (BH + 80) + 20

out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
       '<rect width="%d" height="%d" fill="#fff"/>' % (W, H),
       '<text x="30" y="30" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="%s">'
       '%d 列 x %d 行 · 前 %d 关预览</text>' % (INK, COLS, ROWS, n_show)]

for i, ((lid, name), rws) in enumerate(levels[:n_show]):
    x0 = 30 + (i % per_row) * (BW + 15)
    y0 = 50 + (i // per_row) * (BH + 80)
    body = ''.join(rws[:ROWS - 1])
    n = sum(body.count(c) for c in 'BWTLPG')
    out.append('<text x="%d" y="%d" font-family="system-ui,sans-serif" font-size="12" font-weight="600" '
               'fill="%s">L%d %s · %d 块</text>' % (x0, y0 - 6, INK, lid, name, n))
    # 大方框：无下边框，上方两角圆角
    out.append('<path d="M%d %d L%d %d Q%d %d %d %d L%d %d Q%d %d %d %d" fill="none" stroke="%s" stroke-width="1.5"/>'
               % (x0, y0 + BH, x0, y0 + 8, x0, y0, x0 + 8, y0,
                  x0 + BW - 8, y0, x0 + BW, y0, x0 + BW, y0 + 8, INK))
    out.append('<path d="M%d %d L%d %d" fill="none" stroke="%s" stroke-width="1.5"/>'
               % (x0 + BW, y0 + 8, x0 + BW, y0 + BH, INK))
    out.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#faf6ec"/>' % (x0, y0, BW, BH))
    for r in range(ROWS):
        for c in range(COLS):
            ch = rws[r][c]
            if ch == '.':
                continue
            out.append('<rect x="%s" y="%s" width="%d" height="%d" rx="2" fill="%s" stroke="%s" stroke-width="0.5"/>'
                       % (x0 + c * CELL + 0.5, y0 + r * CELL + 0.5, CELL - 1, CELL - 1, COL[ch], INK))
out.append('</svg>')

io.open(dst, 'w', encoding='utf-8').write('\n'.join(out))
print('written: %s | levels parsed: %d' % (os.path.abspath(dst), len(levels)))
