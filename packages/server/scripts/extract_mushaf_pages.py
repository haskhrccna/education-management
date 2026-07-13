#!/usr/bin/env python3
"""
Extract the Mushaf page images that the mobile Quran reader displays.

The reader shows the *real* scanned Mushaf pages (KFGQPC Madani Mushaf) rather
than transcribed text — a single wrong character in the Quran is unacceptable,
so we serve the verified printed page as an image and never re-key it.

Source: a scanned Mushaf PDF (e.g. standard2-quran.pdf, 624 pages). Its front
matter occupies PDF indices 0..2, so Mushaf page N lives at PDF index N + 2
(page 1 = Al-Fatiha = index 3, page 604 = An-Nas = index 606). Output is one
WebP per page, 1..604, written to packages/server/mushaf-pages/, which is
served statically by the API and is intentionally git-ignored (~83 MB).

Deps:  pip install pymupdf pillow
Usage: python3 packages/server/scripts/extract_mushaf_pages.py /path/to/mushaf.pdf
       python3 .../extract_mushaf_pages.py mushaf.pdf --out ./mushaf-pages --front-matter 2
"""
import argparse
import io
import os
import sys

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError:
    sys.exit("Missing deps. Run: pip install pymupdf pillow")

TOTAL_PAGES = 604  # pages in the Madani Mushaf


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract Mushaf page images from a scanned PDF.")
    ap.add_argument("pdf", help="path to the scanned Mushaf PDF")
    ap.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(__file__), "..", "mushaf-pages"),
        help="output directory (default: packages/server/mushaf-pages)",
    )
    ap.add_argument(
        "--front-matter",
        type=int,
        default=2,
        help="PDF pages before Mushaf page 1 (page N is at PDF index N + front-matter). Default 2.",
    )
    ap.add_argument("--total", type=int, default=TOTAL_PAGES, help="number of Mushaf pages (default 604)")
    ap.add_argument("--quality", type=int, default=82, help="WebP quality (default 82)")
    args = ap.parse_args()

    if not os.path.isfile(args.pdf):
        sys.exit(f"PDF not found: {args.pdf}")

    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    doc = fitz.open(args.pdf)
    last_index = args.total + args.front_matter  # e.g. 604 + 2 = 606
    if last_index >= doc.page_count:
        sys.exit(
            f"PDF has {doc.page_count} pages but Mushaf page {args.total} maps to index "
            f"{last_index}. Check --front-matter (currently {args.front_matter})."
        )

    for page in range(1, args.total + 1):
        pdf_index = page + args.front_matter
        # Render at 1x — the embedded scan is 750px wide, so upscaling adds no detail.
        pix = doc[pdf_index].get_pixmap()
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        img.save(os.path.join(out_dir, f"{page}.webp"), "WEBP", quality=args.quality)
        if page % 50 == 0 or page == args.total:
            sys.stdout.write(f"\r  extracted {page}/{args.total} pages")
            sys.stdout.flush()

    sys.stdout.write("\n")
    total_mb = sum(
        os.path.getsize(os.path.join(out_dir, f"{p}.webp")) for p in range(1, args.total + 1)
    ) // (1024 * 1024)
    print(f"✅ Wrote {args.total} pages to {out_dir} ({total_mb} MB).")


if __name__ == "__main__":
    main()
