"""Create compact mobile WebP variants from the existing data-derived posters."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/grids"


def build_stills():
    for asset in ("USA-layers", "EuropeA-layers", "USA"):
        for theme in ("light", "dark"):
            with Image.open(DEST / f"{asset}-{theme}.webp") as source:
                artwork = source.crop(source.getchannel("A").getbbox())
                for width in (640, 960):
                    height = width * 9 // 16
                    inset = width // 32
                    scaled = ImageOps.contain(artwork, (width - inset * 2, height - inset * 2), Image.Resampling.LANCZOS)
                    image = Image.new("RGBA", (width, height))
                    image.alpha_composite(scaled, ((width - scaled.width) // 2, (height - scaled.height) // 2))
                    path = DEST / f"{asset}-mobile-{theme}-{width}.webp"
                    image.save(path, quality=72, alpha_quality=20, method=6)
                    print(f"{path.name}: {path.stat().st_size} bytes")


if __name__ == "__main__":
    build_stills()
