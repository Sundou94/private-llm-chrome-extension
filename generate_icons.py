"""
간단한 PNG 아이콘 생성 스크립트 (외부 라이브러리 불필요)
색상: 인디고 #4f46e5 → RGB(79, 70, 229)
"""
import struct, zlib, os

def make_png(size, fg=(79, 70, 229), bg=(255, 255, 255)):
    def chunk(name, data):
        crc_data = name + data
        return struct.pack('>I', len(data)) + crc_data + struct.pack('>I', zlib.crc32(crc_data) & 0xffffffff)

    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))

    raw = b''
    r = size // 8          # corner radius approximation
    cx = cy = size // 2

    for y in range(size):
        raw += b'\x00'     # filter: None
        for x in range(size):
            # Rounded rectangle
            dx = max(abs(x - cx) - (cx - r - 1), 0)
            dy = max(abs(y - cy) - (cy - r - 1), 0)
            inside = (dx * dx + dy * dy) <= r * r
            color = fg if inside else bg
            raw += bytes(color)

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(make_png(size))
    print(f'Created icons/icon{size}.png ({size}x{size})')
