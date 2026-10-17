#!/usr/bin/env python3
"""生成 test/x_probe.js：X 页面探针（test/x_probe.src.js）+ 插件读 X 页面的那份读法（xdom.js）。
探针里的 xdom.js 放在一个局部的 globalThis 里，查的总是仓库里这一版的读法，不管页面上装没装插件、装的哪一版。
用法（在 extension/ 下）: python3 test/build_probe.py          重新生成
                         python3 test/build_probe.py --check  只检查 x_probe.js 是不是最新的（不是就退出码 1）
改了 xdom.js 或 x_probe.src.js 之后重新生成，x_probe.js 一起提交（它是给人直接复制粘贴的）。"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)
read = lambda p: open(p, encoding="utf-8").read()

src = read(os.path.join(HERE, "x_probe.src.js"))
xdom = read(os.path.join(EXT, "xdom.js"))
ANCHOR = "/*XDOM*/"
assert src.count(ANCHOR) == 1, "x_probe.src.js 里要有且只有一个 /*XDOM*/"
assert "globalThis.FFX = Object.freeze(" in xdom, "xdom.js 不再往 globalThis.FFX 上挂了：探针的拼法要跟着改"
head = "// 由 test/build_probe.py 用 test/x_probe.src.js 和 xdom.js 生成，别手改。\n"
out = head + src.replace(ANCHOR, "\n" + xdom + "\n")
dst = os.path.join(HERE, "x_probe.js")
if "--check" in sys.argv:
    fresh = os.path.exists(dst) and read(dst) == out
    print("x_probe.js 是最新的" if fresh else "x_probe.js 过期了：python3 test/build_probe.py")
    sys.exit(0 if fresh else 1)
open(dst, "w", encoding="utf-8").write(out)
print(len(out), "字符 → test/x_probe.js")
