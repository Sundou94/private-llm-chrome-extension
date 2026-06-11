"""Cat face icon generator for Private LLM Assistant Chrome Extension"""
import struct, zlib, os


def create_png(size, pixels):
    def write_chunk(name, data):
        payload = name + data
        return struct.pack('>I', len(data)) + payload + struct.pack('>I', zlib.crc32(payload) & 0xffffffff)
    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = write_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    raw  = b''
    for row in pixels:
        raw += b'\x00'
        for px in row:
            raw += bytes(px)
    idat = write_chunk(b'IDAT', zlib.compress(raw, 9))
    iend = write_chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


def draw_cat(size):
    s   = size
    img = [[(0, 0, 0, 0)] * s for _ in range(s)]

    C_FACE    = (255, 168, 55,  255)
    C_EAR_IN  = (255, 212, 135, 255)
    C_OUTLINE = (88,  44,  14,  255)
    C_WHITE   = (255, 255, 255, 255)
    C_IRIS    = (62,  132, 218, 255)
    C_PUPIL   = (18,  15,  52,  255)
    C_NOSE    = (244, 92,  128, 255)
    C_MOUTH   = (88,  44,  28,  255)
    C_BLUSH   = (255, 182, 162, 185)

    def set_px(x, y, color):
        if 0 <= x < s and 0 <= y < s:
            img[y][x] = color

    def fill_circle(cx, cy, r, color):
        for y in range(max(0, int(cy - r) - 1), min(s, int(cy + r) + 2)):
            for x in range(max(0, int(cx - r) - 1), min(s, int(cx + r) + 2)):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    img[y][x] = color

    def fill_tri(p0, p1, p2, color):
        pts = sorted([p0, p1, p2], key=lambda p: p[1])
        for y in range(max(0, int(pts[0][1])), min(s, int(pts[2][1]) + 2)):
            xs = []
            for i in range(3):
                ax, ay = pts[i]
                bx, by = pts[(i + 1) % 3]
                if abs(ay - by) < 0.001:
                    continue
                if min(ay, by) <= y + 0.5 <= max(ay, by):
                    xs.append(ax + (y + 0.5 - ay) * (bx - ax) / (by - ay))
            if len(xs) >= 2:
                for x in range(max(0, int(min(xs))), min(s, int(max(xs)) + 1)):
                    img[y][x] = color

    def draw_line(x0, y0, x1, y1, color, thick=1):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1) * 2
        for i in range(int(steps) + 1):
            t  = i / steps
            px = x0 + t * (x1 - x0)
            py = y0 + t * (y1 - y0)
            for dy in range(-thick, thick + 1):
                for dx in range(-thick, thick + 1):
                    if dx * dx + dy * dy <= thick * thick:
                        set_px(int(px + dx + 0.5), int(py + dy + 0.5), color)

    # ── Geometry ──────────────────────────────────────────────────────
    fcx = s * 0.50
    fcy = s * 0.60
    fr  = s * 0.34

    # ── Ears ──────────────────────────────────────────────────────────
    ew  = fr * 0.43
    eh  = fr * 0.58
    edx = fr * 0.52
    for sd in (-1, 1):
        ex = fcx + sd * edx
        ty = fcy - fr - eh
        fill_tri((ex - ew * 1.16, fcy - fr * 0.80),
                 (ex + ew * 1.16, fcy - fr * 0.80),
                 (ex, ty), C_OUTLINE)
        fill_tri((ex - ew * 0.52, fcy - fr * 0.68),
                 (ex + ew * 0.52, fcy - fr * 0.68),
                 (ex, ty + eh * 0.26), C_EAR_IN)

    # ── Face circle ───────────────────────────────────────────────────
    fill_circle(fcx, fcy, fr + max(1.5, s * 0.016), C_OUTLINE)
    fill_circle(fcx, fcy, fr, C_FACE)

    # ── 16 px: minimal ────────────────────────────────────────────────
    if s < 24:
        fill_circle(fcx - fr * 0.37, fcy - fr * 0.13, fr * 0.15, C_PUPIL)
        fill_circle(fcx + fr * 0.37, fcy - fr * 0.13, fr * 0.15, C_PUPIL)
        fill_circle(fcx, fcy + fr * 0.28, fr * 0.10, C_NOSE)
        return img

    # ── Eyes ──────────────────────────────────────────────────────────
    ey    = fcy - fr * 0.11
    er    = fr  * 0.21
    eye_x = fr  * 0.38
    for sd in (-1, 1):
        ex = fcx + sd * eye_x
        fill_circle(ex, ey, er,           C_WHITE)
        fill_circle(ex, ey, er * 0.70,    C_IRIS)
        fill_circle(ex, ey + er * 0.06, er * 0.37, C_PUPIL)
        fill_circle(ex - er * 0.26, ey - er * 0.28, er * 0.14, C_WHITE)  # shine

    # ── Nose ──────────────────────────────────────────────────────────
    ny = fcy + fr * 0.22
    fill_tri((fcx - fr * 0.11, ny),
             (fcx + fr * 0.11, ny),
             (fcx, ny + fr * 0.15), C_NOSE)

    if s < 36:
        return img

    # ── Mouth (W-shape) ───────────────────────────────────────────────
    my  = ny + fr * 0.17
    mw  = fr * 0.29
    tk  = max(1, s // 64)
    draw_line(int(fcx),         int(my),          int(fcx - mw * 0.5), int(my + fr * 0.13), C_MOUTH, tk)
    draw_line(int(fcx - mw*0.5),int(my + fr*0.13),int(fcx - mw),       int(my),             C_MOUTH, tk)
    draw_line(int(fcx),         int(my),          int(fcx + mw * 0.5), int(my + fr * 0.13), C_MOUTH, tk)
    draw_line(int(fcx + mw*0.5),int(my + fr*0.13),int(fcx + mw),       int(my),             C_MOUTH, tk)

    # ── Blush ─────────────────────────────────────────────────────────
    if s >= 48:
        for sd in (-1, 1):
            fill_circle(fcx + sd * fr * 0.64, fcy + fr * 0.22, fr * 0.14, C_BLUSH)

    # ── Whiskers (64 px+) ─────────────────────────────────────────────
    if s >= 64:
        wrx  = fr * 0.13
        wlen = fr * 0.62
        wy0  = ny + fr * 0.02
        tk2  = max(1, s // 96)
        for sd in (-1, 1):
            for i, ang in enumerate([-0.12, 0.0, 0.12]):
                wy = wy0 + (i - 1) * fr * 0.11
                draw_line(int(fcx + sd * wrx), int(wy),
                          int(fcx + sd * (wrx + wlen)), int(wy + ang * wlen),
                          C_OUTLINE, tk2)
    return img


os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    pixels = draw_cat(size)
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(create_png(size, pixels))
    print(f'Created icons/icon{size}.png  ({size}×{size})')
print('Done!')
