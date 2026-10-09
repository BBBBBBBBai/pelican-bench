def lin(c):
    c = c/255.0
    return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
def L(h):
    h = h.lstrip('#')
    r,g,b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def cr(fg,bg):
    a,b = L(fg), L(bg)
    hi,lo = max(a,b), min(a,b)
    return (hi+0.05)/(lo+0.05)
pairs = [
 ("mp-name 未选中 (--silk-dim on --well)",      "#a8a49a", "#101010", 12, False),
 ("mp-name 选中 (--lamp on #0b0b0a)",           "#f0a020", "#0b0b0a", 12, False),
 ("mp-empty 空态 (--silk-mute on --engrave)",   "#8f8c82", "#2d2c28", 12, False),
 ("field label (--silk-mute on --panel)",       "#8f8c82", "#191917", 11, False),
 ("hint .note (--silk-mute on --panel)",        "#8f8c82", "#191917", 14, False),
 ("mp-cell hover (--silk on --panel)",          "#e6e3da", "#191917", 12, False),
 ("mp-input 正文 (--silk on --well)",           "#e6e3da", "#101010", 14, False),
]
for name, fg, bg, px, large in pairs:
    v = cr(fg,bg)
    need = 3.0 if (large or px >= 18) else 4.5
    print(f"{name:46s} {v:5.2f}:1  (需要 {need}:1)  -> {'PASS' if v>=need else 'FAIL'}")
