import sys
from PIL import Image

# Crop the right-hand control rail's model-picker band and upscale for legibility.
src, out, x0, y0, x1, y1, scale = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:8])
im = Image.open(src).convert("RGB")
print("source size:", im.size)
box = (x0, y0, min(x1, im.size[0]), min(y1, im.size[1]))
crop = im.crop(box)
crop = crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)
crop.save(out)
print("cropped", box, "->", crop.size, "saved", out)
