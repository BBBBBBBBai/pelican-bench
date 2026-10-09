"""量真实截图里各角色字形的渲染色，用来判断「后」相比「前」是否真的建立了层级。
浅色文字在深色底上：把每个取样框里的像素按亮度排序，最亮的一小撮就是字形核心，
最暗的一半是背景。-- 只读，不改任何源文件。"""
from PIL import Image
import os

REVIEW = os.path.join(
    r"E:\学习资料\dsh\鹈鹕测试工具", ".impeccable", "review"
)

SAMPLES = [
    # (x0, y0, x1, y1), 标签
    ((14, 8, 150, 32), "nameplate b"),
    ((120, 18, 250, 36), "nameplate span"),
    ((1200, 22, 1260, 40), "window read-lg"),
    ((6, 300, 90, 322), "ch-animal"),
    ((6, 322, 130, 340), "ch-prov"),
    ((6, 340, 130, 358), "ch-model"),
    ((6, 358, 130, 376), "ch-when"),
    ((60, 271, 220, 291), "ch-head no/dur"),
    ((900, 76, 1080, 100), "slot-name? (n/a after)"),
]


def glyph_bg(im, box):
    crop = im.crop(box)
    px = list(crop.getdata())
    if not px:
        return None, None
    px.sort(key=lambda p: p[0] + p[1] + p[2])
    half = max(1, len(px) // 2)
    bg = tuple(round(sum(c[i] for c in px[:half]) / half) for i in range(3))
    top = px[int(len(px) * 0.92):] or px[-1:]
    fg = tuple(round(sum(c[i] for c in top) / len(top)) for i in range(3))
    return fg, bg


def lum(c):
    r, g, b = [v / 255 for v in c]
    f = lambda u: u / 12.92 if u <= 0.03928 else ((u + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


for name in ["type-before-desktop.png", "type-after-desktop.png"]:
    path = os.path.join(REVIEW, name)
    im = Image.open(path).convert("RGB")
    print("==", name, im.size)
    for box, label in SAMPLES:
        if box[2] > im.size[0] or box[3] > im.size[1]:
            continue
        fg, bg = glyph_bg(im, box)
        print(f"   {label:24s} fg={fg} bg={bg} ratio={ratio(fg, bg):.2f}")
    print()
