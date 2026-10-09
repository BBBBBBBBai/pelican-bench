"""ring-check.py —— 数一张截图里的琥珀像素，报告包围盒与四条边的覆盖情况。
用法：python ring-check.py <png> [阈值]
"""
import sys
from PIL import Image

path = sys.argv[1]
thr = int(sys.argv[2]) if len(sys.argv) > 2 else 120

im = Image.open(path).convert('RGB')
w, h = im.size
px = im.load()
pts = []
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        # 琥珀 #f0a020 附近：红高、绿中、蓝极低
        if r > thr and 90 < g < 230 and b < 110 and r - b > 100:
            pts.append((x, y))

print(f"file={path} size={w}x{h} amberPixels={len(pts)}")
if not pts:
    sys.exit(0)

xs = [p[0] for p in pts]
ys = [p[1] for p in pts]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
print(f"bbox=({x0},{y0})-({x1},{y1}) w={x1-x0+1} h={y1-y0+1}")

# 逐行/逐列的像素数，用来看四条边是否齐全
rows = {}
cols = {}
for x, y in pts:
    rows[y] = rows.get(y, 0) + 1
    cols[x] = cols.get(x, 0) + 1
top = sorted(rows.items())[:4]
bot = sorted(rows.items())[-4:]
left = sorted(cols.items())[:4]
right = sorted(cols.items())[-4:]
print("topRows   =", top)
print("bottomRows=", bot)
print("leftCols  =", left)
print("rightCols =", right)
