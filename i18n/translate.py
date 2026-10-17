#!/usr/bin/env python3
"""把界面文字从 en.json（参考 zh-CN.json）翻成 X 支持的其他语言，写 <语言>.json。走 OpenRouter，不开思考。
每块 ~45 个键一次请求，回来的逐条检查（键、{占位符}、不该翻的名字、开头的"　·"、不该出现的汉字、简介 ≤132 字、
弹窗和设置页上的短标签够短），不过就带着问题重试。
已经有的语言默认跳过（--force 重翻）；--only ja,ko 只翻这几种；--keys 只重翻几个键；--note 给这次请求附一句说明
（比如 extension/test/i18n_headless.cjs 量出来某种语言的哪个标签放不下）。key 读环境变量 OPENROUTER_API_KEY，没有就读 ~/.config/openrouter/key，不打印。
用法：python3 i18n/translate.py [--only ja,es] [--keys a,b] [--note "…"] [--force] [--model openai/gpt-6-luna]
翻完跑 python3 i18n/build.py 生成插件里用的文件；模型改不好的句子写进 overrides.json。"""
import argparse, json, os, pathlib, re, time, unicodedata, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
API = "https://openrouter.ai/api/v1/chat/completions"
NAMES = {  # 和 build.py 的 LOCALES 一致（en、zh-CN 是原稿，不用翻）
    "zh-TW": "Traditional Chinese as used in Taiwan (繁體中文，台灣用語)",
    "ja": "Japanese",
    "ko": "Korean",
    "es": "Spanish",
    "pt": "Portuguese (as used in Brazil)",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ru": "Russian",
    "ar": "Arabic",
    "tr": "Turkish",
    "id": "Indonesian",
    "hi": "Hindi",
    "th": "Thai",
    "vi": "Vietnamese",
    "pl": "Polish",
    "nl": "Dutch",
}
KEEP = ["ClearFlow", "Reddit", "Hacker News", "YouTube", "Jev", "Grok", "OpenRouter", "TypeSafe", "api.typesafe.ai", "M1", "D1", "base64", "GPT-6 Luna", "DeepSeek V4.1 Flash",
        "Gemini 3.8 Flash", "Claude Sonnet 5.5", "openai/gpt-6-luna"]
PH = re.compile(r"\{(\w+)\}")
SAME = {"app.name": "manifest.title"}  # 键 → 照抄哪个键的译文
CJK = re.compile(r"[一-鿿]")
WIDE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")  # 中日韩：一个字差不多两个拉丁字母宽


def letters(v):
    """估宽度用的"字母数"：附加符号（元音符号、变音符）不算，中日韩一个字算两个"""
    return sum(2 if WIDE.match(ch) else 1 for ch in v if not ch.isspace() and not unicodedata.category(ch).startswith("M"))


# 弹窗、设置页上挤在一行里的短标签：三类的名字、"少折 / 默认 / 多折"三档、key 的状态
SHORT = ("pop.cat.", "pop.page.", "opt.level.", "opt.state.")
SHORT_MAX = 16  # 拉丁字母数（中日韩一个字算两个）；最后以 extension/test/i18n_headless.cjs 实测为准


def system(code):
    name = NAMES[code]
    zh = ("\nBase each value on the Simplified Chinese text (\"zh\"), converting it to Traditional characters and Taiwan usage; "
          "use the English (\"en\") only to check the meaning." if code == "zh-TW" else "")
    return f"""You localize the user interface of a browser extension for X (formerly Twitter) and Reddit into {name}. The extension folds spam replies and comments, improves X's automatic translations and translates foreign-language posts and comments on Reddit.
You get a JSON object whose keys are message IDs and whose values are {{"en": English text, "zh": the original Simplified Chinese text}}. Return a JSON object with exactly the same keys, where each value is the {name} text (a plain string).{zh}
Rules:
1. Translate the meaning, not word for word. Write clear, natural, concise interface text that a native speaker would expect in an app: plain words, no marketing tone.
2. Use the same vocabulary X uses in its own {name} interface for things like post, reply, repost, like, bookmark, timeline, home, settings, translate and show original. Text about Reddit (it says "Reddit") follows Reddit's own {name} interface words for post, comment, feed and search results.
3. Keep placeholders such as {{n}}, {{model}}, {{lang}} and {{msg}} exactly as written (same braces, same names); never translate the text inside braces.
4. Keep these exactly as written: X, Reddit, Jev, Grok, OpenRouter, TypeSafe, api.typesafe.ai, M1, D1, base64, MB, model names (GPT-6 Luna, DeepSeek V4.1 Flash, Gemini 3.8 Flash, Claude Sonnet 5.5) and model IDs such as openai/gpt-6-luna.
5. Keep leading whitespace and symbols at the start of a value (for example the full-width space and "·" in "　· …") exactly as they are.
6. "manifest.name" is the extension's name, "manifest.title" its toolbar tooltip and "manifest.desc" its store description; keep manifest.desc under 120 characters (shorten it rather than going over).
7. Keys starting with "pop.cat.", "pop.page.", "opt.level." or "opt.state." are short labels shown side by side in a small popup or on a segmented control: one to three short words, at most about 16 Latin letters (count a Chinese, Japanese or Korean character as two letters).
8. Placeholder values are inserted unchanged: {{lang}} is a language name in its dictionary form (for example "English" or its {name} equivalent) and {{n}}, {{hits}}, {{k}}, {{total}} are numbers. Word sentences so they stay grammatical without inflecting the inserted word and for any number, e.g. "Translated by the extension (original: {{lang}})" or "Posts opened: {{posts}}" instead of a form that needs a case ending or a plural."""


def problems(code, chunk, out, en):
    errs = []
    if not isinstance(out, dict) or set(out) != set(chunk):
        return [f"keys differ: missing {sorted(set(chunk) - set(out or {}))[:4]}, extra {sorted(set(out or {}) - set(chunk))[:4]}"]
    for k, v in out.items():
        e = en[k]
        if not isinstance(v, str) or not v.strip():
            errs.append(f"{k}: empty value"); continue
        if sorted(PH.findall(v)) != sorted(PH.findall(e)):
            errs.append(f"{k}: placeholders must be exactly {PH.findall(e)} (you wrote {PH.findall(v)})")
        for w in KEEP:
            if w in e and w not in v:
                errs.append(f"{k}: keep \"{w}\" unchanged")
        if e.startswith("　·") and not v.startswith("　·"):
            errs.append(f"{k}: keep the leading \"　·\"")
        if code not in ("zh-TW", "ja") and CJK.search(v):
            errs.append(f"{k}: contains Chinese characters; write it in the target language")
        if k.startswith(SHORT) and letters(v) > SHORT_MAX:
            errs.append(f"{k}: \"{v}\" is {letters(v)} letters; this short label must be at most about {SHORT_MAX}")
    return errs  # 简介的长度单独处理（见 shorten）：混在一大块里模型改不动


def call(key, model, code, payload, note=""):
    body = json.dumps({"model": model, "temperature": 0.2, "max_tokens": 8000, "reasoning": {"enabled": False},
                       "response_format": {"type": "json_object"}, "usage": {"include": True},
                       "messages": [{"role": "system", "content": system(code)},
                                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False) + note}]}, ensure_ascii=False).encode()
    for i in range(3):
        req = urllib.request.Request(API, data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                                              "X-Title": "feed-filter i18n"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.loads(r.read())
            text = d["choices"][0]["message"]["content"].strip()
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
            obj, _ = json.JSONDecoder().raw_decode(text[text.index("{"):])
            return obj, (d.get("usage") or {}).get("cost") or 0
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, KeyError, ValueError, TimeoutError) as e:
            if i == 2:
                raise
            time.sleep(2 * (i + 1))


def do_lang(key, model, code, en, zh, size=45, only=None, hint=""):
    keys = list(en)
    path = HERE / f"{code}.json"
    old = json.loads(path.read_text(encoding="utf-8")) if only and path.exists() else {}
    out, cost = {k: v for k, v in old.items() if k in en and k not in (only or [])}, 0.0
    keys = [k for k in keys if k not in out]
    for s in range(0, len(keys), size):
        chunk = keys[s:s + size]
        payload = {k: {"en": en[k], "zh": zh.get(k, "")} for k in chunk}
        note, last = hint, None
        for attempt in range(6):
            got, c = call(key, model, code, payload, note)
            cost += c
            errs = problems(code, chunk, got, en)
            if not errs:
                out.update(got); break
            last = errs
            note = hint + "\n\nYour previous answer had these problems; fix them:\n- " + "\n- ".join(errs[:12])
        else:
            raise RuntimeError(f"{code} 第 {s // size + 1} 块翻不好：{last[:5]}")
    keys = list(en)
    for _ in range(4):  # Chrome 要求简介不超过 132 字：单独让它缩
        if len(out["manifest.desc"]) <= 132:
            break
        payload = {"manifest.desc": {"en": en["manifest.desc"], "zh": zh.get("manifest.desc", ""), "too_long": out["manifest.desc"]}}
        got, c = call(key, model, code, payload, f"\n\nThe current translation (\"too_long\") has {len(out['manifest.desc'])} characters. "
                      "Return {\"manifest.desc\": ...} with a shorter version of at most 110 characters; drop details rather than going over.")
        cost += c
        if isinstance(got, dict) and isinstance(got.get("manifest.desc"), str) and got["manifest.desc"].strip():
            out["manifest.desc"] = got["manifest.desc"].strip()
    if len(out["manifest.desc"]) > 132:
        raise RuntimeError(f"{code} 简介缩不到 132 字以内（{len(out['manifest.desc'])}）")
    for k, src in SAME.items():  # 同一个开关在弹窗和设置页上叫同一个名字
        out[k] = out[src]
    (HERE / f"{code}.json").write_text(json.dumps({k: out[k] for k in keys}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return code, cost


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only"); ap.add_argument("--force", action="store_true"); ap.add_argument("--model", default="openai/gpt-6-luna")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--keys", help="只重翻这几个键（逗号分隔），并进已有的语言文件")
    ap.add_argument("--note", default="", help="附在请求后面的说明（比如实测的宽度问题），只对这一次有效")
    a = ap.parse_args()
    key = os.environ.get("OPENROUTER_API_KEY") or open(os.path.expanduser("~/.config/openrouter/key")).read().strip()
    en = json.loads((HERE / "en.json").read_text(encoding="utf-8"))
    zh = json.loads((HERE / "zh-CN.json").read_text(encoding="utf-8"))
    codes = a.only.split(",") if a.only else list(NAMES)
    only = a.keys.split(",") if a.keys else None
    todo = [c for c in codes if a.force or only or not (HERE / f"{c}.json").exists()]
    t0, total = time.time(), 0.0
    with ThreadPoolExecutor(a.workers) as ex:
        futs = {c: ex.submit(do_lang, key, a.model, c, en, zh, 45, only, "\n\n" + a.note if a.note else "") for c in todo}
        for c, f in futs.items():
            try:
                _, cost = f.result(); total += cost
                print(f"{c:<6} ok  ${cost:.4f}")
            except Exception as e:
                print(f"{c:<6} 失败：{str(e)[:200]}")
    print(f"{len(todo)} 种，用时 {time.time() - t0:.0f}s，花费 ${total:.4f}")


if __name__ == "__main__":
    main()
