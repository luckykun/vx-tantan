# -*- coding: utf-8 -*-
"""
v10.28 关卡生成器：产出 src/core/levels.ts（300 关，内容区 19 行 × 24 列 = 456 格）。
规格（用户拍板）：
  - 每关方块总数（含墙体与道具）∈ [182, 456]（40%~100%）；
  - 墙体 W 占总数 0%~15%；
  - 道具占总数 5%~10%；道具类型比例 分裂T:生命L:墙隐G:挡板P = 5:2:1:2；
  - 道具分布：挡板偏外层，其余随机；成对时左右对称；整体分散（切比雪夫距离≥3）；
  - 难度交错：模式 EEEEHEEEHH（4简单+1难+3简单+2难），整体随序号渐难；
  - 第 1 关固定爱心形状；
  - 分裂球 T 不放底部缝隙正上方（底部3行×缝隙列）；缝隙宽 2~5；
  - starScores=[一星,二星,三星] 按满局分推导；生成器内预居中（与引擎一致）。
用法：python gen_levels.py
"""
import math
import random
import os

ROWS, COLS = 22, 26                 # v10.29：24×20 → 26×22（网格加密，方块更精细）
WALL_ROW = ROWS - 1
CONTENT = ROWS - 1                  # 内容区 0..20，共 21 行
HALF = COLS // 2                    # 左半场列数 = 13（镜像用，MIRROR 覆盖右半场）
CX = (COLS - 1) / 2.0               # 中心轴 = 12.5（形状模板居中基准）
SEED = 20261102
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'core', 'levels.ts')
PATTERN = 'EEEEHEEEHH'          # 难度交错模式（10 关一循环）
MIRROR = lambda c: COLS - 1 - c

rng = random.Random(SEED)


def to_intervals(cells):
    out, s, p = [], cells[0], cells[0]
    for c in cells[1:]:
        if c == p + 1:
            p = c
            continue
        out.append((s, p))
        s = p = c
    out.append((s, p))
    return out


def clip(ivs):
    return [(max(0, a), min(COLS - 1, b)) for a, b in ivs if a <= b and b >= 0 and a < COLS]


# ---------------------------------------------------------------- 形状模板

def t_rect(n, d):
    hollow = d > 0.45 and n > 6
    rows = []
    for r in range(n):
        if hollow and 1 <= r <= n - 2:
            rows.append(clip([(2, 5), (COLS - 6, COLS - 3)]))
        else:
            rows.append(clip([(2, COLS - 3)]))
    return rows


def t_diamond(n, d):
    rows, cy = [], (n - 1) / 2.0
    for r in range(n):
        w = max(1, int(round(CX * (1 - abs(r - cy) / (cy + 0.01)))))
        rows.append(clip([(12 - w, 13 + w)]))
    return rows


def _pt_in_poly(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


_HEART_POLY = None


def _heart_poly():
    global _HEART_POLY
    if _HEART_POLY is None:
        pts = []
        for i in range(1440):
            t = 2 * math.pi * i / 1440
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            pts.append((x, y))
        _HEART_POLY = pts
    return _HEART_POLY


def t_heart(n, d):
    # 经典爱心（手工行型，顶部凹口清晰），15 行；不足 n 时末行保持
    pat = [
        [(6, 10), (15, 19)],
        [(5, 11), (14, 20)],
        [(4, 11), (14, 21)],
        [(3, 22)],
        [(3, 22)],
        [(3, 22)],
        [(4, 21)],
        [(5, 20)],
        [(6, 19)],
        [(7, 18)],
        [(8, 17)],
        [(9, 16)],
        [(10, 15)],
        [(11, 14)],
        [(12, 13)],
    ]
    rows = []
    for r in range(n):
        rows.append(clip(pat[min(r, len(pat) - 1)]))
    return rows


def t_ring(n, d):
    rows, cy = [], (n - 1) / 2.0
    for r in range(n):
        dy = (r - cy) * (CX / max(cy, 1))
        cells = [c for c in range(COLS)
                 if 6.5 <= math.sqrt((c - CX) ** 2 + dy ** 2) <= 12.6]
        rows.append(to_intervals(cells) if cells else [])
    return rows


def t_hourglass(n, d):
    rows, cy = [], (n - 1) / 2.0
    for r in range(n):
        k = abs(r - cy) / (cy + 0.01)
        w = max(1, int(round(2 + 9.5 * k)))
        inner = max(2, w // 4)
        rows.append(clip([(12 - w, 12 - inner), (13 + inner, 13 + w)]))
    return rows


def t_arch(n, d):
    rows = []
    for r in range(n):
        t = r / (n - 1.0)
        if t < 0.55:
            w = max(3, int(round(3 + 8 * (t / 0.55) ** 1.6)))
            inner = max(2, int(w * 0.32))
        else:
            w, inner = 11, 3
        rows.append(clip([(12 - w, 12 - inner), (13 + inner, 13 + w)]))
    return rows


def t_cross(n, d):
    rows, cy = [], (n - 1) / 2.0
    for r in range(n):
        if abs(r - cy) <= 1.5:
            rows.append(clip([(2, COLS - 3)]))
        else:
            rows.append(clip([(10, 15)]))
    return rows


def t_towers(n, d):
    rows = []
    for r in range(n):
        if r < 2 and n > 6:
            rows.append(clip([(4, 11), (14, 21)]))
        else:
            rows.append(clip([(4, 9), (16, 21)]))
    return rows


def t_wave(n, d):
    rows = []
    for r in range(n):
        shift = int(round(3.5 * math.sin(r * math.pi / 3.2)))
        a, b = max(1, min(2 + shift, 8)), max(COLS - 9, min(COLS - 3 + shift, COLS - 2))
        rows.append(clip([(a, b)]))
    return rows


def t_butterfly(n, d):
    rows = []
    for r in range(n):
        t = r / (n - 1.0)
        w = max(2, int(round(2 + 9.5 * abs(math.sin(t * math.pi)))))
        rows.append(clip([(12 - w, 11), (14, 13 + w)]))
    return rows


def t_shield(n, d):
    rows, cut = [], int(n * 0.55)
    for r in range(n):
        w = 12 if r < cut else max(1, int(round(12 * (1 - (r - cut) / (n - cut + 0.01)))))
        rows.append(clip([(12 - w, 13 + w)]))
    return rows


def t_arrow(n, d):
    rows = []
    for r in range(n):
        w = max(1, int(round(2 + 9.5 * (r / (n - 1.0)))))
        rows.append(clip([(12 - w, 13 + w)]))
    return rows


def t_frame(n, d):
    rows = []
    for r in range(n):
        if r <= 1 or r >= n - 2:
            rows.append(clip([(1, COLS - 2)]))
        else:
            rows.append(clip([(1, 4), (COLS - 5, COLS - 2)]))
    return rows


def t_columns(n, d):
    return [clip([(3, 6), (11, 14), (19, 22)]) for _ in range(n)]


def t_checker(n, d):
    rows = []
    for r in range(n):
        cells = [c for c in range(1, COLS - 1) if (c // 2 + r) % 2 == 0]
        rows.append(to_intervals(cells) if cells else [])
    return rows


def t_blob(n, d):
    rows = []
    for r in range(n):
        w = int(round(9 + 2.5 * math.sin(r * math.pi / 3.0)))
        rows.append(clip([(12 - w, 13 + w)]))
    return rows


TEMPLATES = [
    ('爱心初动', t_heart), ('菱形迷城', t_diamond), ('环形回廊', t_ring),
    ('拱门守卫', t_arch), ('十字方阵', t_cross), ('双塔奇兵', t_towers),
    ('沙漏迷阵', t_hourglass), ('蝶舞双谷', t_butterfly), ('坚盾壁垒', t_shield),
    ('利箭穿云', t_arrow), ('画框秘境', t_frame), ('三柱擎天', t_columns),
    ('矩形阵列', t_rect), ('浪涌节拍', t_wave), ('云团叠嶂', t_blob),
]


# ---------------------------------------------------------------- 工具

def count_cells(grid):
    return sum(1 for r in range(CONTENT) for c in range(COLS) if grid[r][c] == 'B')


def b_neighbors(grid, r, c):
    n = 0
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        rr, cc = r + dr, c + dc
        if 0 <= rr < CONTENT and 0 <= cc < COLS and grid[rr][cc] == 'B':
            n += 1
    return n


def is_outer(grid, r, c):
    return b_neighbors(grid, r, c) < 4


def nb_all(grid, r, c):
    """8 邻域内非空格数（判断孤立）。"""
    n = 0
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            rr, cc = r + dr, c + dc
            if 0 <= rr < CONTENT and 0 <= cc < COLS and grid[rr][cc]:
                n += 1
    return n


def cleanup_isolated(grid):
    """移除完全孤立的方块/墙体（8 邻域无其他块），迭代至稳定。"""
    changed = True
    rounds = 0
    while changed and rounds < 30:
        changed = False
        rounds += 1
        for r in range(CONTENT):
            for c in range(COLS):
                if grid[r][c] in ('B', 'W') and nb_all(grid, r, c) == 0:
                    grid[r][c] = None
                    changed = True


def carve_channel(grid, gap_cols):
    """缝隙正上方内容区清空 2 行，保证小球能穿缝进入（通道）。"""
    for c in gap_cols:
        for r in (WALL_ROW - 1, WALL_ROW - 2):
            if 0 <= r < CONTENT and grid[r][c] in ('B', 'W', 'T', 'L', 'P', 'G'):
                grid[r][c] = None


def fill_small_pockets(grid, avoid=None):
    """只填被方块完全包围的"小空洞"（洪泛封闭空区 ≤2 格）→ 补 B。
       不碰环形/画框等大空心区（那些是设计意图）。"""
    avoid = avoid or set()
    seen = set()
    for r in range(CONTENT):
        for c in range(COLS):
            if grid[r][c] is not None or (r, c) in avoid or (r, c) in seen:
                continue
            # BFS 收集这块连通空区，判断是否"封闭"（不接触边界/大开口）
            region, stack, enclosed = [], [(r, c)], True
            seen.add((r, c))
            while stack:
                cr, cc = stack.pop()
                region.append((cr, cc))
                for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nr, nc = cr + dr, cc + dc
                    if not (0 <= nr < CONTENT and 0 <= nc < COLS):
                        enclosed = False
                        continue
                    if (nr, nc) in seen:
                        continue
                    if grid[nr][nc] is None:
                        seen.add((nr, nc))
                        stack.append((nr, nc))
            if enclosed and 1 <= len(region) <= 2 and all(p not in avoid for p in region):
                for (pr, pc) in region:
                    grid[pr][pc] = 'B'


def prune_isolated_walls(grid):
    """孤立墙体（8邻域无其他 W）还原为 B，保证墙成团。"""
    for _ in range(3):
        iso = []
        for r in range(CONTENT):
            for c in range(COLS):
                if grid[r][c] == 'W':
                    hasw = any(0 <= r + dr < CONTENT and 0 <= c + dc < COLS
                               and grid[r + dr][c + dc] == 'W'
                               for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr or dc))
                    if not hasw:
                        iso.append((r, c))
        if not iso:
            break
        for (r, c) in iso:
            grid[r][c] = 'B'


def adjust_count(grid, target, avoid=None):
    """对称增删 B 格逼近 target，保持形状凝聚：
       削减只从边界腐蚀（邻居≤2），增补只贴附强连接位（邻居≥2），最后填小口袋。"""
    avoid = avoid or set()
    cnt = count_cells(grid)
    guard = 0
    while cnt > target + 1 and guard < 4000:      # 削减：仅边界腐蚀，绝不在内部打洞
        guard += 1
        cells = [(r, c) for r in range(CONTENT) for c in range(HALF)
                 if grid[r][c] == 'B' and b_neighbors(grid, r, c) <= 2]
        if not cells:
            cells = [(r, c) for r in range(CONTENT) for c in range(HALF)
                     if grid[r][c] == 'B' and b_neighbors(grid, r, c) <= 3]
        if not cells:
            break
        r, c = rng.choice(cells)
        mc = MIRROR(c)
        for cc in (c, mc):
            if grid[r][cc] == 'B':
                grid[r][cc] = None
                cnt -= 1
    guard = 0
    while cnt < target - 1 and guard < 4000:      # 增补：先贴强连接位，无解时退化到 ≥1 邻居
        guard += 1
        empt = [(r, c) for r in range(CONTENT) for c in range(HALF)
                if grid[r][c] is None and (r, c) not in avoid and b_neighbors(grid, r, c) >= 2]
        if not empt:
            empt = [(r, c) for r in range(CONTENT) for c in range(HALF)
                    if grid[r][c] is None and (r, c) not in avoid and b_neighbors(grid, r, c) >= 1]
        if not empt:
            break
        r, c = rng.choice(empt)
        mc = MIRROR(c)
        grid[r][c] = 'B'
        cnt += 1
        if grid[r][mc] is None and (r, mc) not in avoid:
            grid[r][mc] = 'B'
            cnt += 1


def plant_walls(grid, wall_n):
    """对称植入墙体（柱/带/块/斜），把 B 转成 W，直至 wall_n。"""
    placed = 0
    styles = ['pillars', 'band', 'block', 'diagonal']
    tries = 0
    while placed < wall_n and tries < 60:
        tries += 1
        style = rng.choice(styles)
        spots = []
        if style == 'pillars':
            wx = rng.randint(2, 10)
            r0 = rng.randint(0, CONTENT - 4)
            ln = rng.randint(3, min(8, CONTENT - r0))
            for r in range(r0, r0 + ln):
                spots += [(r, 12 - wx), (r, 13 + wx)]
        elif style == 'band':
            rb = rng.randint(1, CONTENT - 2)
            for c in range(2, HALF):
                spots += [(rb, c), (rb, MIRROR(c))]
        elif style == 'block':
            cx = rng.randint(2, 11)
            ry = rng.randint(1, CONTENT - 3)
            for r in (ry, ry + 1):
                for c in (12 - cx, 12 - cx + 1, 13 + cx - 1, 13 + cx):
                    spots.append((r, c))
        else:
            for i in range(rng.randint(4, 8)):
                r = rng.randint(0, CONTENT - 1 - 7) + i
                c = max(1, 11 - i)
                spots += [(r, c), (r, MIRROR(c))]
        for (r, c) in spots:
            if placed >= wall_n:
                break
            if 0 <= r < CONTENT and 0 <= c < COLS and grid[r][c] == 'B':
                grid[r][c] = 'W'
                placed += 1
    return placed


def pick_gaps(idx, r):
    """底部缝隙列集合，宽 2~5。"""
    def span(w, lo, hi):
        g0 = rng.randint(lo, hi - w + 1)
        return list(range(g0, g0 + w))

    if idx < 5:
        return set(span(rng.randint(4, 5), 3, COLS - 4))
    easy = PATTERN[idx % 10] == 'E'
    if easy:
        if rng.random() < 0.5:
            return set(span(rng.randint(3, 4), 2, COLS - 3))
        return set(span(2, 1, 8)) | set(span(2, COLS - 8, COLS - 1))
    else:
        w = 2 if rng.random() < 0.6 else 3
        if rng.random() < 0.6:
            return set(span(w, 3, COLS - 4))
        return set(span(w, 1, 8)) | set(span(w, COLS - 8, COLS - 1))


def place_props(grid, want, gap_cols):
    """按 T:L:G:P 比例放置道具：挡板偏外层、成对对称、分散（距离≥3，逐级放宽）。"""
    placed = []

    def cands(outer_only):
        out = []
        for r in range(CONTENT):
            for c in range(COLS):
                if grid[r][c] != 'B':
                    continue
                if outer_only and not is_outer(grid, r, c):
                    continue
                out.append((r, c))
        return out

    def dist_ok(cell, md):
        return all(max(abs(cell[0] - p[0]), abs(cell[1] - p[1])) >= md for p in placed)

    def legal(t, r, c):
        # 任何道具都不放在缝隙正上方底部 3 行（避免首发轻松命中）
        if c in gap_cols and r >= WALL_ROW - 3:
            return False
        return True

    for t, n in want:
        outer_only = (t == 'P')
        for md in (3, 2, 1, 0):
            if n <= 0:
                break
            pool = cands(outer_only) or cands(False)
            rng.shuffle(pool)
            left = [(r, c) for (r, c) in pool if c < HALF]
            for (r, c) in left:
                if n <= 0:
                    break
                if grid[r][c] != 'B' or not legal(t, r, c):
                    continue
                mc = MIRROR(c)
                if n >= 2 and grid[r][mc] == 'B' and legal(t, r, mc) \
                        and dist_ok((r, c), md) and dist_ok((r, mc), md):
                    grid[r][c] = grid[r][mc] = t
                    placed += [(r, c), (r, mc)]
                    n -= 2
                elif n == 1 and dist_ok((r, c), md):
                    grid[r][c] = t
                    placed.append((r, c))
                    n -= 1
            if n > 0:
                # 单数收尾：任意合法格
                for (r, c) in pool:
                    if grid[r][c] == 'B' and legal(t, r, c) and dist_ok((r, c), md):
                        grid[r][c] = t
                        placed.append((r, c))
                        n -= 1
                        break
    return len(placed)


def recenter(grid):
    def nonempty(r):
        return any(grid[r][c] for c in range(COLS))
    tops = [r for r in range(CONTENT) if nonempty(r)]
    if not tops:
        return
    t0, b0 = tops[0], tops[-1]
    h = b0 - t0 + 1
    shift = math.floor((CONTENT - h) / 2.0 + 0.5) - t0
    if shift == 0:
        return
    band = [row[:] for row in grid[:CONTENT]]
    for r in range(CONTENT):
        src = r - shift
        grid[r] = band[src][:] if 0 <= src < CONTENT else [None] * COLS


# ---------------------------------------------------------------- 关卡构建

def build_level(idx):
    r = idx / 299.0
    easy = idx < 5 or PATTERN[idx % 10] == 'E'   # 前 5 关强制简单，之后按 EEEEHEEHH 交错

    if idx == 0:
        name, tf = '爱心初动', t_heart
        n = 15                                   # 爱心手工行型自然高度，不增删变形
        target = None
        wall_frac, prop_frac = 0.0, 0.065
    elif easy:
        name, tf = TEMPLATES[rng.randrange(len(TEMPLATES))]
        n = rng.randint(15, 19)
        target = rng.randint(205, 250) + int(r * 40)   # 下限留余量（通道/清理损耗）
        wall_frac = rng.uniform(0.0, 0.05)
        prop_frac = rng.uniform(0.05, 0.07)
    else:
        name, tf = TEMPLATES[rng.randrange(len(TEMPLATES))]
        n = rng.randint(17, 19)
        target = min(456, rng.randint(300, 360) + int(r * 96))
        wall_frac = rng.uniform(0.08, 0.15)
        prop_frac = rng.uniform(0.07, 0.10)

    iv_rows = tf(n, 0.0 if easy or idx == 0 else r)

    grid = [[None] * COLS for _ in range(ROWS)]
    top = (CONTENT - n) // 2
    for row in range(n):
        for (a, b) in iv_rows[row]:
            for c in range(a, b + 1):
                grid[top + row][c] = 'B'

    recenter(grid)

    # 底部墙壁行 + 缝隙通道（缝隙正上方内容区留空 2 行，保证小球能穿缝进出）
    gap_cols = pick_gaps(idx, r)
    for c in range(COLS):
        grid[WALL_ROW][c] = '.' if c in gap_cols else 'W'
    carve_channel(grid, gap_cols)
    channel = set((r, c) for c in gap_cols for r in (WALL_ROW - 1, WALL_ROW - 2))

    # 墙体（对称成团）→ 去孤立 → 数量调整（最后一步，保证达 floor 且不占用通道）
    if target is not None:
        plant_walls(grid, int(round(count_cells(grid) * wall_frac)))
        prune_isolated_walls(grid)
        cleanup_isolated(grid)
        adjust_count(grid, target, avoid=channel)   # 逼近 target（≥floor），只贴附生长
        fill_small_pockets(grid, avoid=channel)     # 仅增补，保持 ≥target
        # 最终：清孤立 + 保底 floor（补的块有邻居，不再生孤立）
        for _ in range(4):
            cleanup_isolated(grid)
            cur = count_cells(grid) + sum(1 for rr in range(CONTENT) for cc in range(COLS) if grid[rr][cc] == 'W')
            if cur >= 186:
                break
            adjust_count(grid, count_cells(grid) + (192 - cur), avoid=channel)
    else:
        cleanup_isolated(grid)

    total = count_cells(grid) + sum(
        1 for rr in range(CONTENT) for cc in range(COLS) if grid[rr][cc] == 'W')
    p_lo = max(4, math.ceil(total * 0.05))
    p_hi = max(p_lo, int(total * 0.10))
    p = min(p_hi, max(p_lo, int(round(total * prop_frac))))
    t_n = int(p * 0.5 + 0.5)
    l_n = int(p * 0.2 + 0.5)
    g_n = int(p * 0.1 + 0.5)
    pd_n = max(0, p - t_n - l_n - g_n)
    if pd_n == 0 and p >= 5:
        pd_n, t_n = 1, t_n - 1
    place_props(grid, [('P', pd_n), ('T', t_n), ('L', l_n), ('G', g_n)], gap_cols)

    rows = [''.join(ch if ch else '.' for ch in g) for g in grid]
    body = ''.join(rows[:CONTENT])
    nb = body.count('B')
    npr = sum(body.count(t) for t in 'TLPG')
    nw = body.count('W')
    return name, rows, nb, npr, nw


def star_scores(nb, npr):
    base = nb * 10 + npr * 30
    total = nb + npr
    s1 = base + 150
    s2 = base + 450 + total * 2
    s3 = base + 800 + total * 4
    return [int(round(v / 10.0) * 10) for v in (s1, s2, s3)]


def main():
    lines = ['/* 自动生成：300 关卡（tools/gen_levels.py, seed=%d, 22行x26列）。请勿手工编辑。 */' % SEED,
             'export const LEVELS_300 = [']
    used = {}
    for i in range(300):
        name, rows, nb, npr, nw = build_level(i)
        used[name] = used.get(name, 0) + 1
        disp = name if (used[name] == 1 or i < 5) else '%s·%d' % (name, used[name])
        ss = star_scores(nb, npr)
        lines.append('  { id:%d, name:\'%s\', balls:3, starScores:[%d,%d,%d], map:[' % (
            i + 1, disp, ss[0], ss[1], ss[2]))
        for rw in rows:
            assert len(rw) == COLS, (i, rw)
            lines.append("    '%s'," % rw)
        lines.append('  ] },')
    lines.append('];')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print('written:', os.path.normpath(OUT), '| levels: 300')


if __name__ == '__main__':
    main()
