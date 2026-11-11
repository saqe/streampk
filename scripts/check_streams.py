#!/usr/bin/env python3
"""Check every connection referenced by the playlist(s): HLS streams, iframe/YouTube
embeds and channel logos. Reports failing ones and exits non-zero if any fail.

Usage: scripts/check_streams.py [playlist ...] [--json out.json] [--summary out.md]
                                [--timeout 15] [--workers 16] [--strict]

Status meanings:
  ok          connection works
  restricted  401/403/429/451 - geo/IP blocking or rate limiting of the CI runner (fails only with --strict)
  fail        dead, missing, timed out, or not what it claims to be
"""
import argparse
import json
import re
import ssl
import time
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
RESTRICTED = {401, 403, 429, 451}


def parse_playlist(path):
    """Mirror of ChannelManager.parseM3U8 in js/channels.js (+ playlist-level problems)."""
    channels, problems = [], []
    with open(path, encoding="utf-8") as fh:
        lines = [l.strip() for l in fh if l.strip()]
    for i, line in enumerate(lines):
        if not line.startswith("#EXTINF:"):
            continue
        attr = lambda k: (re.search(k + r'="([^"]+)"', line) or [None, None])[1]
        ch = {"id": attr("tvg-id"), "name": attr("tvg-name"), "logo": attr("tvg-logo"),
              "stream": None, "embed": None, "playlist": path}
        if not ch["name"] and "," in line:
            ch["name"] = line.rsplit(",", 1)[1].strip()
        if i + 1 < len(lines) and not lines[i + 1].startswith("#"):
            ch["stream"] = lines[i + 1]
        for j in range(i + 1, min(i + 4, len(lines) - 1) + 1):
            if lines[j].startswith("#EXTINF:"):
                break
            if lines[j].startswith("# EMBED:"):
                ch["embed"] = lines[j][len("# EMBED:"):].strip()
                break
        if not (ch["id"] and ch["name"]):
            problems.append(f"{path}: malformed #EXTINF (needs tvg-id and name): {line[:100]}")
            continue
        channels.append(ch)
    return channels, problems


def fetch(url, timeout, method="GET", max_bytes=256 * 1024):
    """Return (status, content_type, body_bytes, error). Retries on transient errors and 429."""
    err = None
    for attempt in range(3):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
                body = r.read(max_bytes) if method == "GET" else b""
                return r.status, r.headers.get("Content-Type", ""), body, None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:  # rate limited: back off, then retry
                time.sleep(3 * (attempt + 1))
                err = "HTTP 429"
                continue
            if e.code < 500:
                return e.code, e.headers.get("Content-Type", ""), b"", None
            err = f"HTTP {e.code}"
        except Exception as e:  # DNS, TLS, timeout, reset...
            err = f"{type(e).__name__}: {getattr(e, 'reason', e)}"
    return None, "", b"", err


def result(status, detail):
    return {"status": status, "detail": detail}


def http_result(code, err):
    if err:
        return result("fail", err)
    if code in RESTRICTED:
        return result("restricted", f"HTTP {code}")
    return result("fail", f"HTTP {code}")


def check_hls(url, timeout):
    """Playlist must respond 200 with #EXTM3U; its first child (variant or segment) must respond."""
    code, _, body, err = fetch(url, timeout)
    if code != 200:
        return http_result(code, err)
    text = body.decode("utf-8", "replace")
    if not text.lstrip().startswith("#EXTM3U"):
        return result("fail", "200 but body is not an HLS playlist (no #EXTM3U)")
    child = next((l.strip() for l in text.splitlines() if l.strip() and not l.startswith("#")), None)
    if child is None:
        # Live playlists may legitimately be empty for a moment; the manifest itself is reachable.
        return result("ok", "manifest reachable (no entries listed)")
    child_url = urllib.parse.urljoin(url, child)
    ccode, _, cbody, cerr = fetch(child_url, timeout, max_bytes=4096)
    if ccode == 200:
        return result("ok", "manifest + first entry reachable")
    r = http_result(ccode, cerr)
    r["detail"] = "manifest ok but first entry failed: " + r["detail"]
    return r


def check_embed(url, timeout):
    live = re.search(r"youtube(?:-nocookie)?\.com/embed/live_stream\?.*?channel=([\w-]+)", url)
    if live:
        return check_youtube_channel_live(live.group(1), timeout)
    m = re.search(r"youtube(?:-nocookie)?\.com/embed/([\w-]+)", url)
    if m:  # oEmbed 404/401 => video removed or embedding disabled
        oembed = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
            f"https://www.youtube.com/watch?v={m.group(1)}", safe="")
        code, _, _, err = fetch(oembed, timeout)
        if code == 200:
            return result("ok", "YouTube video exists and is embeddable")
        if code in (401, 404):
            return result("fail", f"YouTube video unavailable or embedding disabled (HTTP {code})")
        return http_result(code, err)
    code, _, _, err = fetch(url, timeout)
    return result("ok", "reachable") if code == 200 else http_result(code, err)


def check_youtube_channel_live(channel_id, timeout):
    """embed/live_stream?channel=ID only plays while that channel is live; check it is."""
    code, _, body, err = fetch(f"https://www.youtube.com/channel/{channel_id}/live", timeout,
                               max_bytes=2 * 1024 * 1024)
    if code != 200:
        return http_result(code, err)
    if b'"isLive":true' in body:
        return result("ok", "YouTube channel is live")
    return result("fail", "YouTube channel is not live right now (or does not exist)")


def check_logo(url, timeout):
    code, ctype, _, err = fetch(url, timeout, max_bytes=1024)
    if code != 200:
        return http_result(code, err)
    if not ctype.lower().startswith("image/"):
        return result("fail", f"not an image (Content-Type: {ctype or 'none'})")
    return result("ok", "image reachable")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("playlists", nargs="*", default=["playlist.m3u8"])
    ap.add_argument("--json")
    ap.add_argument("--summary", help="write a Markdown report (e.g. $GITHUB_STEP_SUMMARY)")
    ap.add_argument("--timeout", type=float, default=15)
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--strict", action="store_true", help="treat 'restricted' as failures too")
    args = ap.parse_args()

    channels, problems, warnings, jobs = [], [], [], []
    for p in args.playlists:
        c, pr = parse_playlist(p)
        channels += c
        problems += pr
    for ch in channels:
        if not ch["stream"] and not ch["embed"]:
            warnings.append(f"{ch['name']} ({ch['id']}): no stream and no embed (shown disabled in the app)")
        if ch["stream"] and ch["stream"].startswith("http://"):
            warnings.append(f"{ch['name']}: plain-HTTP stream is blocked as mixed content on the HTTPS site: {ch['stream']}")
        if ch["stream"]:
            jobs.append((ch, "stream", ch["stream"], check_hls))
        if ch["embed"]:
            jobs.append((ch, "embed", ch["embed"], check_embed))
        if ch["logo"]:
            jobs.append((ch, "logo", ch["logo"], check_logo))

    # Same URL is often shared (logos); check each unique (kind, url) once.
    unique = {}
    for ch, kind, url, fn in jobs:
        unique.setdefault((kind, url), fn)
    with ThreadPoolExecutor(args.workers) as ex:
        futs = {k: ex.submit(fn, k[1], args.timeout) for k, fn in unique.items()}
    cache = {k: f.result() for k, f in futs.items()}

    rows = [{"channel": ch["name"], "id": ch["id"], "kind": kind, "url": url, **cache[(kind, url)]}
            for ch, kind, url, _ in jobs]
    bad = {"fail", "restricted"} if args.strict else {"fail"}
    failing = [r for r in rows if r["status"] in bad]
    restricted = [r for r in rows if r["status"] == "restricted" and not args.strict]

    counts = {s: sum(r["status"] == s for r in rows) for s in ("ok", "restricted", "fail")}
    print(f"Checked {len(rows)} connections for {len(channels)} channels: "
          f"{counts['ok']} ok, {counts['restricted']} restricted, {counts['fail']} failed")
    for r in rows:
        print(f"  [{r['status'].upper():10}] {r['kind']:6} {r['channel']}: {r['detail']}\n{'':15}{r['url']}"
              if r["status"] != "ok" else f"  [OK        ] {r['kind']:6} {r['channel']}")
    for p in problems:
        print("  [PLAYLIST  ]", p)
    for w in warnings:
        print("  [WARNING   ]", w)

    if args.json:
        with open(args.json, "w") as fh:
            json.dump({"counts": counts, "results": rows, "playlist_problems": problems, "warnings": warnings}, fh, indent=2)
    if args.summary:
        md = [f"## Stream check: {counts['ok']} ok, {counts['restricted']} restricted, {counts['fail']} failed\n"]
        if failing or restricted:
            md += ["| Status | Type | Channel | Detail | URL |", "|---|---|---|---|---|"]
            for r in failing + restricted:
                md.append(f"| {r['status']} | {r['kind']} | {r['channel']} | {r['detail']} | `{r['url']}` |")
        else:
            md.append("All connections are working.")
        if problems:
            md += ["", "### Playlist problems", *[f"- {p}" for p in problems]]
        if warnings:
            md += ["", "### Warnings (not failures)", *[f"- {w}" for w in warnings]]
        if restricted:
            md += ["", "_restricted = 401/403/429/451, likely geo/IP blocking or rate limiting of the CI runner; not counted as failures._"]
        with open(args.summary, "a") as fh:
            fh.write("\n".join(md) + "\n")

    return 1 if (failing or problems) else 0


if __name__ == "__main__":
    sys.exit(main())
