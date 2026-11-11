"""Assemble the one GitHub Pages site from the four branches of this repository.

    main         ->  /             the live website (triadatechnologies.com)
    dev          ->  /dev/         testing copy of the website
    mobile-main  ->  /mobile/      approved phone work, not yet merged into the live site
    mobile-dev   ->  /mobile-dev/  phone work in testing

Usage:  python scripts/assemble_site.py <checkouts-dir> <output-dir>
The checkouts dir holds one folder per branch name ("main", "dev", ...); a missing branch folder is skipped.

Everything except the live site is hidden from search engines: every page gets a noindex tag, no sitemap is copied,
no CNAME, and the live robots.txt gets a Disallow line for each preview folder.
"""
import os
import re
import shutil
import sys

NOINDEX = '<meta name="robots" content="noindex, nofollow">'
PREVIEWS = {"dev": "dev", "mobile-main": "mobile", "mobile-dev": "mobile-dev"}
SKIP = {".git", ".github"}


def copy_tree(src, dst, skip_extra=()):
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns(*SKIP, *skip_extra))


def mark_noindex(folder):
    count = 0
    for name in os.listdir(folder):
        if not name.endswith(".html"):
            continue
        path = os.path.join(folder, name)
        with open(path, encoding="utf-8", newline="") as f:
            text = f.read()
        if NOINDEX not in text:
            text = re.sub(r"(<head[^>]*>)", r"\1\n" + NOINDEX, text, count=1)
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(text)
            count += 1
    return count


def main():
    checkouts, out = sys.argv[1], sys.argv[2]
    shutil.rmtree(out, ignore_errors=True)
    live = os.path.join(checkouts, "main")
    if not os.path.isdir(live):
        sys.exit("The main checkout is missing; nothing to publish.")
    copy_tree(live, out)
    open(os.path.join(out, ".nojekyll"), "w").close()

    hidden = []
    for branch, folder in PREVIEWS.items():
        src = os.path.join(checkouts, branch)
        if not os.path.isdir(src):
            print(f"skip {branch}: no checkout")
            continue
        dst = os.path.join(out, folder)
        copy_tree(src, dst, skip_extra=("CNAME", "sitemap.xml", "robots.txt"))
        with open(os.path.join(dst, "robots.txt"), "w", encoding="utf-8", newline="\n") as f:
            f.write("User-agent: *\nDisallow: /\n")
        n = mark_noindex(dst)
        hidden.append(folder)
        print(f"{branch} -> /{folder}/ ({n} pages marked noindex)")

    # the live robots.txt also keeps crawlers out of the preview folders
    robots = os.path.join(out, "robots.txt")
    text = open(robots, encoding="utf-8").read() if os.path.exists(robots) else "User-agent: *\nAllow: /\n"
    extra = "".join(f"Disallow: /{h}/\n" for h in hidden)
    if extra:
        text = text.replace("Allow: /\n", "Allow: /\n" + extra, 1) if "Allow: /\n" in text else text + extra
    with open(robots, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("assembled", out)


if __name__ == "__main__":
    main()
