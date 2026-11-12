#!/usr/bin/env python3
"""Build assets/data/events.json: upcoming Cobourg and Port Hope events, rewritten in FastRabbit's voice.

Standard library only. One request per source, with polite delays (per-source delay_seconds honoured) and an
honest user agent. Sources that block us (HTTP 403 or any other error) are skipped, never worked around.
robots.txt is not checked, at the owner's instruction (2026-11-12).
Only facts are kept (title, date, time, place); every blurb is written fresh from templates.
Source names and URLs are never written to the output.
"""
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "scripts", "events-sources.json")
OUT = os.path.join(ROOT, "assets", "data", "events.json")
TZ = ZoneInfo("America/Toronto")
TOWNS = ("Cobourg", "Port Hope")
CACHE = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else None  # local testing only

# Never let these into the site (wording rules), and drop non-public items.
BANNED = re.compile(r"\b(inspect\w*|assess\w*|drones?|dji|lito|cameras?|zoom|specs?|brighton|campbellford|fast rabbit)\b", re.I)
SKIP_TITLES = re.compile(r"\b(council|committee|board meeting|closed meeting|public meeting|office closed|closure|cancelled|canceled|heritage month|awareness month|board of directors|services board|police board|day of the dead|members only)\b", re.I)
PROMO = re.compile(r"\b(don'?t miss( out)?|must[- ]see|limited (seats|spots|tickets)|book now|tickets? on sale( now)?|get your tickets|hurry|sold out|annual|opening weekend|free kids?|free)\b[!:,\- ]*", re.I)

log = []


def note(msg):
    log.append(msg)
    print(msg, file=sys.stderr)


# ---------------- polite fetching ----------------
class Fetcher:
    def __init__(self, ua, delay):
        self.ua, self.delay, self.last = ua, delay, 0.0

    def _get(self, url, extra_delay=0):
        wait = self.last + max(self.delay, extra_delay) - time.time()
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={"User-Agent": self.ua, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")
                return r.status, body
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception as e:  # network error
            return 0, str(e)
        finally:
            self.last = time.time()

    def fetch(self, url, delay=0):
        status, body = self._get(url, delay)
        if status != 200:
            return None, f"HTTP {status}" + (f" ({body[:120]})" if status == 0 else "")
        return body, "ok"


# ---------------- parsers (facts only) ----------------
def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).strip()


def parse_tribe(body, src):
    out = []
    for e in json.loads(body).get("events", []):
        v = e.get("venue") if isinstance(e.get("venue"), dict) else {}
        city = clean(v.get("city", ""))
        cats = [clean(c.get("name", "")) for c in e.get("categories", [])]
        town = next((t for t in TOWNS if t.lower() == city.lower()), None) or next((t for t in TOWNS if t in cats), None)
        if not town:
            continue
        start = dt.datetime.strptime(e["start_date"], "%Y-%m-%d %H:%M:%S")
        allday = str(e.get("all_day")).lower() == "true"
        out.append(dict(title=clean(e.get("title")), date=start.date(), time=None if allday else start.strftime("%H:%M"),
                        venue=clean(v.get("venue", "")), town=town, hints=" ".join(cats)))
    return out


def parse_esolutions(body, src):
    out = []
    for m in re.finditer(r'href="/[^/"]+/Detail/(\d{4})-(\d{2})-(\d{2})-(\d{4})-[^"]*"[^>]*aria-label="View ([^"]+?) on [A-Z][a-z]{2} \d', body):
        y, mo, d, hm, title = m.groups()
        t = None if hm == "0000" else f"{hm[:2]}:{hm[2:]}"
        out.append(dict(title=clean(title), date=dt.date(int(y), int(mo), int(d)), time=t, venue="", town=src["default_town"], hints=""))
    return out


MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], 1)}


def parse_title_list(body, src):
    out, today = [], dt.datetime.now(TZ).date()
    for m in re.finditer(r'<t[hd][^>]*class="list-title"[^>]*>\s*<a[^>]*>(.*?)</a>', body, re.S):
        title = clean(m.group(1))
        dm = re.search(r"[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s*$", title)
        if not dm or dm.group(2).lower() not in MONTHS:
            continue
        day, mon = int(dm.group(1)), MONTHS[dm.group(2).lower()]
        year = today.year + (1 if (mon, day) < (today.month, today.day) and today.month - mon > 2 else 0)
        try:
            date = dt.date(year, mon, day)
        except ValueError:
            continue
        out.append(dict(title=title[:dm.start()].strip(" -–"), date=date, time=None, venue="", town=src["default_town"], hints=""))
    return out


PARSERS = {"tribe_events_api": parse_tribe, "esolutions_month": parse_esolutions, "joomla_title_list": parse_title_list}


# ---------------- rewriting in FastRabbit's voice ----------------
TYPES = [  # (keywords, noun); matched as whole words, first hit wins
    (r"gala|fundraiser|benefit", "fundraising evening"),
    (r"open house|town hall|consultation|flag raising", "community gathering"),
    (r"talk|lecture|speakers?|speaker series|author|reading|lunch and learn|101", "talk"),
    (r"market|bazaar|fayre|fair|craft sale|makers|vendors?", "market"),
    (r"workshops?|class(es)?|make and take|build-off|lessons?|course|beanie|crafts?|knit\w*|stitch\w*|planter|ornament|wreath|urn|star|wraps?|inks?|linocut|abstraction|techniques|making", "hands-on workshop"),
    (r"festival|festivals", "festival"),
    (r"reception|opening reception|vernissage", "opening reception"),
    (r"concerts?|strings?|band|orchestra|choir|singers?|songs?|music|soundstage|jazz|blues|open mic|motown|abba|symphony", "live music event"),
    (r"theatre|theater|plays?|improv|musical|comedy|panto|shows?", "stage show"),
    (r"film|films|movie|cinema|screening", "film screening"),
    (r"trivia|game night|games|bingo|scrabble|chess", "games session"),
    (r"art|arts|artist|exhibit\w*|gallery|drawing|painting", "art event"),
    (r"walk|hike|trails?|run", "walk"),
    (r"tea|dinner|breakfast|lunch|luncheon|brunch|cookies?|food|mead|wine|beer|tasting|charcuterie", "food and drink gathering"),
    (r"christmas|holiday|santa|parade|festive|magic|season|lights", "holiday celebration"),
    (r"youth|teens?|kids?|family|children|baby|toddlers?|colour|color|all ages", "family-friendly get-together"),
]
DAYPART = lambda t: "" if not t else ("morning" if int(t[:2]) < 12 else "afternoon" if int(t[:2]) < 17 else "evening")
OPENERS = ["A {when} {kind} {where}.", "Join neighbours for a {when} {kind} {where}.", "Come along to a {when} {kind} {where}.", "Pencil in a {when} {kind} {where}."]


def tidy_title(t):
    t = html.unescape(t)
    t = re.sub(r"\s*[-–|:]\s*(hosted|presented) by .*$", "", t, flags=re.I)
    t = re.sub(r"\s*[-–]\s*\d{1,2}\s+[A-Za-z]+\s*$", "", t)  # trailing dates
    t = PROMO.sub("", t)
    t = re.sub(r"[!*]+", "", t)
    t = re.sub(r"\s*&\s*", " and ", t)
    t = re.sub(r"\s+\|\s+", ": ", t)
    t = re.sub(r"\s+", " ", t).strip(" -–:|,")
    letters = [c for c in t if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.7:
        t = t.title()
    else:  # shouty words to normal case, short acronyms kept
        t = re.sub(r"\b[A-Z][A-Z']+(?:\s+[A-Z][A-Z']+)+\b", lambda m: m.group(0).title(), t)
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    return t


def kind_for(e):
    hay = (e["title"] + " " + e["hints"]).lower()
    for rx, noun in TYPES:
        if re.search(r"\b(" + rx + r")\b", hay):
            return noun
    return "community event"


def rewrite(e):
    title = tidy_title(e["title"])
    kind = kind_for(e)
    day = e["date"].strftime("%A")
    part = DAYPART(e["time"])
    when = f"{day}-{part}" if part else day
    place = e["venue"] and tidy_title(e["venue"])
    where = f"at {place}, {e['town']}" if place else f"in {e['town']}"
    seed = int(hashlib.sha1((title + e["date"].isoformat()).encode()).hexdigest(), 16)
    blurb = OPENERS[seed % len(OPENERS)].format(when=when, kind=kind, where=where)
    blurb = blurb[0].upper() + blurb[1:]
    return {
        "title": title,
        "date": e["date"].isoformat(),
        "time": e["time"] or "",
        "place": f"{place}, {e['town']}" if place else e["town"],
        "town": e["town"],
        "type": kind,
        "blurb": blurb,
    }


def main():
    cfg = json.load(open(CONFIG, encoding="utf-8"))
    f = Fetcher(cfg["user_agent"], cfg.get("min_delay_seconds", 10))
    today = dt.datetime.now(TZ).date()
    end = today + dt.timedelta(days=cfg.get("window_days", 45))
    raw = []
    for src in cfg["sources"]:
        if not src.get("enabled") or src.get("kind") not in PARSERS:
            note(f"[skip] {src['id']}: disabled in config")
            continue
        url = src["url"].format(today=today.isoformat(), end=end.isoformat())
        cpath = os.path.join(CACHE, src["id"] + ".txt") if CACHE else None
        if cpath and os.path.exists(cpath):
            body, why = open(cpath, encoding="utf-8").read(), "cache"
        else:
            body, why = f.fetch(url, src.get("delay_seconds", 0))
            if cpath and body is not None:
                os.makedirs(CACHE, exist_ok=True)
                open(cpath, "w", encoding="utf-8").write(body)
        if body is None:
            note(f"[skip] {src['id']}: {why}")
            continue
        try:
            got = PARSERS[src["kind"]](body, src)
        except Exception as ex:
            note(f"[skip] {src['id']}: parse error {ex!r}")
            continue
        note(f"[ok] {src['id']}: {len(got)} raw events")
        raw += got
    first, events = {}, []
    for e in sorted(raw, key=lambda x: (x["date"], x["time"] or "99")):
        if not (today <= e["date"] <= end) or e["town"] not in TOWNS:
            continue
        if SKIP_TITLES.search(e["title"]):
            continue
        r = rewrite(e)
        if not r["title"] or BANNED.search(" ".join(r.values())):
            continue
        key = (re.sub(r"\W+", "", r["title"].lower()), r["town"])
        if key in first:  # recurring or repeated listing: keep the next date, note later ones
            also = first[key].setdefault("also", [])
            if r["date"] != first[key]["date"] and r["date"] not in also and len(also) < 3:
                also.append(r["date"])
            continue
        first[key] = r
        events.append(r)
    for r in events:
        if not r.get("also"):
            r.pop("also", None)
    events = events[: cfg.get("max_events", 60)]
    if not events and os.path.exists(OUT):
        note("[keep] no events gathered this run; leaving the previous file in place")
        return 0
    data = {"updated": dt.datetime.now(TZ).replace(microsecond=0).isoformat(), "events": events}
    old = None
    if os.path.exists(OUT):
        try:
            old = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            pass
    if old and old.get("events") == events:
        note(f"[same] {len(events)} events, unchanged")
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    note(f"[write] {len(events)} events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
