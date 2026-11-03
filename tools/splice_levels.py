# -*- coding: utf-8 -*-
"""把 tools/levels10b.json 的 10 关地图写入 src/core/config.ts 的 LEVELS 数组。"""
import io, json

maps = json.load(io.open(r'C:\Users\Administrator\Desktop\tantan\tools\levels10b.json', encoding='utf-8'))

TIPS = {
    1: '拖空白瞄准发射；球落回时拖动横条，接住会朝你拖的方向弹回去。打掉道具块会立即在原位置生效！',
    2: '缺口偏窄，内部有不可消除的墙壁，绕过它打击周围方块。',
    3: '窄缺口+满屏方块：先把回弹角度控好，别让球全撞底部墙壁，接住即回弹。',
    4: '试试粉色生命方块：消除它，剩余发射 +1。',
    5: '蓝色爆炸方块：消除后在原位置清空 3×3 区域。',
    6: '绿色挡板方块：消除后挡板满宽 30 秒，最后 3 秒闪烁倒计时。',
    7: '窄缺口 + 尖底：把回弹角度压住，别让球撞墙溜走。',
    8: '中间是打不穿的墙身，绕道打两侧的翅膀。',
    9: '宽口速通局：箭头尖部密集，优先消除分裂球提高效率。',
    10: '最终考验：满屏方块、中心墙柱、窄缺口。用好每一个道具！',
}
STARS = {1: [55, 75], 2: [65, 85], 3: [65, 85], 4: [70, 90], 5: [55, 70],
         6: [40, 50], 7: [60, 80], 8: [45, 60], 9: [65, 80], 10: [65, 85]}

out = ['  var LEVELS = [']
for m in maps:
    out.append('    {')
    out.append('      id: %d,' % m['id'])
    out.append("      name: '%s'," % m['name'])
    out.append("      tip: '%s'," % TIPS[m['id']])
    out.append('      balls: 3,')
    out.append('      starTimes: [%d, %d],' % (STARS[m['id']][0], STARS[m['id']][1]))
    out.append('      map: [')
    for r in m['map']:
        out.append("        '%s'," % r)
    out.append('      ]')
    out.append('    },')
out.append('  ];')
block = '\n'.join(out)

path = r'C:\Users\Administrator\Desktop\tantan\src\core\config.ts'
src = io.open(path, encoding='utf-8').read().split('\n')
start = end = None
for i, ln in enumerate(src):
    if ln.strip().startswith('var LEVELS = ['):
        start = i
    if start is not None and ln.strip() == '];' and i > start:
        end = i
        break
assert start is not None and end is not None
new = src[:start] + block.split('\n') + src[end + 1:]
io.open(path, 'w', encoding='utf-8').write('\n'.join(new))
print('LEVELS replaced: lines %d-%d -> %d lines' % (start + 1, end + 1, len(out)))
