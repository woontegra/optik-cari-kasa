"""build/icon.ico — login logosunun sol (gözlük) kısmından çok boyutlu Windows ikonu üretir."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "src" / "assets" / "woontegra-optik-logo.png"
ICON_PATH = ROOT / "build" / "icon.ico"
ICO_SIZES = (256, 128, 64, 48, 32, 24, 16)
FILL_RATIO = 0.92


def extract_square_source(logo_path: Path) -> Image.Image:
    logo = Image.open(logo_path).convert("RGBA")
    w, h = logo.size
    side = min(w, h)
    square = logo.crop((0, 0, side, side))
    bbox = square.getbbox()
    if not bbox:
        return square
    return square.crop(bbox)


def build_frames(source: Image.Image, fill_ratio: float = FILL_RATIO) -> list[Image.Image]:
    cw, ch = source.size
    max_dim = max(cw, ch)
    frames: list[Image.Image] = []
    for size in ICO_SIZES:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        target = max(1, int(size * fill_ratio))
        scale = target / max_dim
        nw = max(1, int(cw * scale))
        nh = max(1, int(ch * scale))
        resized = source.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
        frames.append(canvas)
    return frames


def save_ico(frames: list[Image.Image], out_path: Path) -> None:
    if not frames or frames[0].size != (256, 256):
        raise SystemExit("ICO için 256x256 ana kare gerekli.")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(out_path, format="ICO", append_images=frames[1:])


def main() -> None:
    if not LOGO_PATH.exists():
        raise SystemExit(f"Logo bulunamadı: {LOGO_PATH}")
    source = extract_square_source(LOGO_PATH)
    frames = build_frames(source)
    save_ico(frames, ICON_PATH)
    print(f"Oluşturuldu: {ICON_PATH} ({len(frames)} boyut)")


if __name__ == "__main__":
    main()
