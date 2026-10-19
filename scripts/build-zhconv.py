#!/usr/bin/env python3
"""生成 extension/zhconv.js：繁体 → 简体（连台湾、香港用词换成大陆用词）的本地转换，YouTube 字幕用（0.29.0）。
数据来自 OpenCC（https://github.com/BYVoid/OpenCC，Apache-2.0）钉在 ver.1.4.2：照它的 tw2sp、hk2sp、t2s 三个配置的转换链
（每一步一组词典，同一个位置按组里的顺序找第一个对得上的、取最长的那个词，short_circuit），去掉没给出的 TSCharactersExt（只管极少见的字）。
*Rev 词典 OpenCC 构建时由正向的反过来生成，这里一样（TWVariantsRev = TWVariants 反过来）。
下载的原文件放在 feed-filter/.cache/opencc-<版本>/（不进 git）；OpenCC 的许可证原文写进 ui/third_party/OpenCC-LICENSE.txt，
ui/notices.mjs 把它放进插件的 THIRD_PARTY_NOTICES.txt。
用法：python3 scripts/build-zhconv.py [--ext 插件目录]（在 feed-filter 目录下；默认 extension/）"""
import json, pathlib, sys, urllib.request

TAG = "ver.1.4.2"
RAW = f"https://raw.githubusercontent.com/BYVoid/OpenCC/{TAG}"
HERE = pathlib.Path(__file__).resolve().parent.parent
EXT = pathlib.Path(sys.argv[sys.argv.index("--ext") + 1]).resolve() if "--ext" in sys.argv else HERE / "extension"
CACHE = HERE / ".cache" / f"opencc-{TAG}"
SCHEMES = {"tw2sp": "tw2sp.json", "hk2sp": "hk2sp.json", "t2s": "t2s.json"}


def fetch(rel):
    f = CACHE / rel
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(f"{RAW}/{rel}", timeout=60) as r:
            f.write_bytes(r.read())
    return f.read_text(encoding="utf-8")


def load_dict(name):
    """词典文件 → {词: 第一个候选}；*Rev 而且没给出的，由正向的反过来"""
    stem = name.replace(".ocd2", "")
    try:
        text = fetch(f"data/dictionary/{stem}.txt")
        rev = False
    except Exception:
        if not stem.endswith("Rev"):
            return None
        text = fetch(f"data/dictionary/{stem[:-3]}.txt")
        rev = True
    out = {}
    for line in text.splitlines():
        if not line.strip() or line.startswith("#") or "\t" not in line:
            continue
        k, v = line.split("\t", 1)
        vals = v.split()
        if not vals:
            continue
        if rev:
            for x in vals:  # 反过来：每个候选 → 原词（同一个候选先到先得）
                out.setdefault(x, k)
        else:
            out.setdefault(k, vals[0])
    return {k: v for k, v in out.items() if k != v}


def main():
    dicts, schemes = {}, {}
    for name, cfg in SCHEMES.items():
        conf = json.loads(fetch(f"data/config/{cfg}"))
        steps = []
        for st in conf["conversion_chain"]:
            d = st["dict"]
            group = d["dicts"] if d.get("type") == "group" else [d]
            files = []
            for x in group:
                stem = x["file"].replace(".ocd2", "")
                if stem not in dicts:
                    got = load_dict(x["file"])
                    if got is None:  # TSCharactersExt 这类没给出的：跳过
                        print(f"  跳过 {stem}（{TAG} 没给出这个文件）")
                        continue
                    dicts[stem] = got
                files.append(stem)
            steps.append(files)
        schemes[name] = steps
    # 兼容汉字（CJK Compatibility Ideographs）先换成统一汉字：OpenCC 的 normalization
    dicts["CJK_Compatibility_Ideographs"] = load_dict("CJK_Compatibility_Ideographs.ocd2")
    lic = fetch("LICENSE")
    (HERE / "ui" / "third_party").mkdir(parents=True, exist_ok=True)
    (HERE / "ui" / "third_party" / "OpenCC-LICENSE.txt").write_text(lic, encoding="utf-8")
    data = json.dumps({"dicts": dicts, "schemes": schemes, "norm": "CJK_Compatibility_Ideographs"}, ensure_ascii=False, separators=(",", ":"))
    js = f"""// 由 scripts/build-zhconv.py 生成（数据来自 OpenCC {TAG}，Apache-2.0，见 THIRD_PARTY_NOTICES.txt），别直接改。
// 繁体 → 简体，台湾、香港用词换成大陆用词：FFZhConv.convert(文字, "tw2sp" | "hk2sp" | "t2s")。
// 做法照 OpenCC 的转换链：先把兼容汉字换成统一汉字；每一步是一组词典，从左往右，每个位置按组里的顺序找第一个对得上的词典、取最长的词，
// 换成它的第一个候选；哪个都对不上就原样留一个字（按码点，不切开代理对）。
(() => {{
  if (globalThis.FFZhConv) return;
  const D = {data};
  const maps = {{}}, longest = {{}};
  const dict = (name) => {{
    if (!maps[name]) {{ maps[name] = new Map(Object.entries(D.dicts[name])); let n = 1; for (const k of maps[name].keys()) n = Math.max(n, [...k].length); longest[name] = n; }}
    return maps[name];
  }};
  function step(chars, names) {{
    const out = [];
    for (let i = 0; i < chars.length; ) {{
      let hit = null;
      for (const name of names) {{
        const m = dict(name);
        for (let n = Math.min(longest[name], chars.length - i); n >= 1; n--) {{
          const v = m.get(chars.slice(i, i + n).join(""));
          if (v !== undefined) {{ hit = [v, n]; break; }}
        }}
        if (hit) break;
      }}
      if (hit) {{ out.push(...hit[0]); i += hit[1]; }} else {{ out.push(chars[i]); i++; }}
    }}
    return out;
  }}
  function convert(text, scheme = "tw2sp") {{
    const steps = D.schemes[scheme];
    if (!steps || !text) return text;
    let chars = step([...String(text)], [D.norm]);
    for (const names of steps) chars = step(chars, names);
    return chars.join("");
  }}
  globalThis.FFZhConv = Object.freeze({{ convert, schemes: Object.keys(D.schemes) }});
}})();
"""
    (EXT / "zhconv.js").write_text(js, encoding="utf-8")
    print(f"{EXT / 'zhconv.js'}：{len(js.encode()) // 1024} KB；词典 {', '.join(f'{k} {len(v)}' for k, v in dicts.items())}；方案 {json.dumps(schemes, ensure_ascii=False)}")


main()
