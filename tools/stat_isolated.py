# -*- coding: utf-8 -*-
"""统计全 300 关完全孤立块（8邻域无其他块）数量，验证第1项约束。"""
import re
import os

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'core', 'levels.ts')
lines = open(path, encoding='utf-8').read().splitlines()
ROWS, COLS, CONTENT = 22, 26, 21
HDR = re.compile(r"  \{ id:(\d+), name:'(.+?)', balls:3, starScores:\[(\d+),(\d+),(\d+)\], map:\[")
ROW = re.compile(r"    '([.BWTLPG]{%d})'," % COLS)

levels, cur, rows = [], None, []
for l in lines:
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

tot_iso = 0
worst = []
for (lid, name), rws in levels:
    g = [list(r) for r in rws[:CONTENT]]
    iso = 0
    for r in range(CONTENT):
        for c in range(COLS):
            if g[r][c] in 'BWTLPG':
                nb = sum(1 for dr in (-1, 0, 1) for dc in (-1, 0, 1)
                         if (dr or dc) and 0 <= r + dr < CONTENT and 0 <= c + dc < COLS
                         and g[r + dr][c + dc] != '.')
                if nb == 0:
                    iso += 1
    tot_iso += iso
    if iso:
        worst.append((lid, name, iso))

print('total isolated blocks across 300 levels:', tot_iso)
print('levels with any isolated block:', len(worst))
for lid, name, iso in worst[:15]:
    print('  L%d %s: %d' % (lid, name, iso))
