#!/usr/bin/env python3
"""界面文字的构建：feed-filter/i18n/<语言>.json（一个语言一个文件，en.json 是基准）→
  extension/i18n_all.js   全部键、全部语言（插件自己的页面和后台用）
  extension/i18n_page.js  只放 X 页面上要用的键（内容脚本用，每个 X 页面都会加载，所以尽量小）
  extension/_locales/<chrome 的语言代码>/messages.json  插件名、按钮提示、简介（Chrome 不认的语言代码跳过）
overrides.json 里人工改过的句子构建时盖上去。先检查：每个语言的键和 en.json 一样、{占位符} 一样、不是空的、简介不超过 132 字。有问题就报错不写文件。
用法：python3 i18n/build.py [--ext 插件目录的副本]   （在 feed-filter 目录下）"""
import json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
EXT = HERE.parent / "extension"
if "--ext" in sys.argv:  # 先生成到插件目录的副本里测（用户的浏览器直接加载 extension/，半成品别写进去）
    EXT = pathlib.Path(sys.argv[sys.argv.index("--ext") + 1]).resolve()
# 主流语言（2026-10 定，只做主流的、小语种不做）：X 用户最多的十个国家的语言（DataReportal 2025-01：美、日、印尼、印度、英、德、
# 土耳其、墨西哥、巴西、沙特）+ 网页内容里用得最多的十种（W3Techs）+ 简繁中文和韩、泰、越。都在 X 的"显示语言"里；
# X 别的显示语言（乌尔都语、泰米尔语之类）和别的浏览器语言退回英文。
LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko", "es", "pt", "fr", "de", "it", "ru", "ar", "tr", "id", "hi", "th", "vi", "pl", "nl"]
# Chrome 扩展认的 _locales 目录名（https://developer.chrome.com/docs/extensions/reference/api/i18n#locales）
CHROME = {"en": ["en"], "zh-CN": ["zh_CN"], "zh-TW": ["zh_TW"], "pt": ["pt_BR", "pt_PT"], "es": ["es", "es_419"]}
PAGE_PREFIXES = ("tx.", "reason.", "kind.", "cat.", "cs.", "bar.", "banner.", "err.", "c.notDone", "filler.", "group.", "mark.", "heavy.", "app.", "notice.")  # 内容脚本里 t() 用到的
PH = re.compile(r"\{(\w+)\}")


OVERRIDES = json.loads((HERE / "overrides.json").read_text(encoding="utf-8")) if (HERE / "overrides.json").exists() else {}


def load(code):
    d = json.loads((HERE / f"{code}.json").read_text(encoding="utf-8"))
    d.update(OVERRIDES.get(code, {}))  # 人工改过的句子盖在上面
    return d


def check(code, d, base):
    errs = []
    if set(d) != set(base):
        errs.append(f"键不一致：缺 {sorted(set(base) - set(d))[:5]} 多 {sorted(set(d) - set(base))[:5]}")
    for k, v in d.items():
        if k not in base:
            continue
        if not isinstance(v, str) or not v.strip():
            errs.append(f"{k} 是空的")
        elif sorted(PH.findall(v)) != sorted(PH.findall(base[k])):
            errs.append(f"{k} 占位符不一致：{PH.findall(v)} vs {PH.findall(base[k])}")
    if len(d.get("manifest.desc", "")) > 132:
        errs.append(f"manifest.desc 超过 132 字（{len(d['manifest.desc'])}）")
    return [f"{code}: {e}" for e in errs]


def main():
    base = load("en")
    have = [c for c in LOCALES if (HERE / f"{c}.json").exists()]
    data, errs = {}, []
    for c in have:
        d = load(c)
        errs += check(c, d, base)
        data[c] = d
    if errs:
        print("\n".join(errs[:40]))
        sys.exit(1)
    strip = lambda d, keep: {k: v for k, v in d.items() if not k.startswith("manifest.") and keep(k)}
    head = "// 生成的文件，别手改：改 feed-filter/i18n/<语言>.json，再跑 python3 i18n/build.py\n"
    every = {c: strip(d, lambda k: True) for c, d in data.items()}
    page = {c: strip(d, lambda k: k.startswith(PAGE_PREFIXES)) for c, d in data.items()}
    (EXT / "i18n_all.js").write_text(head + "globalThis.FFI18nStrings = " + json.dumps(every, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    (EXT / "i18n_page.js").write_text(head + "globalThis.FFI18nStrings = " + json.dumps(page, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    n_loc, made = 0, set()
    for c, d in data.items():
        for dirname in CHROME.get(c, [c.replace("-", "_")]):
            made.add(dirname)
            p = EXT / "_locales" / dirname
            p.mkdir(parents=True, exist_ok=True)
            msgs = {"extName": {"message": d["manifest.name"]}, "extTitle": {"message": d["manifest.title"]}, "extDesc": {"message": d["manifest.desc"]}}
            (p / "messages.json").write_text(json.dumps(msgs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            n_loc += 1
    for p in (EXT / "_locales").iterdir():  # _locales 整个是生成的：不再支持的语言目录删掉
        if p.is_dir() and p.name not in made:
            shutil.rmtree(p)
    stale = sorted(f.stem for f in HERE.glob("*.json") if f.stem not in LOCALES and f.name != "overrides.json")
    if stale:
        print("不在 LOCALES 里、没打进插件的：", ", ".join(stale))
    kb = lambda f: (EXT / f).stat().st_size // 1024
    print(f"{len(data)} 种语言（{', '.join(have)}）、{len(base)} 个键 → i18n_all.js {kb('i18n_all.js')} KB、i18n_page.js {kb('i18n_page.js')} KB、_locales {n_loc} 个目录")
    missing = [c for c in LOCALES if c not in data]
    if missing:
        print("还没有：", ", ".join(missing))


if __name__ == "__main__":
    main()
