"""把圆角修复前/后的标本页放大对比：左上角那一块，正是圆角最显眼的地方。
   上 = 修复前（天空的圆角浮在暗底上），下 = 修复后（四边直角对齐）。"""
from PIL import Image, ImageDraw

BASE = r"E:\学习资料\dsh\鹈鹕测试工具\.impeccable\review"
before = Image.open(BASE + r"\round-before-sheet.png").convert("RGB")
after = Image.open(BASE + r"\round-after-sheet.png").convert("RGB")

# 标本页画面左上角区域：圆角就发生在这里
BOX = (140, 60, 440, 260)
Z = 3

crops = []
for im in (before, after):
    c = im.crop(BOX).resize(((BOX[2] - BOX[0]) * Z, (BOX[3] - BOX[1]) * Z), Image.NEAREST)
    crops.append(c)

w, h = crops[0].size
LABEL = 34
out = Image.new("RGB", (w, h * 2 + LABEL * 2 + 8), (12, 12, 11))
d = ImageDraw.Draw(out)
d.text((10, 9), "BEFORE  -  rx=32 rounds the sky", fill=(230, 227, 218))
out.paste(crops[0], (0, LABEL))
d.text((10, LABEL + h + 14), "AFTER  -  square, flush with the frame", fill=(240, 160, 32))
out.paste(crops[1], (0, LABEL * 2 + h + 8))

dest = BASE + r"\cmp-rounded-corner.png"
out.save(dest)
print("wrote", dest, out.size)
