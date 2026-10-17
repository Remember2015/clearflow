#!/usr/bin/env python3
"""Translates the store listing's detailed description (docs/store/descriptions/en.txt) into the extension's other interface
languages, one docs/store/descriptions/<lang>.txt each. Edge Add-ons requires a description (250+ characters) for every language
in the package's _locales, so all of them need one; the Chrome Web Store shows English where one is missing.
zh-CN, zh-TW, ja and ko were written by hand and are skipped unless named with --only. Languages that already have a file are
skipped unless --force. Each result is checked (length, same number of bullets and paragraphs as English, names and the URL kept)
and retried with the problems listed. Goes through OpenRouter with the key in OPENROUTER_API_KEY or ~/.config/openrouter/key
(never printed).
Usage: python3 scripts/store-desc.py [--only es,fr] [--force] [--model openai/gpt-6-luna]"""
import argparse, json, os, pathlib, re, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIR = ROOT / "public/docs/store/descriptions" if (ROOT / "public").is_dir() else ROOT / "docs/store/descriptions"
API = "https://openrouter.ai/api/v1/chat/completions"
NAMES = {  # same languages as i18n/translate.py; es and pt also fill the dashboard's es-419 and pt-PT rows
    "es": "Spanish", "pt": "Portuguese (as used in Brazil)", "fr": "French", "de": "German", "it": "Italian", "ru": "Russian",
    "ar": "Arabic", "tr": "Turkish", "id": "Indonesian", "hi": "Hindi", "th": "Thai", "vi": "Vietnamese", "pl": "Polish", "nl": "Dutch",
}
HAND = ["zh-CN", "zh-TW", "ja", "ko"]
KEEP = ["ClearFlow", "X", "Reddit", "YouTube", "Xiaohongshu", "RedNote", "Hacker News", "TypeSafe", "OpenRouter", "MIT", "Y Combinator",
        "https://github.com/remember2015/clearflow"]


def system(lang):
    return f"""You translate the Chrome Web Store / Edge Add-ons description of a browser extension from English into {lang}.
Write it the way a native app-store listing in {lang} reads: natural, plain, no marketing exaggeration, nothing added or left out.
Keep exactly: the "•" bullets (one per line, same count and order), the blank lines between paragraphs, the names {", ".join(KEEP[:-1])}
(the site X is called X; keep "Xiaohongshu (RedNote)" as written), "nice", "+1" and "following" as examples of reply text (translate
them only if a reader would not recognise them; put them in the quotation marks usual in {lang}), and the URL {KEEP[-1]} unchanged.
Reply with the translated description only."""


def problems(en, out):
    p = []
    if len(out) < 250: p.append(f"only {len(out)} characters; the store needs at least 250")
    if out.count("•") != en.count("•"): p.append(f"{out.count('•')} bullets, English has {en.count('•')}")
    if len(re.split(r"\n\s*\n", out.strip())) != len(re.split(r"\n\s*\n", en.strip())): p.append("paragraph count differs from English")
    for k in KEEP:
        if k in en and k not in out: p.append(f"missing {k!r}")
    if re.search(r"[一-鿿]", out): p.append("contains Chinese characters")
    return p


def call(key, model, lang, en, note=""):
    body = json.dumps({"model": model, "temperature": 0.2, "max_tokens": 6000, "reasoning": {"enabled": False},
                       "messages": [{"role": "system", "content": system(lang)}, {"role": "user", "content": en + note}]}).encode()
    for i in range(4):
        try:
            req = urllib.request.Request(API, body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                                     "HTTP-Referer": "https://github.com/remember2015/clearflow", "X-Title": "ClearFlow store listing"})
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            return d["choices"][0]["message"]["content"].strip() + "\n", d.get("usage", {}).get("cost", 0) or 0
        except (urllib.error.URLError, KeyError, TimeoutError) as e:
            if i == 3: raise
            time.sleep(2 + 3 * i)


def do_lang(key, model, code, en):
    note, cost = "", 0
    for attempt in range(3):
        out, c = call(key, model, NAMES[code], en, note)
        cost += c
        p = problems(en, out)
        if not p: break
        note = "\n\n(Your previous translation had these problems; fix them: " + "; ".join(p) + ")"
    (DIR / f"{code}.txt").write_text(out, encoding="utf-8")
    return code, len(out), p, cost


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only"); ap.add_argument("--force", action="store_true"); ap.add_argument("--model", default="openai/gpt-6-luna")
    a = ap.parse_args()
    key = os.environ.get("OPENROUTER_API_KEY") or (pathlib.Path.home() / ".config/openrouter/key").read_text().strip()
    en = (DIR / "en.txt").read_text(encoding="utf-8")
    todo = a.only.split(",") if a.only else [c for c in NAMES if a.force or not (DIR / f"{c}.txt").exists()]
    bad = [c for c in todo if c not in NAMES]
    if bad: raise SystemExit(f"not machine-translated here: {bad} (zh-CN, zh-TW, ja and ko are written by hand: {HAND})")
    total = 0
    with ThreadPoolExecutor(8) as ex:
        for code, n, p, cost in ex.map(lambda c: do_lang(key, a.model, c, en), todo):
            total += cost
            print(f"{code}: {n} characters" + (f"  STILL: {'; '.join(p)}" if p else ""))
    print(f"{len(todo)} languages, ${total:.4f}")


if __name__ == "__main__":
    main()
