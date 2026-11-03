import io, sys

path = 'src/core/config.ts'
src = io.open(path, encoding='utf-8').read().split('\n')

# locate LEVELS block: line with 'var LEVELS = [' to the line '  ];'
start = None
end = None
for i, ln in enumerate(src):
    if ln.strip().startswith('var LEVELS = ['):
        start = i
    if start is not None and ln.strip() == '];' and i > start:
        end = i
        break
assert start is not None and end is not None, 'LEVELS block not found'

W = 24
def row(s):
    assert len(s) == W, (len(s), s)
    return "        '%s'," % s

levels = []
def lv(_id, name, tip, balls, star, rows):
    assert len(rows) == 22, (len(rows), _id)
    levels.append((_id, name, tip, balls, star, rows))

lv(1, '爱心初动', '拖空白瞄准发射；球落回时拖动横条，接住会朝你拖的方向弹回去。打掉道具块会立即在原位置生效！', 3, [55, 75], [
    row('........................'),
    row('........................'),
    row('......XXXX....XXXX......'),
    row('.....XXXXXX..XXXXXX.....'),
    row('....XXXXXXXXXXXXXXXX....'),
    row('....XXXXXXXXXXXXXXXX....'),
    row('.....XXXXXXXXXXXXXX.....'),
    row('......XXXXXXXXXXXX......'),
    row('.......XXXXXXXXXX.......'),
    row('........XXXXXXXX........'),
    row('.........XXXXXX.........'),
    row('..........XXXX..........'),
    row('...........XX...........'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWWWWWWWW.....WWWWWWWWW'),
])
lv(2, '菱形迷城', '缺口偏窄，内部有不可消除的墙壁，绕过它打击周围方块。', 3, [65, 85], [
    row('........................'),
    row('........................'),
    row('........................'),
    row('...........XX...........'),
    row('.........XXXXXX.........'),
    row('.......XXWWWWWWXX.......'),
    row('.....SSBBWWWWWWBBSS.....'),
    row('...BBBBBBWWWWWWBBBBBB...'),
    row('...BBBBBBWWWWWWBBBBBB...'),
    row('.....BBSSWWWWWWSSBB.....'),
    row('.......BBWWWWWWBB.......'),
    row('.........BBBBBB.........'),
    row('...........BB...........'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWW....WWWWWWWW....WWWW'),
])
lv(3, '沙漏迷阵', '窄缺口+满屏方块：先把回弹角度控好，别让球全撞底部墙壁，接住即回弹。', 3, [65, 85], [
    row('........................'),
    row('....XXXXXXXXXXXXXXXX....'),
    row('......XXXXXXXXXXXX......'),
    row('.........XXXXXX.........'),
    row('.........SBBBBS.........'),
    row('..........BBBB..........'),
    row('.........BBBBBB.........'),
    row('......BBBBBBBBBBBB......'),
    row('....BBBBBBBBBBBBBBBB....'),
    row('...BBBBBBBBBBBBBBBBBB...'),
    row('....BBBBBBBBBBBBBBBB....'),
    row('......BBBBBBBBBBBB......'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWWWWW......WWWWWWWWWWW'),
])
lv(4, '团圆初阵', '试试粉色生命方块：消除它，剩余发射 +1。', 3, [70, 90], [
    row('........................'),
    row('........................'),
    row('..........BBBB..........'),
    row('........BBBBBBBB........'),
    row('......BBBBBBBBBBBB......'),
    row('....BBBBSSBBBBSSBBBB....'),
    row('....BBBBLLBBBBLLBBBB....'),
    row('.....BBBBBBBBBBBBBB.....'),
    row('......BBBBBBBBBBBB......'),
    row('........BBBBBBBB........'),
    row('..........BBBB..........'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWW...WWWWWWWW......WWWW'),
])
lv(5, '十字雷阵', '蓝色爆炸方块：消除后在原位置清空 3×3 区域。', 3, [55, 70], [
    row('........................'),
    row('........................'),
    row('........BBSBBSBB........'),
    row('........BBBBBBBB........'),
    row('........BBBBBBBB........'),
    row('........BBBBBBBB........'),
    row('....BBBXXXBBBBXXXBBB....'),
    row('....BBBBBBBBBBBBBBBB....'),
    row('........BBBBBBBB........'),
    row('........BBBBBBBB........'),
    row('........BBBBBBBB........'),
    row('........BBBBBBBB........'),
    row('........BBSBBSBB........'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWWWWWWWWWWWWWW........'),
])
lv(6, '拱门守卫', '绿色挡板方块：消除后挡板满宽 30 秒，最后 3 秒闪烁倒计时。', 3, [40, 50], [
    row('........................'),
    row('........................'),
    row('....BBBBBBBBBBBBBBBB....'),
    row('....BBBBBBBBBBBBBBBB....'),
    row('....PPSS........SSPP....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('....BBBB........BBBB....'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWWWW...WWWWWWWWW...WWW'),
])
lv(7, '盾牌密纹', '窄缺口 + 尖底：把回弹角度压住，别让球撞墙溜走。', 3, [60, 80], [
    row('........................'),
    row('........................'),
    row('...BBBBBBBBBBBBBBBBBB...'),
    row('...BBBBXXBBBBBBXXBBBB...'),
    row('....BBBBBBBBBBBBBBBB....'),
    row('.....BBBBBBBBBBBBBB.....'),
    row('.....BBBBSBBBBSBBBB.....'),
    row('......BBBLBBBBLBBB......'),
    row('.......BBBBBBBBBB.......'),
    row('........BBBBBBBB........'),
    row('.........BBBBBB.........'),
    row('...........BB...........'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWWWWWW......WWWWWWWWWW'),
])
lv(8, '蝶舞双谷', '中间是打不穿的墙壁，绕道打两侧的叶子。', 3, [45, 60], [
    row('........................'),
    row('........................'),
    row('....BBBBSBBBBBBSBBBB....'),
    row('.....BBBBBBBBBBBBBB.....'),
    row('......BBBBBBBBBBBB......'),
    row('..........WWWW..........'),
    row('..........WWWW..........'),
    row('......BBBBBBBBBBBB......'),
    row('.....BBBXBBBBBBXBBB.....'),
    row('....BBBBSBBBBBBSBBBB....'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWW..WWWWWWWW..WWWWWWWW'),
])
lv(9, '菱形城心', '核心是墙，外壳是砖：先剥外圈，再消除中间的炸弹方块直接引爆。', 3, [65, 80], [
    row('........................'),
    row('........................'),
    row('.........BBBBBB.........'),
    row('.......BBBBBBBBBB.......'),
    row('......BBBSBBBBSBBB......'),
    row('.....BBBBWWWWWWBBBB.....'),
    row('....BBXBBWWWWWWBBXBB....'),
    row('...BBBBPBWWWWWWBPBBBB...'),
    row('...BBBBBBWWWWWWBBBBBB...'),
    row('....BBBBSBBBBBBSBBBB....'),
    row('.....BBBBBBBBBBBBBB.....'),
    row('......BBBBBBBBBBBB......'),
    row('........BBBBBBBB........'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWWWWWWWWW........WWWWWW'),
])
lv(10, '糖果堡垒', '最终考验：满屏方块、中心墙柱、窄缺口。用好每一个道具！', 3, [65, 85], [
    row('........................'),
    row('........................'),
    row('..BBSSBBBBBBBBBBBBSSBB..'),
    row('..BBSSBBBBBBBBBBBBSSBB..'),
    row('..BBBBBXBBBBBBBBXBBBBB..'),
    row('..BBBBBBBBWWWWBBBBBBBB..'),
    row('..BBLBBBBBWWWWBBBBBLBB..'),
    row('..BBBBPBBBWWWWBBBPBBBB..'),
    row('..BBBBBBBBWWWWBBBBBBBB..'),
    row('..BBLBBBBBWWWWBBBBBLBB..'),
    row('..BBBBBBBBWWWWBBBBBBBB..'),
    row('..BBBBBXBBBBBBBBXBBBBB..'),
    row('..BBBBBBBBBBBBBBBBBBBB..'),
    row('..BBBBBBBBBBBBBBBBBBBB..'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('........................'),
    row('WWW...WWWWWWWW......WWWW'),
])

out = []
out.append('  var LEVELS = [')
for (_id, name, tip, balls, star, rows) in levels:
    out.append('    {')
    out.append('      id: %d,' % _id)
    out.append("      name: '%s'," % name)
    out.append("      tip: '%s'," % tip)
    out.append('      balls: %d,' % balls)
    out.append('      starTimes: [%d, %d],' % (star[0], star[1]))
    out.append('      map: [')
    out.extend(rows)
    out.append('      ]')
    out.append('    },')
out.append('  ];')

new = src[:start] + out + src[end+1:]
io.open(path, 'w', encoding='utf-8').write('\n'.join(new))
print('replaced lines %d-%d with %d lines' % (start+1, end+1, len(out)))
