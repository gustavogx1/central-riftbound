#!/usr/bin/env python3
"""Build a text database of every Riftbound card from Riot's official card gallery.

The gallery (https://playriftbound.com/en-us/card-gallery/) is a Next.js page that
ships the full card list inside <script id="__NEXT_DATA__">. One request gets
everything, so this script reads that JSON instead of the rendered page or OCR.

Outputs (in --out, default: this folder):
    raw/            untouched gallery HTML + extracted JSON (the cache)
    cards.json      one object per card
    cards.csv       same data, one row per card
    cards.md        readable text, one block per card (for a Claude Project)
    icons.md        every icon code found in card text and how it was converted
    validation.md   totals, empty/suspicious fields, 10 random cards to check
    changelog.md    what changed since the previous run (appended)

Usage:
    python scrape_cards.py                # use cache if < 24 h old, else re-download
    python scrape_cards.py --refresh      # always re-download the gallery page
    python scrape_cards.py --offline      # only use what is in raw/
    python scrape_cards.py --images       # also download card images not yet saved

Standard library only. Python 3.8+.
"""

import argparse, csv, datetime as dt, hashlib, html, io, json, os, random, re, sys, time
import urllib.request

GALLERY = "https://playriftbound.com/{locale}/card-gallery/"
# The page embeds the first SSR batch of cards; when that is short of the total the page
# reports, the rest comes from the same public JSON list the page itself pages through.
CONTENT_API = "https://content.publishing.riotgames.com"
UA = "riftbound-text-db/1.0 (personal reference; polite, 1 request at a time)"
PAUSE = (1.0, 2.0)          # seconds between requests
CACHE_MAX_AGE = 24 * 3600   # re-download the gallery after this

# Icon codes -> words. Official text already uses [Keyword] for keywords, so every
# icon keeps its kind inside the brackets ([1 Energy], [Fury Power]) to stay distinct.
ICONS = {
    ":rb_might:": "[Might]",
    ":rb_exhaust:": "[Exhaust]",
    ":rb_rune_rainbow:": "[Any Power]",
    ":rb_rune_fury:": "[Fury Power]",
    ":rb_rune_calm:": "[Calm Power]",
    ":rb_rune_mind:": "[Mind Power]",
    ":rb_rune_body:": "[Body Power]",
    ":rb_rune_chaos:": "[Chaos Power]",
    ":rb_rune_order:": "[Order Power]",
}
ICON_RE = re.compile(r":rb_[a-z0-9_]+:")
# Token stats are written with the energy-number icon followed by the might icon
# (":rb_energy_1: :rb_might: Bird" = a 1-Might Bird token), so that pair reads "1 [Might]".
TOKEN_MIGHT_RE = re.compile(r":rb_energy_(\d+):\s*:rb_might:")

CSV_COLS = ["id", "code", "public_code", "name", "subtitle", "set", "set_name",
            "collector_number", "variant", "same_card_as", "rarity", "type", "type_note", "subtypes", "tags", "domains",
            "energy_cost", "power_cost", "might", "might_bonus", "rules_text", "effect_text",
            "flavor_text", "artist", "orientation", "image_url", "rules_text_raw"]

_last_request = [0.0]


# ---------------------------------------------------------------- download / cache

def polite_get(url):
    wait = random.uniform(*PAUSE) - (time.time() - _last_request[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.read()
    finally:
        _last_request[0] = time.time()


def load_gallery(raw_dir, locale, mode):
    path = os.path.join(raw_dir, "gallery_%s.html" % locale)
    fresh = os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_MAX_AGE
    if mode == "offline" or (mode == "auto" and fresh):
        if not os.path.exists(path):
            sys.exit("No cached gallery at %s; run without --offline first." % path)
        print("using cached", path)
    else:
        url = GALLERY.format(locale=locale)
        print("downloading", url)
        body = polite_get(url)
        with open(path, "wb") as f:
            f.write(body)
        # keep a dated copy so later runs can be compared with this one
        dated = os.path.join(raw_dir, "history", "gallery_%s_%s.html"
                             % (locale, dt.date.today().isoformat()))
        os.makedirs(os.path.dirname(dated), exist_ok=True)
        with open(dated, "wb") as f:
            f.write(body)
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def next_data(page):
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>',
                  page, re.S)
    if not m:
        sys.exit("__NEXT_DATA__ not found: the gallery markup changed. Check raw/ and update this script.")
    return json.loads(m.group(1))


def find_card_lists(node, path="", out=None):
    """Every list of dicts that look like cards (have publicCode), with its JSON path."""
    out = [] if out is None else out
    if isinstance(node, list):
        if node and isinstance(node[0], dict) and "publicCode" in node[0]:
            out.append((path, node))
            return out
        for i, v in enumerate(node):
            find_card_lists(v, "%s[%d]" % (path, i), out)
    elif isinstance(node, dict):
        for k, v in node.items():
            find_card_lists(v, "%s.%s" % (path, k) if path else k, out)
    return out


def api_pages(data, raw_dir, mode):
    """All cards from the public list the gallery pages through (cached in raw/api/)."""
    meta = dig(data, "props", "pageProps", "page", "blades") or []
    links = next((dig(b, "cards", "async") for b in meta if dig(b, "cards", "async")), None)
    if not links:
        return []
    first = links["linkdata"]["first"]
    total = links["metadata"]["totalItems"]
    limit = links["metadata"].get("limit") or 200
    api_dir = os.path.join(raw_dir, "api")
    os.makedirs(api_dir, exist_ok=True)
    cards = []
    for start in range(0, total, limit):
        path = os.path.join(api_dir, "cards_from_%04d.json" % start)
        fresh = os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_MAX_AGE
        if mode == "offline" or (mode == "auto" and fresh):
            if not os.path.exists(path):
                continue
        else:
            url = CONTENT_API + re.sub(r"from=\d+", "from=%d" % start, first)
            print("downloading", url)
            with open(path, "wb") as f:
                f.write(polite_get(url))
        with io.open(path, encoding="utf-8") as f:
            cards.extend(json.load(f).get("data") or [])
    return cards


def find_site_totals(node, out=None):
    """Numbers the page itself reports as a card total (e.g. totalCount)."""
    out = [] if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, int) and re.search(r"total|count", k, re.I):
                out.append((k, v))
            else:
                find_site_totals(v, out)
    elif isinstance(node, list):
        for v in node:
            find_site_totals(v, out)
    return out


# ---------------------------------------------------------------- field helpers

def labels(v):
    """Turn the gallery's many {value:{label}} / {values:[...]} shapes into a list of strings."""
    if v is None:
        return []
    if isinstance(v, (str, int, float)):
        return [str(v)]
    if isinstance(v, list):
        return [s for x in v for s in labels(x)]
    if isinstance(v, dict):
        # {label: "Rarity", value: {label: "Rare"}}: the outer label is the field name,
        # so the nested value wins over it
        for key in ("value", "values", "type", "items", "tags"):
            if key in v:
                return labels(v[key])
        for key in ("label", "name", "title"):
            if isinstance(v.get(key), (str, int, float)):
                return [str(v[key])]
    return []


def one(v):
    got = labels(v)
    return got[0] if got else ""


def dig(d, *path):
    for p in path:
        if not isinstance(d, dict):
            return None
        d = d.get(p)
    return d


def deep_find(d, pattern):
    """First non-empty value whose key matches pattern (searches nested dicts)."""
    rx = re.compile(pattern, re.I)
    stack = [d]
    while stack:
        cur = stack.pop(0)
        if isinstance(cur, dict):
            for k, v in cur.items():
                if rx.search(k) and v not in (None, "", [], {}):
                    return v
            stack.extend(v for v in cur.values() if isinstance(v, (dict, list)))
        elif isinstance(cur, list):
            stack.extend(cur)
    return None


def rich_text(v):
    """Body HTML from a rich-text field, whatever its nesting."""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, dict):
        for key in ("body", "richText", "html", "text", "value"):
            if key in v:
                got = rich_text(v[key])
                if got:
                    return got
    return ""


def convert_icons(text, seen):
    def token_might(m):
        key = ":rb_energy_N: :rb_might: (token stats)"
        seen[key] = seen.get(key, 0) + 1
        return "%s [Might]" % m.group(1)
    text = TOKEN_MIGHT_RE.sub(token_might, text)

    def sub(m):
        code = m.group(0)
        seen[code] = seen.get(code, 0) + 1
        if code in ICONS:
            return ICONS[code]
        e = re.fullmatch(r":rb_energy_(\d+):", code)
        if e:
            return "[%s Energy]" % e.group(1)
        # unknown icon: keep it visible so nothing disappears
        return "[ICON %s]" % code.strip(":")
    return ICON_RE.sub(sub, text)


def html_to_text(body, seen):
    if not body:
        return ""
    t = re.sub(r"<br\s*/?>", "\n", body)
    t = re.sub(r"</p>\s*<p[^>]*>", "\n", t)
    t = re.sub(r"<li[^>]*>", "\n- ", t)          # "Choose two —" option lists
    t = re.sub(r"</li>|</?ul[^>]*>", "\n", t)
    # icons sent as <img alt=":rb_x:"> instead of plain codes
    t = re.sub(r'<img[^>]*alt="(:rb_[a-z0-9_]+:)"[^>]*>', r"\1", t)
    t = re.sub(r"</?[a-zA-Z][^>]*>", "", t)
    t = html.unescape(t)
    t = convert_icons(t, seen).replace("[NO TEXT]", "")   # placeholder on blank runes
    return "\n".join(l.strip() for l in t.split("\n") if l.strip())


def variant_of(public_code):
    head, _, size = public_code.partition("/")
    suffix = head.split("-", 1)[1].replace("*", "") if "-" in head else ""
    kinds = []
    if re.match(r"^\d+[a-z]$", suffix) or re.match(r"^R\d+[a-z]$", suffix):
        kinds.append("alt art")
    num = re.match(r"^(\d+)", suffix)
    if num and size.isdigit() and int(num.group(1)) > int(size):
        kinds.append("overnumbered")
    if suffix.startswith("SP"):
        kinds.append("special")
    if "*" in public_code:
        kinds.append("signed")
    return ", ".join(kinds)


def alt_text_type(c):
    """Card type from the image alt text ("Riftbound Spell: Hush. ..."), a second source."""
    m = re.match(r"Riftbound ([A-Za-z ]+?):", dig(c, "cardImage", "accessibilityText") or "")
    return m.group(1) if m and m.group(1) != "None" else ""


def flatten(c, seen):
    code = c.get("publicCode") or ""
    rules_raw = rich_text(c.get("text"))
    flavor_raw = rich_text(deep_find(c, r"flavou?r"))
    effect_raw = rich_text(c.get("effect"))
    types = labels(c.get("cardType"))
    alt_type = alt_text_type(c)
    return {
        "id": c.get("id") or code,
        "code": code.split("/")[0].replace("*", ""),
        "name": c.get("name") or "",
        "subtitle": c.get("subtitle") or "",
        "set": str(dig(c, "set", "value", "id") or code.split("-")[0]),
        "set_name": one(c.get("set")),
        "collector_number": c.get("collectorNumber"),
        "public_code": code,
        "variant": variant_of(code),
        "rarity": one(c.get("rarity")),
        # Some Radiance cards carry the wrong cardType on the site (a spell tagged Unit);
        # the image alt text matches the card's stats, so it wins when both exist.
        "type": alt_type or " / ".join(types),
        "type_from_image_alt": alt_type,
        "type_note": "" if not alt_type or [alt_type] == types else
                     "type field empty on the site; taken from image alt text" if not types else
                     "site type field says %s; image alt text says %s (used)" % (" / ".join(types), alt_type),
        "subtypes": " / ".join(labels(dig(c, "cardType", "superType"))
                               or labels(deep_find(c, r"^(sub|super)types?$"))),
        "tags": " / ".join(labels(deep_find(c, r"^tags?$|champion"))),
        "domains": labels(c.get("domain")),
        "energy_cost": one(c.get("energy")),
        "power_cost": one(c.get("power")),
        "might": one(c.get("might")),
        "might_bonus": one(c.get("mightBonus")),
        "rules_text": html_to_text(rules_raw, seen),
        "effect_text": html_to_text(effect_raw, seen),
        "flavor_text": html_to_text(flavor_raw, {}),
        "artist": ", ".join(labels(c.get("illustrator"))),
        "orientation": c.get("orientation") or "",
        "image_url": dig(c, "cardImage", "url") or "",
        "rules_text_raw": rules_raw,
    }


# ---------------------------------------------------------------- outputs

def card_hash(c):
    keep = {k: v for k, v in c.items() if k != "image_url"}   # CDN query strings change
    return hashlib.sha1(json.dumps(keep, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def write_md(cards, path):
    with io.open(path, "w", encoding="utf-8") as f:
        f.write("# Riftbound card database\n\n%d cards. Source: %s\n\n"
                "Icons are written in brackets with their kind, e.g. [1 Energy], [Fury Power], "
                "[Might], [Exhaust]. Keywords keep the official brackets, e.g. [Accelerate].\n\n"
                % (len(cards), GALLERY.format(locale="en-us")))
        for c in cards:
            title = "%s, %s" % (c["name"], c["subtitle"]) if c["subtitle"] else c["name"]
            f.write("## %s (%s)\n" % (title, c["public_code"]))
            kind = " ".join(x for x in (c["subtypes"], c["type"]) if x) or "-"
            line = ["Set: %s #%s" % (c["set_name"], c["collector_number"]),
                    "Rarity: %s" % c["rarity"], "Type: %s" % kind]
            if c["variant"]:
                line.append("Variant: %s" % c["variant"])
            if c["same_card_as"]:
                line.append("Same card as: %s" % c["same_card_as"])
            f.write(" | ".join(line) + "\n")
            stats = ["Domain: %s" % (", ".join(c["domains"]) or "-")]
            for key, lab in (("energy_cost", "Energy"), ("power_cost", "Power"), ("might", "Might"),
                             ("might_bonus", "Might bonus")):
                if c[key]:
                    stats.append("%s: %s" % (lab, c[key]))
            if c["tags"]:
                stats.append("Tags: %s" % c["tags"])
            f.write(" | ".join(stats) + "\n")
            if c["rules_text"]:
                f.write("Text: %s\n" % c["rules_text"].replace("\n", " / "))
            if c["effect_text"]:
                f.write("Effect: %s\n" % c["effect_text"].replace("\n", " / "))
            if c["flavor_text"]:
                f.write("Flavor: %s\n" % c["flavor_text"].replace("\n", " / "))
            f.write("Artist: %s\n\n" % (c["artist"] or "-"))


def write_icons(seen, path):
    with io.open(path, "w", encoding="utf-8") as f:
        f.write("# Icons found in card text\n\n| Code on the site | Written as | Times |\n|---|---|---|\n")
        for code, n in sorted(seen.items(), key=lambda kv: (-kv[1], kv[0])):
            shown = "N [Might] (e.g. a 1 [Might] Bird token)" if "token stats" in code else convert_icons(code, {})
            f.write("| `%s` | %s | %d |\n" % (code, shown, n))
        f.write("\nText markers that are already plain text in Riot's data and are kept unchanged:\n\n"
                "| Marker | Meaning |\n|---|---|\n"
                "| `[>]` | arrow after a condition or keyword, e.g. `[Empowered][>] I have +2 [Might]` "
                "= while Empowered, I have +2 Might |\n"
                "| `[>>]` | starts a nested ability inside a condition, e.g. `[Level 6][>] [>>][Reaction][>] ...` |\n"
                "| `[Accelerate]`, `[Reaction]`, `[Level 6]`... | keywords, already in brackets in the official text |\n")
        unknown = [c for c in seen if c not in ICONS and not re.fullmatch(r":rb_energy_\d+:", c)
                   and "token stats" not in c]
        if unknown:
            f.write("\n**Unknown icons (kept as [ICON ...], add them to ICONS):** %s\n"
                    % ", ".join(unknown))


def suspicious(c):
    out = []
    for key in ("name", "set", "rarity", "artist", "image_url"):
        if not c[key]:
            out.append("no %s" % key)
    token = "Token" in c["subtypes"] or re.search(r"-T\d", c["public_code"])
    if not c["type"]:
        out.append("no type")
    elif c["type_note"]:
        out.append(c["type_note"])
    if not c["domains"]:
        out.append("no domain")
    if c["type"] == "Unit" and not c["might"]:
        out.append("unit without might")
    if c["type"] in ("Unit", "Spell", "Gear") and not c["energy_cost"] and not token:
        out.append("no energy cost")
    if not c["rules_text"] and c["type"] not in ("Rune", "Unit", "Battlefield"):
        out.append("no rules text")
    if re.search(r"<[a-z/]|:rb_|&[a-z]+;|\[ICON ", c["rules_text"] + c["effect_text"]):
        out.append("leftover markup/unknown icon in text")
    return out


def write_validation(cards, site_totals, lists, path, gallery_url):
    by_set = {}
    for c in cards:
        by_set[c["set_name"]] = by_set.get(c["set_name"], 0) + 1
    flagged = [(c, suspicious(c)) for c in cards]
    flagged = [(c, s) for c, s in flagged if s]
    sample = random.Random(len(cards)).sample(cards, min(10, len(cards)))
    with io.open(path, "w", encoding="utf-8") as f:
        f.write("# Validation (%s)\n\n" % dt.datetime.now().strftime("%Y-%m-%d %H:%M"))
        f.write("## Totals\n\n- Printings extracted: **%d** (%d marked as variants; "
                "%d distinct cards once identical reprints are merged)\n"
                % (len(cards), sum(1 for c in cards if c["variant"]),
                   sum(1 for c in cards if not c["same_card_as"])))
        f.write("- Card lists found in the page: %s\n"
                % "; ".join("%s (%d)" % (p, len(l)) for p, l in lists))
        f.write("- Totals reported by the page: %s\n"
                % (", ".join("%s=%d" % kv for kv in site_totals) or "none found in the data; compare with the count shown on the site"))
        f.write("\n| Set | Cards |\n|---|---|\n")
        for s, n in sorted(by_set.items()):
            f.write("| %s | %d |\n" % (s, n))
        f.write("\n## Empty or suspicious fields (%d cards)\n\n" % len(flagged))
        for c, s in flagged:
            f.write("- %s %s: %s\n" % (c["public_code"], c["name"], ", ".join(s)))
        f.write("\n## 10 random cards to check by eye\n\nNo per-card pages exist on the site; "
                "compare with the image (or search the name at %s).\n\n" % gallery_url)
        for c in sample:
            f.write("### %s (%s)\n- Extracted: %s | %s | %s | %s | E:%s P:%s M:%s\n- Text: %s\n- Image: %s\n\n"
                    % (c["name"], c["public_code"], c["set_name"], c["rarity"], c["type"],
                       ", ".join(c["domains"]), c["energy_cost"] or "-", c["power_cost"] or "-",
                       c["might"] or "-", c["rules_text"].replace("\n", " / ") or "-", c["image_url"]))


def update_changelog(old, new, path):
    old_by = {c["id"]: c for c in old}
    new_by = {c["id"]: c for c in new}
    added = [i for i in new_by if i not in old_by]
    removed = [i for i in old_by if i not in new_by]
    changed = [i for i in new_by if i in old_by and card_hash(new_by[i]) != card_hash(old_by[i])]
    with io.open(path, "a", encoding="utf-8") as f:
        f.write("\n## %s\n\n%d added, %d changed, %d removed\n"
                % (dt.datetime.now().strftime("%Y-%m-%d %H:%M"), len(added), len(changed), len(removed)))
        for lab, ids, src in (("Added", added, new_by), ("Changed", changed, new_by), ("Removed", removed, old_by)):
            for i in ids:
                f.write("- %s: %s %s\n" % (lab, src[i]["public_code"], src[i]["name"]))
    return added, changed, removed


def download_images(cards, img_dir):
    os.makedirs(img_dir, exist_ok=True)
    todo = [c for c in cards if c["image_url"]
            and not os.path.exists(os.path.join(img_dir, re.sub(r"[^\w.-]", "_", c["public_code"]) + ".png"))]
    print("images to download:", len(todo))
    for n, c in enumerate(todo, 1):
        dest = os.path.join(img_dir, re.sub(r"[^\w.-]", "_", c["public_code"]) + ".png")
        try:
            data = polite_get(c["image_url"])
        except Exception as e:  # keep going; the next run retries what is missing
            print("  failed", c["public_code"], e)
            continue
        with open(dest, "wb") as f:
            f.write(data)
        if n % 50 == 0:
            print("  %d/%d" % (n, len(todo)))


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--refresh", action="store_true", help="always re-download the gallery page")
    g.add_argument("--offline", action="store_true", help="only use the cached page in raw/")
    ap.add_argument("--images", action="store_true", help="also download card images not yet saved")
    ap.add_argument("--locale", default="en-us")
    ap.add_argument("--out", default=os.path.dirname(os.path.abspath(__file__)))
    a = ap.parse_args()

    out, raw_dir = a.out, os.path.join(a.out, "raw")
    os.makedirs(raw_dir, exist_ok=True)
    mode = "refresh" if a.refresh else "offline" if a.offline else "auto"

    data = next_data(load_gallery(raw_dir, a.locale, mode))
    with io.open(os.path.join(raw_dir, "next_data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    lists = find_card_lists(data.get("props", data))
    if not lists:
        sys.exit("No card list inside __NEXT_DATA__ (no objects with publicCode).")
    site_total = dig(data, "props", "pageProps", "page", "blades")
    site_total = next((dig(b, "cards", "async", "metadata", "totalItems") for b in site_total or []
                       if dig(b, "cards", "async", "metadata", "totalItems")), None)
    embedded = sum(len(l) for _, l in lists)
    if site_total and site_total > embedded:
        print("page embeds %d of %d cards; fetching the rest from the list API" % (embedded, site_total))
        lists.append(("content API", api_pages(data, raw_dir, mode)))
    raw_cards, seen_ids = [], set()
    for _, l in lists:                      # merge every list, drop duplicates
        for c in l:
            key = c.get("id") or c.get("publicCode")
            if key not in seen_ids:
                seen_ids.add(key)
                raw_cards.append(c)
    with io.open(os.path.join(raw_dir, "cards_raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw_cards, f, ensure_ascii=False, indent=1)
    all_keys = sorted({k for c in raw_cards for k in c})
    print("raw card fields:", ", ".join(all_keys))

    icons = {}
    cards = sorted((flatten(c, icons) for c in raw_cards),
                   key=lambda c: (c["set"], c["collector_number"] or 0, c["public_code"]))

    # printings with identical game text point at the first printing, so a reader can
    # count each playable card once
    first = {}
    for c in sorted(cards, key=lambda c: (bool(c["variant"]), c["set"], c["collector_number"] or 0)):
        key = (c["name"], c["subtitle"], c["type"], c["rules_text"], c["effect_text"],
               c["energy_cost"], c["power_cost"], c["might"])
        c["same_card_as"] = first.setdefault(key, c["public_code"])
        if c["same_card_as"] == c["public_code"]:
            c["same_card_as"] = ""

    json_path = os.path.join(out, "cards.json")
    old = []
    if os.path.exists(json_path):
        with io.open(json_path, encoding="utf-8") as f:
            old = json.load(f)

    with io.open(json_path, "w", encoding="utf-8") as f:
        json.dump(cards, f, indent=2, ensure_ascii=False)
    with io.open(os.path.join(out, "cards.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS, extrasaction="ignore")
        w.writeheader()
        for c in cards:
            w.writerow(dict(c, domains="|".join(c["domains"])))
    write_md(cards, os.path.join(out, "cards.md"))
    write_icons(icons, os.path.join(out, "icons.md"))
    write_validation(cards, find_site_totals(data.get("props", data)), lists,
                     os.path.join(out, "validation.md"), GALLERY.format(locale=a.locale))
    added, changed, removed = update_changelog(old, cards, os.path.join(out, "changelog.md"))

    print("cards: %d | added %d, changed %d, removed %d" % (len(cards), len(added), len(changed), len(removed)))
    if a.images:
        download_images(cards, os.path.join(out, "images"))


if __name__ == "__main__":
    main()
