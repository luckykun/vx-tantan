# -*- coding: utf-8 -*-
"""关卡统计：难度交错、道具镜像对称比例、挡板外层比例。"""
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

tp = tt = 0
p_outer = p_all = 0
diffs = []
for (lid, name), rws in levels:
    body = ''.join(rws[:CONTENT])
    nw = body.count('W')
    npr = sum(body.count(t) for t in 'TLPG')
    total = body.count('B') + nw + npr
    diffs.append(total)
    for r in range(CONTENT):
        for c in range(COLS):
            t = rws[r][c]
            if t in 'TLPG':
                tt += 1
                if rws[r][COLS - 1 - c] == t:
                    tp += 1
                if t == 'P':
                    p_all += 1
                    nb = 0
                    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        rr, cc = r + dr, c + dc
                        if 0 <= rr < CONTENT and 0 <= cc < COLS and rws[rr][cc] == 'B':
                            nb += 1
                    if nb < 4:
                        p_outer += 1

print('prop mirror-paired: %d/%d = %.0f%%' % (tp, tt, 100.0 * tp / tt))
print('Paddle on outer layer: %d/%d = %.0f%%' % (p_outer, p_all, 100.0 * p_outer / p_all))
hard = [d for d in diffs if d > 280]
print('levels>280 (hard):', len(hard))
print('first 20 totals:', diffs[:20])
