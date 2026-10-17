# shadcn/ui 组件（maia 风格）

这里的组件拷自 [shadcn/ui](https://ui.shadcn.com)（命令行 `shadcn` 4.21.5，风格 `base-maia`，底层 Base UI，打开了 RTL），
MIT License，Copyright (c) 2023 shadcn。shadcn 的做法就是把组件源码拷进项目、当自己的代码改，所以这里没有装 `shadcn` 包；
组件要的自定义变体和动画在 `../../styles/shadcn.css`（同样摘自 shadcn）。

本地改过的：
- `dropdown-menu.tsx`：图标原来用 Hugeicons，换成内联 SVG（不为两个图标装图标库）。
- `popover.tsx`：`PopoverContent` 多收一个 `collisionPadding`，传给定位器（问号说明离窗口边留 12px）。
- `switch.tsx`（0.20.1）：开着的颜色用 `bg-on`（浅色 Chrome 蓝 #0B57D0、深色 #3D7FF5），圆钮深浅色都是白的（用户：深色下浅蓝底配深蓝钮看着不舒服）。0.21 起尺寸全用像素、照苹果的比例：轨道 34×20、圆钮 16、四周各留 2px、圆钮带一点阴影（以前圆钮按 rem 算、轨道是像素，弹窗 15px 根字号下圆钮缩小、左右上下留白不一样，用户：样式出错了）。

要加组件：在草稿目录 `npx shadcn@4.21.5 init -t vite -b base -p maia --rtl`，`npx shadcn@4.21.5 add <组件>`，
把生成的文件拷过来；图标换成内联 SVG（或 `../../lib.jsx` 里那几个），`@/components/ui/...` 的引用照旧能用（`../../../tsconfig.json` 的 paths）。
