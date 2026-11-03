# -*- coding: utf-8 -*-
"""校验 levels.ts：总数182~456 / 墙0~15% / 道具5~10% / T不在缝上 / 缝隙≤5 / 阈值递增。"""
import re
import os
import sys

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'core', 'levels.ts')
lines = open(path, encoding='utf-8').read().splitlines()

ROWS, COLS, CONTENT = 22, 26, 21
HDR = re.compile(r"  \{ id:(\d+), name:'(.+?)', balls:3, starScores:\[(\d+),(\d+),(\d+)\], map:\[")
ROW = re.compile(r"    '([.BWTLPG]{%d})'," % COLS)

levels, cur, rows = [], None, []
for l in lines:
    m = HDR.match(l)
    if m:
        cur = (int(m.group(1)), m.group(2), int(m.group(3)), int(m.group(4)), int(m.group(5)))
        rows = []
        continue
    m2 = ROW.match(l)
    if m2 and cur is not None:
        rows.append(m2.group(1))
        continue
    if l.strip() == '] },' and cur is not None:
        levels.append((cur, rows))
        cur = None

print('parsed:', len(levels))
assert len(levels) == 300, 'expect 300 levels'
bad = 0
stat_total = []
for (lid, name, s1, s2, s3), rws in levels:
    if len(rws) != ROWS or any(len(r) != COLS for r in rws):
        bad += 1
        print('shape', lid)
        continue
    body = ''.join(rws[:CONTENT])
    bottom = rws[CONTENT]
    nw = body.count('W')
    npr = sum(body.count(t) for t in 'TLPG')
    nb = body.count('B')
    total = nb + nw + npr
    stat_total.append(total)
    if not (182 <= total <= 456):
        bad += 1
        print('TOTAL out of range', lid, total)
    if not (0 <= nw <= total * 0.15 + 0.5):
        bad += 1
        print('WALL ratio', lid, nw, total)
    if not (total * 0.05 - 1 <= npr <= total * 0.10 + 1):
        bad += 1
        print('PROP ratio', lid, npr, total)
    gaps = [c for c in range(COLS) if bottom[c] == '.']
    if not gaps:
        bad += 1
        print('NO GAP', lid)
    runs, s0 = [], None
    for i in range(COLS + 1):
        if i < COLS and bottom[i] == '.':
            if s0 is None:
                s0 = i
        else:
            if s0 is not None:
                runs.append(i - s0)
                s0 = None
    if any(w > 5 for w in runs):
        bad += 1
        print('GAP>5', lid, runs)
    for r in (CONTENT - 3, CONTENT - 2, CONTENT - 1):
        for c in gaps:
            if rws[r][c] == 'T':
                bad += 1
                print('T over gap', lid, r, c)
    if not (s1 < s2 < s3):
        bad += 1
        print('star order', lid)

print('violations:', bad)
print('total range: min=%d max=%d avg=%.0f' % (min(stat_total), max(stat_total), sum(stat_total) / len(stat_total)))

# 抽样输出
for i in (0, 4, 5, 9, 10, 100, 299):
    (lid, name, s1, s2, s3), rws = levels[i]
    body = ''.join(rws[:CONTENT])
    nb, nw = body.count('B'), body.count('W')
    npr = sum(body.count(t) for t in 'TLPG')
    props = {t: body.count(t) for t in 'TLPG'}
    print('L%-4d %-10s total=%3d B=%3d W=%2d(%4.1f%%) props=%2d(%4.1f%%) %s' % (
        lid, name, nb + nw + npr, nb, nw, 100.0 * nw / (nb + nw + npr),
        npr, 100.0 * npr / (nb + nw + npr), props))

sys.exit(1 if bad else 0)
