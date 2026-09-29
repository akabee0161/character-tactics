"""32x32 FE-style portrait. Light source: upper-left."""
from PIL import Image

PALETTE = {
    'o': (26, 18, 40),      # outline
    'e': (122, 143, 208),   # hair highlight
    'f': (72, 85, 143),     # hair base
    'g': (51, 60, 102),     # hair shadow
    'h': (35, 40, 66),      # hair dark
    'a': (255, 224, 192),   # skin highlight
    'b': (240, 196, 154),   # skin base
    'c': (201, 143, 106),   # skin shadow
    'd': (150, 96, 74),     # skin deep
    'w': (248, 240, 232),   # eye white
    'i': (90, 122, 192),    # iris
    'k': (26, 18, 40),      # pupil
    'm': (168, 95, 82),     # mouth
    'p': (122, 143, 208),   # cloth highlight
    'q': (74, 85, 136),     # cloth base
    'r': (46, 53, 87),      # cloth shadow
}

D = lambda n: '.' * n

GRID = [
    D(32),
    D(13) + 'oooooo' + D(13),
    D(11) + 'o' + 'feeeeeff' + 'o' + D(11),
    D(10) + 'o' + 'ffeeeeeffg' + 'o' + D(10),
    D(9)  + 'o' + 'ffeeeeeffggg' + 'o' + D(9),
    D(8)  + 'o' + 'ffeeeeefffgggh' + 'o' + D(8),
    D(8)  + 'o' + 'ffeeeefffggghh' + 'o' + D(8),
    D(8)  + 'o' + 'ffeeeeffgggghh' + 'o' + D(8),
    D(8)  + 'o' + 'ffeeeffffggghh' + 'o' + D(8),
    D(8)  + 'o' + 'ffgabbbbbbchhh' + 'o' + D(8),
    D(8)  + 'o' + 'fggabbffbbchhh' + 'o' + D(8),
    D(8)  + 'o' + 'fggaabffbbchhh' + 'o' + D(8),
    D(8)  + 'o' + 'fgghhhbbhhhchh' + 'o' + D(8),
    D(8)  + 'o' + 'fga' + 'ooo' + 'bb' + 'ooo' + 'chh' + 'o' + D(8),
    D(8)  + 'o' + 'fga' + 'wik' + 'bb' + 'wik' + 'chh' + 'o' + D(8),
    D(8)  + 'o' + 'fgabcbbbbcbchh' + 'o' + D(8),
    D(8)  + 'o' + 'fgaabb' + 'cc' + 'bbbchh' + 'o' + D(8),
    D(8)  + 'o' + 'fgaabb' + 'cd' + 'bbbchh' + 'o' + D(8),
    D(8)  + 'o' + 'fgaabbbbbbbchh' + 'o' + D(8),
    D(8)  + 'o' + 'fgaabb' + 'mmm' + 'bbchh' + 'o' + D(8),
    D(8)  + 'o' + 'fgaabbbbbbbchh' + 'o' + D(8),
    D(9)  + 'o' + 'gaabbbbbbchh' + 'o' + D(9),
    D(10) + 'o' + 'gabbbbbbch' + 'o' + D(10),
    D(11) + 'o' + 'gccbbccc' + 'o' + D(11),
    D(12) + 'o' + 'cddddc' + 'o' + D(12),
    D(12) + 'o' + 'ccdddc' + 'o' + D(12),
    D(10) + 'o' + 'qq' + 'ccddcc' + 'qq' + 'o' + D(10),
    D(6)  + 'o' + 'qqqq' + 'ccddcc' + 'qqqqqqqq' + 'o' + D(6),
    D(4)  + 'o' + 'qqpppqqqq' + 'rrrr' + 'qqqqqqqqq' + 'o' + D(4),
    D(2)  + 'o' + 'qqpppqqqqqq' + 'rrrr' + 'qqqqqqqqqqq' + 'o' + D(2),
    D(1)  + 'o' + 'qqpppqqqqqqqq' + 'rr' + 'qqqqqqqqqqqqq' + 'o' + D(1),
    'o' + 'q' * 30 + 'o',
]

# --- machine check before visual review ---
errs = []
for y, row in enumerate(GRID):
    if len(row) != 32:
        errs.append(f'row {y}: length {len(row)}')
    for ch in set(row) - {'.'}:
        if ch not in PALETTE:
            errs.append(f'row {y}: unknown char {ch!r}')
if len(GRID) != 32:
    errs.append(f'height {len(GRID)}')
if errs:
    raise SystemExit('FAILED:\n' + '\n'.join(errs))

img = Image.new('RGB', (32, 32))
px = img.load()
for y, row in enumerate(GRID):
    for x, ch in enumerate(row):
        if ch == '.':
            # background: vertical gradient, darker at top
            t = y / 31
            px[x, y] = (int(28 + 22 * t), int(24 + 26 * t), int(52 + 34 * t))
        else:
            px[x, y] = PALETTE[ch]

img.save('face32.png')
img.resize((256, 256), Image.NEAREST).save('face32_x8.png')
used = len({row[x] for row in GRID for x in range(32)} - {'.'})
print(f'ok: 32x32, {used} palette colors used')
