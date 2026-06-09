#!/usr/bin/env python3
"""One-off: convert root-absolute clean-URL route links (href="/features")
to depth-correct relative .html links (href="../features.html") so the site
works on GitHub Pages / any host without vercel.json rewrites.

Leaves asset paths (/js, /styles, /assets, /api, /icon*, files with an
extension) untouched. Idempotent: only touches href="/..." route links.
"""
import os
import re
import posixpath

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Directories whose absolute paths are NOT routes — leave them alone.
ASSET_PREFIXES = ("/js", "/styles", "/assets", "/api", "/icon", "/favicon", "/manifest", "/service-worker", "/og-")

def target_for(h):
    """Map a clean route URL to its actual file path (root-relative, no leading slash)."""
    if h == "/":
        return "index.html"
    if h == "/blog":
        return "blog/index.html"
    if h.endswith("/"):
        return h.lstrip("/") + "index.html"
    return h.lstrip("/") + ".html"

def should_skip(h):
    if not h.startswith("/"):
        return True
    if h.startswith(ASSET_PREFIXES):
        return True
    # already points at a concrete file (has an extension in the last segment)
    last = h.rstrip("/").split("/")[-1]
    if "." in last:
        return True
    return False

# Route links: href="/features" (no file extension) -> relative .html
HREF_RE = re.compile(r'href="(/[a-zA-Z0-9/_-]*)"')
# Asset refs: src/href="/js/mkt.js" (absolute path to a real file) -> relative
ASSET_RE = re.compile(r'(src|href)="(/[a-zA-Z0-9._/-]+\.[a-z0-9]+)"')

def convert_file(path):
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    page_dir = posixpath.dirname(rel)  # e.g. "blog/posts" or "" for root
    changes = 0

    def repl(m):
        nonlocal changes
        h = m.group(1)
        if should_skip(h):
            return m.group(0)
        target = target_for(h)
        relative = posixpath.relpath(target, page_dir if page_dir else ".")
        changes += 1
        return f'href="{relative}"'

    def repl_asset(m):
        nonlocal changes
        attr, p = m.group(1), m.group(2)
        relative = posixpath.relpath(p.lstrip("/"), page_dir if page_dir else ".")
        changes += 1
        return f'{attr}="{relative}"'

    with open(path, "r", encoding="utf-8", newline="") as f:
        content = f.read()
    new = HREF_RE.sub(repl, content)
    new = ASSET_RE.sub(repl_asset, new)
    if new != content:
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(new)
    return changes

def main():
    total_files = 0
    total_links = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git", "scripts")]
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            p = os.path.join(dirpath, fn)
            c = convert_file(p)
            if c:
                total_files += 1
                total_links += c
                print(f"{os.path.relpath(p, ROOT)}: {c} links")
    print(f"\nDone. {total_links} links across {total_files} files.")

if __name__ == "__main__":
    main()
