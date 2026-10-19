#!/usr/bin/env python3
"""生成仿 X 结构的测试页 test/fakex/status/{123,456,789,135}/index.html（全是合成账号和合成文字，不含真实 X 数据）。
打开 /fakex/status/123/ 这样的地址：插件只认 /用户/status/数字 这种详情页地址，带 .html 后缀不认。
123：三个号发同一句口号（中间表情不同，测 D1）+ 一条只 @ 帖外账号的短夸赞（测 M1）+ 一条骂人的（测辱骂）
     + 一条"露骨"的（测色情；替身给它 0.95）+ 一条带截图的点名开撕（不算 M1，替身给辱骂 0.9）+ 一条正常回复。
456：口号只出现一次，但预置在"已记住的口号"里（测已知口号、点误判后忘掉）。
789：只剩两个号发口号（带引流暗示，2 个号也折）+ 两个人碰巧说同一句普通话（不折；标一条后另一条跟着折）。
135：引用卡片——只引用自己另一条帖子的回复（折）、引用别人的 / 引用自己但写了一段的 / 楼主引用自己的 / 正常回复（不按这条折）。
spa.html：单页跳转（详情页 → 首页 → 首页点开图片 → 首页 → 回详情页），测折叠只留在帖子那块时间线里，不会套到首页的帖子上。
translate.html：仿首页的自动翻译（显示原文 / 显示翻译），测首页翻译增强（translate.js）。
thread.html：仿帖子详情页，主帖被 X 翻译、楼主自己的回复没翻，测帖子页补翻和"楼主的回复不折叠"。
页面会自动加载 /inject_bundle.js（先跑 build_inject_bundle.py；spa.html 可以用 ?bundle=inject_bundle_old 换旧版）。
用 .claude/launch.json 的 ext-fakex 起服务。"""
import datetime, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fakex", "status")
os.makedirs(OUT, exist_ok=True)
NOW = datetime.datetime(2026, 10, 10, 2, 0, 0)
SLOGAN = "这句口号只用来测试同帖复读规则{e}不信你点进我主页看"


# 模拟 X 的"…"菜单：点 caret 后在 #layers 里挂一个 [data-testid=Dropdown]，结构仿 X；Esc 或点外面关掉
FAKE_MENU = '''<div id="layers"></div><script>
document.addEventListener("click", (e) => {
  const caret = e.target.closest('[data-testid="caret"]');
  const layers = document.getElementById("layers");
  if (!caret) { if (!e.target.closest('[role="menu"]')) layers.replaceChildren(); return; }
  const item = (t) => `<div role="menuitem" tabindex="0" class="x-mi"><div class="x-ic"><svg viewBox="0 0 24 24" width="18" height="18"><g><path d="M4 4h16v16H4z"></path></g></svg></div><div class="x-tx"><div dir="ltr"><span>${t}</span></div></div></div>`;
  layers.innerHTML = `<div role="menu" class="x-menu"><div><div data-testid="Dropdown">${item("不感兴趣这个帖子")}${item("屏蔽")}${item("举报帖子")}</div></div></div>`;
  // ?menu=split：模拟 X 分两次挂菜单——过一拍再往同一个菜单里挂第二组 Dropdown（只在容器里查重的旧逻辑会插两项）
  if (location.search.includes("menu=split")) setTimeout(() => {
    const g = document.createElement("div");
    g.innerHTML = `<div data-testid="Dropdown">${item("添加/移除列表")}</div>`;
    layers.querySelector('[role="menu"] > div').appendChild(g.firstElementChild);
  }, 0);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("layers").replaceChildren(); });
</script>
<style>#layers .x-menu{position:fixed;top:80px;right:40px;background:#fff;box-shadow:0 0 15px rgba(0,0,0,.2);border-radius:12px;min-width:260px;font:700 15px -apple-system,sans-serif} .x-mi{display:flex;gap:12px;padding:12px 16px;cursor:pointer} .x-mi:hover{background:#f7f9f9} [data-testid=caret]{float:right}</style>'''


def art(user, handle, sid, text, minutes_ago, photo=False, extra=None):
    """extra（首页帖子用）：verified、social（"某某 已转帖"）、group（操作栏 aria-label 里的数字）、card（链接卡片的域名）、liked；
    quote：(名字, @账号, 正文)，嵌一张引用卡片（照真 X：role=link 的块，里面有作者那一栏和正文）。text 为空时不出正文元素（X 也不出）"""
    x = extra or {}
    t = (NOW - datetime.timedelta(minutes=minutes_ago)).isoformat() + ".000Z"
    # photo：True 只放一块灰色占位（M1 认"带图"用）；给网址就放一张真的 <img>（看图片 0.18 要读图的网址）
    pic = (f'<div data-testid="tweetPhoto"><img alt="图像" src="{photo}" style="width:160px;height:90px;border-radius:8px"></div>' if isinstance(photo, str) else
           '<div data-testid="tweetPhoto"><div style="width:160px;height:90px;background:#d6dde3;border-radius:8px"></div></div>') if photo else ""
    social = f'<div data-testid="socialContext">{x["social"]}</div>' if x.get("social") else ""
    adl = '<div class="x-adl"><span>广告</span></div>' if x.get("adlabel") else ""  # 真 X 的广告：作者那一栏旁边一个"广告"
    badge = '<svg data-testid="icon-verified" width="12" height="12"></svg>' if x.get("verified") else ""
    card = f'<div data-testid="card.wrapper"><a href="https://t.co/fake"><span>{x["card"]}</span></a></div>' if x.get("card") else ""
    q = x.get("quote")
    quote = (f'<div role="link" tabindex="0" class="x-quote"><div data-testid="User-Name">{q[0]}\n{q[1]}</div>'
             f'<div data-testid="tweetText">{q[2]}</div></div>') if q else ""
    # xtr：X 自动翻译了这条（正文是译文、lang 是界面语言，上面一行"翻译自 英语 · 显示原文"）
    xtr = ('<div class="x-tr"><svg width="12" height="12"></svg><span>翻译自 英语</span><button type="button" aria-label="显示原文">显示原文</button></div>'
           if x.get("xtr") else "")
    lang_attr = ' lang="zh"' if x.get("xtr") else ""
    body = f'{xtr}<div data-testid="tweetText"{lang_attr}>{text}</div>' if text else ""
    group = (f'<div role="group" aria-label="{x["group"]}"><button data-testid="reply">·</button><button data-testid="retweet">·</button>'
             f'<button data-testid="{"unlike" if x.get("liked") else "like"}">·</button></div>') if x.get("group") else ""
    return f'''<div data-testid="cellInnerDiv"><div><article data-testid="tweet">{social}
  <div data-testid="User-Name">{user}\n{handle}{badge}</div>{adl}
  <a href="/{handle[1:]}/status/{sid}"><time datetime="{t}">{minutes_ago}分钟</time></a>
  {body}{pic}{card}{quote}{group}
  <button data-testid="caret" aria-label="更多" type="button">…</button></article></div></div>'''


def write_status(pid, html):
    os.makedirs(os.path.join(OUT, pid), exist_ok=True)
    open(os.path.join(OUT, pid, "index.html"), "w", encoding="utf-8").write(html)


def page(pid, op_text, replies, seed=None):
    cells = [art("测试楼主", "@test_op", pid, op_text, 120)] + [art(*r) for r in replies]
    seed_js = f"<script>window.__ffSeed = {seed};</script>" if seed else ""
    seed_js += FAKE_MENU
    # ?dark：仿 X 的深色主题（暗蓝底），看折叠条的深色配色
    seed_js += '<script>if (/dark/.test(location.search)) { document.body.style.background = "#15202b"; document.body.style.color = "#e7e9ea"; }</script>'
    # ?lang=xx：仿别的界面语言的 X（<html lang="xx">；阿拉伯语这类从右往左的语言 X 还会设 dir="rtl"），看插件插进页面的字跟不跟着变
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x {pid}</title>
<script>{{ const m = /[?&]lang=([\\w-]+)/.exec(location.search); if (m) {{ document.documentElement.lang = m[1]; if (/^(ar|fa|he|ur)\\b/.test(m[1])) document.documentElement.dir = "rtl"; }} }}</script>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419}} article{{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root}} [data-testid=User-Name]{{white-space:pre;font-weight:600}} .x-quote{{display:block;border:1px solid #cfd9de;border-radius:12px;padding:8px 12px;margin-top:6px}}</style>
</head><body><main>{''.join(cells)}</main>{seed_js}<script src="/inject_bundle.js"></script></body></html>'''


write_status("123", page("123", "测试帖：二手平台上什么都能买到", [
    ("正常用户", "@normal_user01", "901", "这明明是一条找猫的帖子，被你们说成什么了", 50),
    ("alpha bot", "@alphabot381xq", "902", SLOGAN.format(e="🌋🧠"), 21),
    ("beta bot", "@betabotaisd", "903", SLOGAN.format(e="🛏️🛀"), 30),
    ("gamma bot", "@gammabot4", "904", SLOGAN.format(e="🏺🍾"), 39),
    ("delta bot", "@deltabot8x0", "905", "@outsider_acct1 形象反差强烈", 15),
    ("暴躁老哥", "@angry_user01", "906", "大傻X，连个小学生都不如", 10),
    ("写手", "@writer_test01", "907", "测试用的露骨句子，只用来测色情折叠", 8),
    ("开撕的", "@callout_user01", "908", "绞杀评论区某某@outsider_acct3", 6, True),
]))
# 7001（看图片，0.18）：a 有字有图（pbs.twimg.com 的网址，测试里拦下来回一张假图）、b 只有图没写字、c 短英文 + 图（"lol"：只看字会被短文本豁免）、d 只有字
write_status("7001", page("7001", "测试帖：晒晒你们的猫", [
    ("图文用户", "@img_text01", "7101", "我家的猫也是这样", 30, "https://pbs.twimg.com/media/FAKE_A.jpg"),
    ("只发图的", "@img_only01", "7102", "", 25, "https://pbs.twimg.com/media/FAKE_B.jpg"),
    ("短句带图", "@img_lol01", "7103", "lol", 20, "https://pbs.twimg.com/media/FAKE_C.jpg"),
    ("只有字的", "@txt_only01", "7104", "好可爱的猫", 15),
]))
# 7002（0.19.1 的两条本地规则）：近乎一样的模板——长句只换推的号（3 个号）、短句每条换一个链接还改了一个字（3 个号，链接照真 X 的样子：
# 藏着的 "https://" + 显示的域名路径）；字里塞了零宽字符的一条；两条正常的。都是编的句子
ZWJ_STUFF = "".join(c + "\u200b\u2060\u200c" for c in "快来看我主页有惊喜")
def xlink(path):  # 真 X 的 innerText 是 "https://" 换行 "域名/路径"（协议那段单独一块、字号 0 看不见）
    return f'<a href="https://t.co/fake{len(path)}"><span style="display:block;font-size:0;line-height:0">https://</span>s.example/{path}</a>'
TPL = "大家快去看（{}）的主页，最新的视频都在那里，晚了就被删了，赶紧看"
write_status("7002", page("7002", "测试帖：晒晒今天拍的照片", [
    ("模板一号", "@tpl_bot_a1", "7201", TPL.format("小羊一号"), 40),
    ("模板二号", "@tpl_bot_b2", "7202", TPL.format("猫猫二号"), 39),
    ("模板三号", "@tpl_bot_c3", "7203", TPL.format("宝藏三号"), 38),
    ("正常用户", "@normal_7002a", "7204", "这张照片的光线真好看，用的什么相机", 37),
    ("短链一号", "@link_bot_a1", "7205", "这个是不是那个谁啊\n" + xlink("AAA111"), 36),
    ("短链二号", "@link_bot_b2", "7206", "这个是不是那个谁啊\n" + xlink("BBB222"), 35),
    ("短链三号", "@link_bot_c3", "7207", "这个是不是这个谁啊🤔\n" + xlink("CCC333"), 34),
    ("隐形字符", "@zw_bot_01", "7208", ZWJ_STUFF, 33),
    ("正常用户二", "@normal_7002b", "7209", "我也想去那里拍一次", 32),
]))
# 7003（0.21.1）：@ 了帖子外的号、不超过 20 个字的，引流 / 推广两问的门槛降 0.1。测试里替身给这几条引流 0.55（网址 ?jev=）：
# 带 @ 外人的收起；不带 @、@ 的是楼主、超过 20 个字的都不收起（四句话各不一样，免得 D1 当成刷同一句话）。都是编的句子
write_status("7003", page("7003", "测试帖：晒一张新拍的照片", [
    ("外推一号", "@nudge_bot_a1", "7301", "比我高的跑不过我比我快的没我高 @promo_target_x 2", 40),
    ("同话无艾特", "@nudge_plain_b", "7302", "今天的晚霞比昨天的还要红一点 2", 39),
    ("艾特楼主", "@nudge_op_c", "7303", "楼主这组照片拍得真有感觉 @test_op", 38),
    ("长句外推", "@nudge_long_d", "7304", "我觉得这组照片真的是越看越有味道，尤其是第三张的构图和光线，你们说是不是 @promo_target_y", 37),
]))
# 7004（0.27，用户 10-17 截图的样子）：标了"是这一部吧 + 短链"，一模一样的那条本地就清理（一字不差、连链接），换了链接、少个字的
# "是这部吧 + 短链"按近乎一样的模板清理；正常的一条留给 Jev 问。都是编的账号，链接照真 X 的样子（藏着的 "https://" + 域名路径）
def tlink(path):
    return f'<a href="https://t.co/fake{path}"><span style="display:block;font-size:0;line-height:0">https://</span>t.cn/{path}</a>'
write_status("7004", page("7004", "测试帖：有人知道这是哪部片子吗", [
    ("要标的", "@mark_src_a1", "7401", "是这一部吧" + tlink("FAKE7401"), 50),
    ("一模一样", "@mark_same_b2", "7402", "是这一部吧" + tlink("FAKE7401"), 49),
    ("换了链接", "@mark_near_c3", "7403", "是这部吧\n" + tlink("FAKE7403"), 48),
    ("正常用户", "@normal_7004", "7404", "这部电影我也看过，结局挺意外的", 47),
]))
# 7008（0.28.6，review）：回复正文里单独一行"广告"、昵称就叫"Ad"的不是广告，照样判；真广告（作者那一栏旁边一个"广告"）不判
write_status("7008", page("7008", "测试帖：大家觉得这个怎么样", [
    ("广告党", "@line_ad_a", "7801", "这条不是广告<br>广告<br>就是想说一句", 50),
    ("Ad", "@named_ad_b", "7802", "说得很对，我也这么觉得", 49),
    ("正常用户", "@normal_7008", "7803", "这个帖子讲得挺清楚的", 48),
    ("真广告", "@real_ad_c", "7804", "全场五折，点击购买", 47, False, {"adlabel": True}),
]))
# 7005（0.27，清理得多的页面）：7 条垃圾（替身按"领福利"给引流分）和正常回复一条隔一条，加一条"赞"：清理条 7 条超过 5，整条藏起来、最上面一行汇总
HEAVY_SPAM = ["私信我领福利一号，先到先得", "私信我领福利二号，名额不多", "私信我领福利三号，今天截止", "私信我领福利四号，快来",
              "私信我领福利五号，别错过", "私信我领福利六号，最后几个", "私信我领福利七号，手慢无"]
HEAVY_OK = ["这张照片的颜色调得真舒服", "第二张的构图我很喜欢", "请问是在哪个城市拍的", "天气好的时候真想去一趟", "这个角度很少见", "收藏了，下次照着拍"]
heavy_replies = []
for i, sp in enumerate(HEAVY_SPAM):
    heavy_replies.append((f"福利号{i}", f"@heavy_bot_{i}", f"75{i:02d}", sp, 60 - i * 2))
    if i < len(HEAVY_OK): heavy_replies.append((f"路人{i}", f"@heavy_ok_{i}", f"76{i:02d}", HEAVY_OK[i], 59 - i * 2))
heavy_replies.append(("点赞的", "@heavy_fill", "7700", "赞", 40))
write_status("7005", page("7005", "测试帖：晒几张旅行照片", heavy_replies))
# 7006（0.27）：前 8 条大多是垃圾（够"评论区大多是机器人"那条提示），又两条一对、隔着正常回复，合起来 6 串超过 5——整条藏起来时只留最上面那一行
pair_replies = []
for i in range(6):
    for j in range(2):
        pair_replies.append((f"刷号{i}{j}", f"@pair_bot_{i}{j}", f"78{i}{j}", f"私信我领福利，名额有限先到先得，第{i}{j}位", 60 - i * 3 - j))
    pair_replies.append((f"路人{i}", f"@pair_ok_{i}", f"79{i}0", HEAVY_OK[i], 59 - i * 3))
write_status("7006", page("7006", "测试帖：再晒几张旅行照片", pair_replies))
# 7007（0.27，抽奖帖）：70 条很短的"DONE"式回复（替身给「赞」「mark」这类的分，都整条藏起来）：一页先判 40 条，往下滚了再放
write_status("7007", page("7007", "测试帖：转发抽一部手机", [(f"抽奖{i}", f"@lucky_{i:02d}", f"80{i:02d}", f"DONE {i} 🍀", 70 - i) for i in range(70)]))
write_status("456", page("456", "测试帖：今天的大 A 有人赚钱吗", [
    ("正常用户", "@normal_user02", "911", "小赚一点，银行股扛住了", 40),
    ("lonely bot", "@lonelybot77x", "912", SLOGAN.format(e="💋"), 12),
], seed='{"ff_slogans": ["' + SLOGAN.format(e="") + '"]}'))
# 789：只剩两个号（第三个被删 / 被 X 收进垃圾区）——带引流暗示的口号 2 个号也折；不带的 2 个号不折，你标一条后另一条跟着折
write_status("789", page("789", "测试帖：只剩两个机器人", [
    ("alpha bot", "@alphabot381xq", "921", SLOGAN.format(e="🛏️🛀"), 60),
    ("beta bot", "@betabotaisd", "922", SLOGAN.format(e="🏺🍾"), 61),
    ("路人甲", "@passerby_a", "923", "今天的晚饭吃得真开心啊朋友们", 30),
    ("路人乙", "@passerby_b", "924", "今天的晚饭吃得真开心啊朋友们", 35),
]))
# 135：引用卡片。只引用了自己另一条帖子的回复（没写字 / 只写了"看我这条"）该折；引用别人的、引用自己但认真写了一段的、
# 楼主引用自己的、正常回复不该折（这条规则不管；替身 Jev 给 0.1，也不会被 Jev 折）
SELF = "假设十年前开始不交社保，而是每个月定投比特币，现在已经赚了好几倍"
write_status("135", page("135", "测试帖：社保到底该不该交", [
    ("自荐号", "@self_promo01", "941", "", 30, False, {"quote": ("自荐号", "@self_promo01", SELF)}),
    ("自荐号二", "@self_promo02", "942", "看我这条👇", 25, False, {"quote": ("自荐号二", "@self_promo02", SELF + "（二）")}),
    ("转发党", "@quoter01", "943", "", 20, False, {"quote": ("别人", "@someone_else", "社保的算法其实挺复杂的，和你交的年限、基数都有关系")}),
    ("认真回复", "@thoughtful01", "944", "我之前专门算过一笔账：按现在的缴费基数和预期寿命，社保其实比定投稳得多，细节都写在这条里了，供参考", 15, False,
     {"quote": ("认真回复", "@thoughtful01", "社保和定投的对比：一笔详细的账")}),
    ("测试楼主", "@test_op", "946", "", 12, False, {"quote": ("测试楼主", "@test_op", "上一条我讲了缴费基数怎么算")}),
    ("正常用户", "@normal_user05", "945", "我觉得还是要交，医保很重要", 10),
]))
# spa.html：仿 X 的单页结构（primaryColumn > section > 时间线），window.__go(路径, 视图) 模拟站内跳转。
# 首页里有本帖的"原帖 + 回复"卡片（931 和详情页里那条是同一个 id），还有一条带图的帖子 778，它后面是 779（只 @ 帖外账号）
# 和 780（骂人）——要是把 778 当成主帖、把后面的首页帖子当回复，这两条会被折。
def timeline(label, arts, tabs=None):
    tablist = ('<div role="tablist">' + "".join(f'<div role="tab" aria-selected="{"true" if i == 0 else "false"}">{t}</div>'
                                              for i, t in enumerate(tabs)) + "</div>") if tabs else ""
    return (f'{tablist}<section role="region"><div aria-label="时间线：{label}"><div style="position:relative">'
            + "".join(art(*a) for a in arts) + "</div></div></section>")
POST321 = ("Alice", "@alice_op", "321", "测试帖：周末去哪玩", 90)
R931 = ("delta bot", "@deltabot8x0", "931", "@outsider_acct1 形象反差强烈", 30)
views = {
    "status": timeline("对话", [POST321, R931, ("正常用户", "@normal_user03", "932", "去爬山吧，天气不错", 20)]),
    # 首页的几条带上观察模式（feed.js）要读的东西：认证标、"已转帖"、操作栏数字、链接卡片
    "home": timeline("你的主页时间线", [
        POST321[:5] + (False, {"group": "8 回复、2 次转帖、65 喜欢、2,075 次查看"}), R931,
        ("Bob", "@bob_photo", "778", "今天拍的晚霞（带图）", 15, True,
         {"verified": True, "group": "120 回复、45 次转帖、1,234 喜欢、3 书签、56,789 次查看"}),
        ("Carol", "@carol_x", "779", "@outsider_acct2 好看", 10, False,
         {"social": "Alice 已转帖", "group": "1,234 replies, 56 reposts, 7,890 likes, 12 bookmarks, 345,678 views"}),
        ("Dave", "@dave_x", "780", "大傻X，你懂个屁", 5, False, {"card": "example.com", "group": "3 回复、1.2万 喜欢、3.4K 次查看"}),
    ], tabs=["为你推荐", "正在关注"]),
}
import json as _json
spa = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x spa</title>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419}} article{{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root}} [data-testid=User-Name]{{white-space:pre;font-weight:600}} .photo-layer{{position:fixed;inset:0;background:rgba(0,0,0,.85)}}</style>
</head><body><main><div data-testid="primaryColumn" id="pc"></div></main>{FAKE_MENU}<script>
const VIEWS = {_json.dumps(views, ensure_ascii=False)};
const bundle = new URLSearchParams(location.search).get("bundle") || "inject_bundle";
window.__go = (path, view) => {{
  history.pushState({{}}, "", path);
  if (view) document.getElementById("pc").innerHTML = VIEWS[view];
  const layers = document.getElementById("layers");
  if (/\/(photo|video)\//.test(path)) layers.innerHTML = '<div class="photo-layer" data-testid="photo-layer"></div>';
  else layers.querySelectorAll(".photo-layer").forEach((e) => e.remove());
}};
history.replaceState({{}}, "", "/alice_op/status/321");
document.getElementById("pc").innerHTML = VIEWS.status;
const sc = document.createElement("script"); sc.src = "/" + bundle + ".js"; document.body.appendChild(sc);
</script></body></html>'''
open(os.path.join(HERE, "fakex", "spa.html"), "w", encoding="utf-8").write(spa)

# profile.html：仿用户主页 /prof_user（顶上 UserName、左边栏"个人资料"指向你自己 @me_account）。时间线上：
# 2001 主人的正常帖子；2002 主人的、带"傻"（替身 Jev 给辱骂 0.9）；2003 别人的转帖、带"露骨"（色情 0.95）；
# 2004 主人的"@某人 好"（帖子页上 M1 会折，主页上不用 M1）；2005 主人的"加我微信领资料"（测试用 ?jev 给垃圾分）；2006 广告。
# window.__tab("with_replies") 换到"回复"标签：2011 别人的帖子带"绞杀"（辱骂）、2012 主人回复它。?self=prof_user：这是你自己的主页。
PROFILE_POSTS = [("Prof User", "@prof_user", "2001", "今天发了新视频，聊聊最近玩的游戏", 50),
                 ("Prof User", "@prof_user", "2002", "那个傻子又来了", 40),
                 ("Other X", "@other_x", "2003", "露骨的合成测试文字", 35, False, {"social": "Prof User 已转帖"}),
                 ("Prof User", "@prof_user", "2004", "@someone_else 好", 30),
                 ("Prof User", "@prof_user", "2005", "加我微信领资料，名额有限", 20),
                 # 2007、2008：X 自动翻译了的（页面上是中文译文）。2007 有页面数据（仿 React 的数据里是英文原文），判的应该是原文；
                 # 2008 没有页面数据：0.8 秒问不到就照页面上的判
                 ("Prof User", "@prof_user", "2007", "银河系在马达加斯加上空，和 @photo_friend 合作拍的。", 8, False, {"xtr": True}),
                 ("Prof User", "@prof_user", "2008", "第二条翻译过的合成帖子，没有页面数据。", 6, False, {"xtr": True})]
PROFILE_ORIG = {"2007": "The Milky Way over Madagascar, shot together with @photo_friend."}
PROFILE_REPLIES = [("Other Y", "@other_y", "2011", "绞杀评论区的合成测试", 15), ("Prof User", "@prof_user", "2012", "我也这么觉得", 10)]
AD = ('<div data-testid="placementTracking"><div data-testid="cellInnerDiv"><div><article data-testid="tweet">'
      '<div data-testid="User-Name">Ad Corp\n@ad_corp</div><div data-testid="tweetText">买它买它</div><div>广告</div></article></div></div></div>')
def ptimeline(arts, extra=""):
    return ('<section role="region"><div aria-label="时间线：Prof User 的帖子"><div style="position:relative">'
            + "".join(art(*a) for a in arts) + extra + "</div></div></section>")
prof_views = {"posts": ptimeline(PROFILE_POSTS, AD), "with_replies": ptimeline(PROFILE_REPLIES)}
prof = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x profile</title>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419}} article{{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root}} [data-testid=User-Name]{{white-space:pre;font-weight:600}}</style>
</head><body><nav><a data-testid="AppTabBar_Profile_Link" id="me" href="/me_account">个人资料</a></nav><main><div data-testid="primaryColumn">
<div data-testid="UserName"><div>Prof User</div><div>@prof_user</div></div>
<div role="tablist"><a role="tab" aria-selected="true" href="/prof_user">帖子</a><a role="tab" aria-selected="false" href="/prof_user/with_replies">回复</a></div>
<div id="tl"></div></div></main>{FAKE_MENU}<script>
const V = {_json.dumps(prof_views, ensure_ascii=False)};
const q = new URLSearchParams(location.search);
if (q.get("self")) document.getElementById("me").setAttribute("href", "/" + q.get("self"));
document.getElementById("tl").innerHTML = V.posts;
// 仿 React 交给帖子组件的数据（pagedata.js 读它）：X 翻了的那条，原文在这里
const ORIG = {_json.dumps(PROFILE_ORIG, ensure_ascii=False)};
for (const a of document.querySelectorAll("article")) {{
  const id = (a.querySelector('a[href*="/status/"]')?.getAttribute("href").match(/status\/(\d+)/) || [])[1];
  if (ORIG[id]) a["__reactFiber$fake"] = {{ memoizedProps: {{}}, return: {{ memoizedProps: {{ tweet: {{ id_str: id, lang: "en", full_text: ORIG[id] }} }}, return: null }} }};
}}
window.__tab = (t) => {{ history.pushState({{}}, "", "/prof_user/" + t + location.search); document.getElementById("tl").innerHTML = V[t]; }};
history.replaceState({{}}, "", "/prof_user" + location.search); // 留着 ?jev=…（替身 Jev 读它）
const sc = document.createElement("script"); sc.src = "/inject_bundle.js"; document.body.appendChild(sc);
</script></body></html>'''
open(os.path.join(HERE, "fakex", "profile.html"), "w", encoding="utf-8").write(prof)

# search.html：仿搜索结果 /search?q=idol（你自己是 @me_account）。6001 正常；6002 带"傻"（辱骂）；6003"加我微信"（测试用 ?jev 给垃圾分）；
# 6004 带"露骨"（色情）；6005 是你自己发的、也带"傻"（不折、不发 Jev）；中间夹一格"相关用户"（没有帖子）和一条广告。
# window.__search("另一个词") 换个词搜：6011 带"绞杀"（辱骂），6001 又搜到了（同一条，Jev 结果复用缓存）
SEARCH_POSTS = [("Idol Fan", "@idol_fan", "6001", "新歌太好听了，循环一整天", 50),
                ("Hater X", "@hater_x", "6002", "这个傻子唱得真难听", 40),
                ("Spam X", "@spam_x", "6003", "加我微信领资料，名额有限", 30),
                ("Porn X", "@porn_x", "6004", "露骨的合成测试文字", 20),
                ("Me", "@me_account", "6005", "我也来说两句：傻得可爱", 10)]
PEOPLE = '<div data-testid="cellInnerDiv"><div><h2 role="heading">相关用户</h2><div data-testid="UserCell">Some Idol @some_idol</div></div></div>'
search_views = {"idol": ptimeline(SEARCH_POSTS[:2], PEOPLE) .replace("</div></div></section>", "".join(art(*a) for a in SEARCH_POSTS[2:]) + AD + "</div></div></section>"),
                "other": ptimeline([("Other Y", "@other_y", "6011", "绞杀评论区的合成测试", 15), SEARCH_POSTS[0]])}
srch = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x search</title>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419}} article{{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root}} [data-testid=User-Name]{{white-space:pre;font-weight:600}}</style>
</head><body><nav><a data-testid="AppTabBar_Profile_Link" href="/me_account">个人资料</a></nav><main><div data-testid="primaryColumn">
<div role="tablist"><a role="tab" aria-selected="true">热门</a><a role="tab" aria-selected="false">最新</a></div>
<div id="tl"></div></div></main>{FAKE_MENU}<script>
const V = {_json.dumps(search_views, ensure_ascii=False)};
const keep = new URLSearchParams(location.search).get("jev");
const qs = (q) => "?q=" + encodeURIComponent(q) + "&src=typed_query&f=top" + (keep ? "&jev=" + encodeURIComponent(keep) : "");
document.getElementById("tl").innerHTML = V.idol;
window.__search = (q) => {{ history.pushState({{}}, "", "/search" + qs(q)); document.getElementById("tl").innerHTML = V.other; }};
history.replaceState({{}}, "", "/search" + qs("idol")); // 留着 ?jev=…（替身 Jev 读它）
const sc = document.createElement("script"); sc.src = "/inject_bundle.js"; document.body.appendChild(sc);
</script></body></html>'''
open(os.path.join(HERE, "fakex", "search.html"), "w", encoding="utf-8").write(srch)

# translate.html：仿 X 首页的自动翻译（地址改成 /home）。正文元素 tweetText 里是"Grok 译文"（lang="zh"），上面一行
# "翻译自 英语 · 显示原文"；点"显示原文"在微任务里把同一个元素换成原文（lang="en"），按钮换成"显示翻译"+"关于自动翻译"——
# 和真 X（React 在点击后的微任务里更新）一样。1008 故意慢 60 ms（测轮询那条路）。
# 1001 Grok 翻错；1002 翻得好；1003 长帖只显示一截（有"显示更多"，点它或 window.__expand("1003") 原地展开），
# 文章元素上挂了仿 React 的数据（__reactFiber$fake → tweet.note_tweet / grok_translated_post，pagedata.js 读它）；
# 1012 也是长帖，但没有这份数据（只能展开了再处理）；1004 广告（没有帖子链接）；1005 中文原帖（没翻译）；
# 1006 带 @、表情图、截断链接、#话题、$代码，测原文读取和链接；1008 慢切换。全是合成文字。
LINK = ('<a href="https://t.co/fakelink1" target="_blank" rel="noopener noreferrer nofollow"><span style="font-size:0">https://</span>'
        'example.com/launch-n<span style="font-size:0">otes</span><span aria-hidden="true">…</span></a>')
MENTION = '<a href="/openai_test">@openai_test</a>'
EMOJI = '<img alt="🎉" draggable="false" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="width:1.2em;height:1.2em">'
TAGS = '<a href="/hashtag/AI?src=hashtag_click">#AI</a> <a href="/search?q=%24NVDA&amp;src=cashtag_click">$NVDA</a>'
TX = {
    "1001": {"orig": "Why is it so hard to hire good people? Because the good ones are not for hire!",
             "tr": "为什么雇佣好人这么难？因为好人不是雇佣兵！"},
    "1002": {"orig": "Shipping the new release today. Huge thanks to everyone who tested the beta.",
             "tr": "今天发布新版本。非常感谢所有参与 beta 测试的朋友。"},
    "1003": {"orig": "This is a long post about our roadmap. First, we will rebuild the editor from",
             "tr": "这是一篇关于我们路线图的长文。首先，我们会从头重写编",
             "full_orig": "This is a long post about our roadmap. First, we will rebuild the editor from scratch. Second, sync gets 10x faster.",
             "full_tr": "这是一篇关于我们路线图的长文。首先，我们会从头重写编辑器。其次，同步快十倍。", "more": True, "fiber": True},
    "1004": {"orig": "Try our product today.", "tr": "今天就试试我们的产品。", "ad": True},
    "1006": {"orig": f"Big update from {MENTION} {EMOJI}\nRead more: {LINK} {TAGS}",
             "tr": f"来自 {MENTION} 的大更新 {EMOJI}\n阅读更多：{LINK} {TAGS}"},
    "1008": {"orig": "Not gonna lie, this update is a game changer.", "tr": "不会撒谎，这个更新是一个游戏改变者。", "slow": True},
    "1012": {"orig": "Another long synthetic post. It keeps going for a while so that X only shows the",
             "tr": "又一篇合成的长帖。它会写很长，所以 X 只显示",
             "full_orig": "Another long synthetic post. It keeps going for a while so that X only shows the first part of it in the feed.",
             "full_tr": "又一篇合成的长帖。它会写很长，所以 X 在信息流里只显示前一部分。", "more": True},
}
def tx_art(sid, d):
    t = (NOW - datetime.timedelta(minutes=int(sid) - 990)).isoformat() + ".000Z"
    link = "" if d.get("ad") else f'<a href="/user{sid}/status/{sid}"><time datetime="{t}">{int(sid) - 990}分钟</time></a>'
    ad = '<div data-testid="placementTracking">推荐</div>' if d.get("ad") else ""
    more = '<button data-testid="tweet-text-show-more-link" type="button">显示更多</button>' if d.get("more") else ""
    return f'''<div data-testid="cellInnerDiv"><div><article data-testid="tweet" data-fid="{sid}">
  <div data-testid="User-Name">user {sid}\n@user{sid}</div>{link}{ad}
  <div class="x-tr"></div><div data-testid="tweetText" dir="auto"></div>{more}
  <div role="group" aria-label="1 回复、2 喜欢"></div></article></div></div>'''
zh = ('<div data-testid="cellInnerDiv"><div><article data-testid="tweet"><div data-testid="User-Name">中文用户\n@zh_user</div>'
      '<a href="/zh_user/status/1005"><time datetime="2026-10-10T01:00:00.000Z">1小时</time></a>'
      '<div data-testid="tweetText" lang="zh" dir="auto">今天的晚饭吃得真开心</div></article></div></div>')
cells = [tx_art(k, v) for k, v in TX.items() if k < "1005"] + [zh] + [tx_art(k, v) for k, v in TX.items() if k > "1005"]
tr_page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x translate</title>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419}} article{{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root}} [data-testid=User-Name]{{white-space:pre;font-weight:600}} [data-testid=tweetText]{{white-space:pre-wrap;font-size:15px;line-height:20px}} .x-tr{{color:#536471;font-size:13px}} .x-tr button{{border:0;background:none;color:#1d9bf0;padding:0 4px;cursor:pointer}}</style>
</head><body><main><div data-testid="primaryColumn"><section role="region"><div aria-label="时间线：你的主页时间线">{"".join(cells)}</div></section></div></main><script>
const TX = {_json.dumps(TX, ensure_ascii=False)};
// mode: "tr" 显示译文 / "orig" 显示原文。同一个 tweetText 元素换内容（React 复用元素），按钮行一起换
function fill(a, mode) {{
  const d = TX[a.dataset.fid], tt = a.querySelector('[data-testid="tweetText"]'), row = a.querySelector(".x-tr");
  const full = d.expanded && d.full_tr;
  tt.setAttribute("lang", mode === "tr" ? "zh" : "en");
  tt.innerHTML = mode === "tr" ? (full ? d.full_tr : d.tr) : (full ? d.full_orig : d.orig);
  row.innerHTML = '<svg data-testid="grok" width="12" height="12"></svg><span>翻译自 英语</span>' + (mode === "tr"
    ? '<button type="button" aria-label="显示原文">显示原文</button>'
    : '<button type="button" aria-label="显示翻译">显示翻译</button><button type="button" aria-label="关于自动翻译">关于自动翻译</button>');
  a.dataset.mode = mode;
}}
document.querySelectorAll("article[data-fid]").forEach((a) => fill(a, "tr"));
// ?far=N：第 2 条帖子后面插一段 N 像素高的空白（测视野外先处理的范围）；?start=bottom：一打开就滚到底（测视野上面的也先处理）
{{
  const qq = new URLSearchParams(location.search), far = Number(qq.get("far")) || 0;
  if (far) {{ const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]'); const sp = document.createElement("div"); sp.style.height = far + "px"; sp.className = "x-spacer"; cells[1]?.after(sp); }}
  if (qq.get("start") === "bottom") {{ const pad = document.createElement("div"); pad.style.height = "600px"; document.body.append(pad); window.scrollTo(0, document.body.scrollHeight); }}
}}
// 仿 React 交给帖子组件的数据：完整原文、完整译文、页面上那一截（和真 X 一样，那截就是 preview_translation）
document.querySelectorAll("article[data-fid]").forEach((a) => {{
  const d = TX[a.dataset.fid];
  if (!d.fiber) return;
  // 全文末尾一条作者贴的链接（页面上显示）+ 一条转发别人帖子视频的 t.co（页面上显示成视频、不显示字，X 的译文里也没有）
  const lnk = {{ url: "https://t.co/fakelnk03", display_url: "example.com/roadmap", expanded_url: "https://example.com/roadmap" }};
  const vid = {{ url: "https://t.co/fakevid03", display_url: "x.com/someone/stat…", expanded_url: "https://x.com/someone/status/1/video/1" }};
  const tweet = {{ id_str: a.dataset.fid, lang: "en", note_tweet: {{ text: d.full_orig + " " + lnk.url + " " + vid.url, entity_set: {{ urls: [lnk, vid] }} }},
    entities: {{ media: [{{ url: vid.url, display_url: "pic.x.com/fakevid03", expanded_url: vid.expanded_url, type: "video" }}] }},
    grok_translated_post: {{ translation: d.full_tr + " " + lnk.url, preview_translation: d.tr, source_language: "en", destination_language: "zh", entities: {{ urls: [lnk] }} }} }};
  a["__reactFiber$fake"] = {{ memoizedProps: {{}}, return: {{ memoizedProps: {{ tweet }}, return: null }} }};
}});
document.addEventListener("click", (e) => {{
  const m = e.target.closest('[data-testid="tweet-text-show-more-link"]');
  if (m) {{ window.__moreClicks = (window.__moreClicks || 0) + 1; const a = m.closest("article"); queueMicrotask(() => window.__expand(a.dataset.fid)); return; }}
  const b = e.target.closest('button[aria-label="显示原文"], button[aria-label="显示翻译"]');
  if (!b) return;
  const a = b.closest("article"), mode = b.getAttribute("aria-label") === "显示原文" ? "orig" : "tr";
  if (TX[a.dataset.fid].slow) setTimeout(() => fill(a, mode), 60); else queueMicrotask(() => fill(a, mode));
}});
window.__expand = (id) => {{
  const a = document.querySelector(`article[data-fid="${{id}}"]`);
  TX[id].expanded = true;
  a.querySelector('[data-testid="tweet-text-show-more-link"]').remove();
  fill(a, a.dataset.mode);
}};
// ?path=/某人：同样这些帖子当成用户主页上的（测翻译在用户主页上也改进）
history.replaceState({{}}, "", new URLSearchParams(location.search).get("path") || "/home");
const sc = document.createElement("script"); sc.src = "/inject_bundle.js"; document.body.appendChild(sc);
</script></body></html>'''
open(os.path.join(HERE, "fakex", "translate.html"), "w", encoding="utf-8").write(tr_page)

# thread.html：仿帖子详情页（地址改成 /thread_op/status/3001）。主帖 3001 被 X 自动翻译了；楼主 @thread_op 自己的回复
# 3002（英文）、3003（英文长帖，只显示一截，window.__expand("3003") 原地展开）、3007（英文，带"绞杀"——替身给辱骂 0.9，
# 楼主的不该折）没翻；3004 楼主中文、3005 别人英文、3006 楼主只有链接（lang=qme）、3008 别人带"绞杀"（对照：该折），
# "发现更多"下面的 3009 不算这条对话；3010 楼主的、X 能按需翻（只有"显示翻译"按钮，点了先"正在翻译..."1.5 秒再出译文），
# 3011 楼主的、X 自动翻了但已经切回原文（"显示翻译"+"关于自动翻译"）；3003 挂了仿 React 的数据（只有完整原文，X 没翻），
# 3012 楼主的另一条长帖、没有这份数据（插件得替你点开"显示更多"）。
# ?notr：主帖没被翻译；?focal=3002：打开的是楼主那条回复（主帖在上面）。全是合成文字。
# ?extra（0.28.9，x_thread_misc_headless）多出三条、主帖带页面数据（原文）：3013 楼主只嵌了一张引用卡片（被引用的是英文长帖、卡片里有"显示更多"）；
# 3014 楼主英文回复，X 过 1.2 秒才挂出"显示翻译"；3015 别人，昵称写成"@thread_op"（冒充楼主），只 @ 了一个外人（M1 该清理）。
TH = {
    "3001": {"who": "op", "lang": "en", "orig": "We shipped three things today: a new editor, faster sync, and cheaper plans.",
             "tr": "我们今天发布了三样东西：新编辑器、更快的同步和更便宜的套餐。", "xtr": True},
    "3002": {"who": "op", "lang": "en", "orig": "And one more thing: the old plan keeps working until next year."},
    "3003": {"who": "op", "lang": "en", "orig": "A longer note on pricing. We had to trim the context window of the small model to make",
             "full": "A longer note on pricing. We had to trim the context window of the small model to make this work, but it only affects 0.2% of traffic.", "more": True, "fiber": True},
    "3004": {"who": "op", "lang": "zh", "orig": "中文用户可以在设置里切换语言。"},
    "3005": {"who": "other", "lang": "en", "orig": "Congrats on the launch, looks great!"},
    "3006": {"who": "op", "lang": "qme", "orig": '<a href="https://t.co/fakelink2">https://example.com/docs</a>'},
    "3007": {"who": "op", "lang": "en", "orig": "Synthetic line for the fold test, 绞杀 is just a test word here."},
    "3008": {"who": "other2", "lang": "en", "orig": "Synthetic reply from someone else, 绞杀 test word."},
    "3010": {"who": "op", "lang": "en", "orig": "Pricing is effective immediately.", "tr": "新价格立即生效。", "demand": True},
    "3011": {"who": "op", "lang": "en", "orig": "I switched this one back to the original.", "tr": "这一条我切回了原文。", "xtr": True, "startOrig": True},
    "3012": {"who": "op", "lang": "en", "orig": "Last long one. There is no page data for this post, so the plugin has to open",
             "full": "Last long one. There is no page data for this post, so the plugin has to open it to read the rest.", "more": True},
    "3009": {"who": "op", "lang": "en", "orig": "Another post of mine you may like."},
}
WHO = {"op": ("Thread OP", "thread_op"), "other": ("Other User", "other_user"), "other2": ("Second Other", "other_user2")}
def th_art(sid):
    name, h = WHO[TH[sid]["who"]]
    t = (NOW - datetime.timedelta(minutes=4000 - int(sid))).isoformat() + ".000Z"
    more = '<button data-testid="tweet-text-show-more-link" type="button">显示更多</button>' if TH[sid].get("more") else ""
    return (f'<div data-testid="cellInnerDiv"><div><article data-testid="tweet" data-fid="{sid}" tabindex="0">'
            f'<div data-testid="User-Name"><a href="/{h}">{name}</a>\n<a href="/{h}">@{h}</a></div>'
            f'<a href="/{h}/status/{sid}"><time datetime="{t}">{4000 - int(sid)}分钟</time></a>'
            f'<div class="x-tr"></div><div data-testid="tweetText" dir="auto"></div>{more}'
            f'<div role="group" aria-label="1 回复"></div><button data-testid="caret" aria-label="更多" type="button">…</button></article></div></div>')
def th_extra(sid, name, h, inner):
    t = (NOW - datetime.timedelta(minutes=4000 - int(sid))).isoformat() + ".000Z"
    return (f'<div data-testid="cellInnerDiv" data-extra="1"><div><article data-testid="tweet" data-fid="{sid}" tabindex="0">'
            f'<div data-testid="User-Name"><a href="/{h}">{name}</a>\n<a href="/{h}">@{h}</a></div>'
            f'<a href="/{h}/status/{sid}"><time datetime="{t}">{4000 - int(sid)}分钟</time></a>{inner}'
            f'<div role="group" aria-label="1 回复"></div><button data-testid="caret" aria-label="更多" type="button">…</button></article></div></div>')
TH_EXTRA = (th_extra("3013", "Thread OP", "thread_op", '<div role="link" tabindex="0" class="x-quote"><div data-testid="User-Name">Long Writer\n@long_writer</div>'
              '<div data-testid="tweetText" lang="en" dir="auto">A very long quoted post that X only shows the start of, so there is a show more link inside the card</div>'
              '<span data-testid="tweet-text-show-more-link" class="card-more">显示更多</span></div>')
            + th_extra("3014", "Thread OP", "thread_op", '<div class="x-tr"></div><div data-testid="tweetText" lang="en" dir="auto">One more update: the beta is open to everyone now.</div>')
            + th_extra("3015", "@thread_op", "other_user3", '<div data-testid="tweetText" lang="zh" dir="auto">@outsider_x 看这里</div>'))
th_cells = "".join(th_art(k) for k in TH if k != "3009") + TH_EXTRA + '<div data-testid="cellInnerDiv"><div><h2>发现更多</h2></div></div>' + th_art("3009")
th_page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x thread</title>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419}} article{{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root}} [data-testid=User-Name]{{white-space:pre;font-weight:600}} [data-testid=User-Name] a{{color:inherit;text-decoration:none}} [data-testid=tweetText]{{white-space:pre-wrap;font-size:15px;line-height:20px}} .x-tr{{color:#536471;font-size:13px}} .x-tr:empty{{display:none}} .x-tr button{{border:0;background:none;color:#1d9bf0;padding:0 4px;cursor:pointer}}</style>
</head><body><main><div data-testid="primaryColumn"><section role="region"><div aria-label="时间线：对话">{th_cells}</div></section></div></main>{FAKE_MENU}<script>
const TH = {_json.dumps(TH, ensure_ascii=False)};
const q = new URLSearchParams(location.search);
if (q.has("notr")) TH["3001"].xtr = false;
if (!q.has("extra")) document.querySelectorAll("[data-extra]").forEach((e) => e.remove());
else {{
  Object.assign(TH["3001"], {{ fiber: true, full: TH["3001"].orig }}); // 主帖的原文在页面数据里
  window.__cardMore = 0;
  document.addEventListener("click", (e) => {{ if (e.target.closest(".card-more")) {{ window.__cardMore++; e.stopImmediatePropagation(); }} }}, true); // 卡片里的"显示更多"是链接（点了会跳走）：只记次数
  // 3014：过 1.2 秒才挂出"显示翻译"（按需翻译，点了和 3010 一样）
  setTimeout(() => {{
    const a = document.querySelector('article[data-fid="3014"]');
    TH["3014"] = {{ who: "op", lang: "en", orig: a.querySelector('[data-testid="tweetText"]').textContent, tr: "再更新一下：测试版现在对所有人开放了。", demand: true }};
    fill(a, "demand");
  }}, 1200);
}}
// 和 translate.html 一样：X 自动翻译过的（xtr）显示译文和"显示原文"，点了在微任务里换成原文；别的帖子直接是原文、带 lang
function fill(a, mode) {{
  const d = TH[a.dataset.fid], tt = a.querySelector('[data-testid="tweetText"]'), row = a.querySelector(".x-tr");
  a.dataset.mode = mode;
  if (!d.xtr && !d.demand) {{ tt.setAttribute("lang", d.lang); tt.innerHTML = d.expanded ? d.full : d.orig; row.innerHTML = ""; return; }}
  // 按需翻译：一开始只有"显示翻译"；点了先"正在翻译..."，然后和自动翻译的一样
  if (mode === "demand" || mode === "translating") {{
    tt.setAttribute("lang", d.lang); tt.innerHTML = d.orig;
    row.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/></svg>' +
      (mode === "demand" ? '<button type="button" aria-label="显示翻译">显示翻译</button>' : '<button type="button" aria-label="正在翻译...">正在翻译...</button>');
    return;
  }}
  tt.setAttribute("lang", mode === "tr" ? "zh" : d.lang);
  tt.innerHTML = mode === "tr" ? d.tr : d.orig;
  row.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/></svg><span>翻译自 英语</span>' + (mode === "tr" ? '<button type="button" aria-label="显示原文">显示原文</button>'
    : '<button type="button" aria-label="显示翻译">显示翻译</button><button type="button" aria-label="关于自动翻译">关于自动翻译</button>');
  a.dataset.mode = mode;
}}
document.querySelectorAll("article[data-fid]").forEach((a) => {{ const d = TH[a.dataset.fid]; if (d) fill(a, d.demand ? "demand" : d.startOrig ? "orig" : "tr"); }}); // ?extra 那几条是写死的
// 仿 React 的数据：X 没翻的长帖只有完整原文
document.querySelectorAll("article[data-fid]").forEach((a) => {{
  const d = TH[a.dataset.fid];
  if (d && d.fiber) a["__reactFiber$fake"] = {{ memoizedProps: {{}}, return: {{ memoizedProps: {{ tweet: {{ id_str: a.dataset.fid, lang: d.lang, note_tweet: {{ text: d.full, entity_set: {{ urls: [] }} }} }} }}, return: null }} }};
}});
window.__clicks = {{}}; window.__demandClicks = {{}}; // 所有切换按钮的点击 / 按需翻译那一下
document.addEventListener("click", (e) => {{
  const m = e.target.closest('[data-testid="tweet-text-show-more-link"]');
  if (m) {{ const a = m.closest("article"); queueMicrotask(() => window.__expand(a.dataset.fid)); return; }}
  const b = e.target.closest('button[aria-label="显示原文"], button[aria-label="显示翻译"]');
  if (!b) return;
  const a = b.closest("article");
  window.__clicks[a.dataset.fid] = (window.__clicks[a.dataset.fid] || 0) + 1;
  if (a.dataset.mode === "demand") {{
    window.__demandClicks[a.dataset.fid] = (window.__demandClicks[a.dataset.fid] || 0) + 1;
    queueMicrotask(() => fill(a, "translating")); setTimeout(() => fill(a, "tr"), 1500); return;
  }}
  queueMicrotask(() => fill(a, b.getAttribute("aria-label") === "显示原文" ? "orig" : "tr"));
}});
window.__expand = (id) => {{
  const a = document.querySelector(`article[data-fid="${{id}}"]`);
  TH[id].expanded = true;
  a.querySelector('[data-testid="tweet-text-show-more-link"]').remove();
  fill(a, a.dataset.mode);
}};
history.replaceState({{}}, "", "/thread_op/status/" + (q.get("focal") || "3001") + location.search); // 留着 ?jev=…（替身 Jev 读它）
const sc = document.createElement("script"); sc.src = "/inject_bundle.js"; document.body.appendChild(sc);
</script></body></html>'''
open(os.path.join(HERE, "fakex", "thread.html"), "w", encoding="utf-8").write(th_page)

# translate_en.html：X 的界面是英文（<html lang="en">），X 把外文帖子翻成英文。测插件的目标语言跟着 X 走、插进去的字是英文、
# 认 X 的翻译那一行不靠按钮上的字（这里故意用英文 aria-label）。默认是首页：5001 日文帖、X 的英文译文翻得差；5002 中文帖、
# X 翻成了英文、翻得好。?status：地址改成 /en_op/status/5101，主帖 5101 西班牙语、X 翻成了英文；楼主的回复 5102 西班牙语没翻
# （该补翻成英文）、5103 英文（和你的语言一样，不翻）。全是合成文字。
EN = {
    "5001": {"who": "@ja_user", "lang": "ja", "orig": "今日はいい天気ですね。みんなで散歩に行こう！", "tr": "Today is good weather isn't it. Let us go walking with everyone!", "xtr": True},
    "5002": {"who": "@zh_user", "lang": "zh", "orig": "今天发布了新版本，欢迎大家试用。", "tr": "We released a new version today, everyone is welcome to try it.", "xtr": True},
    "5101": {"who": "@en_op", "lang": "es", "orig": "Hoy lanzamos tres cosas nuevas.", "tr": "Today we launched three new things.", "xtr": True},
    "5102": {"who": "@en_op", "lang": "es", "orig": "Y una cosa más: el plan viejo sigue funcionando hasta el año que viene."},
    "5103": {"who": "@en_op", "lang": "en", "orig": "Thanks everyone for the feedback!"},
}
def en_art(sid):
    d = EN[sid]; h = d["who"][1:]
    return (f'<div data-testid="cellInnerDiv"><div><article data-testid="tweet" data-fid="{sid}">'
            f'<div data-testid="User-Name"><a href="/{h}">{h}</a>\n<a href="/{h}">{d["who"]}</a></div>'
            f'<a href="/{h}/status/{sid}"><time datetime="2026-10-11T01:00:00.000Z">1h</time></a>'
            f'<div class="x-tr"></div><div data-testid="tweetText" dir="auto"></div></article></div></div>')
en_page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>fake x english</title>
<style>body{{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto}} [data-testid=User-Name]{{white-space:pre;font-weight:600}} [data-testid=tweetText]{{white-space:pre-wrap}} .x-tr:empty{{display:none}}</style>
</head><body><main><div data-testid="primaryColumn"><section role="region"><div aria-label="Timeline"></div></section></div></main><script>
const EN = {_json.dumps(EN, ensure_ascii=False)};
const status = new URLSearchParams(location.search).has("status");
const ids = status ? ["5101", "5102", "5103"] : ["5001", "5002"];
document.querySelector('[aria-label="Timeline"]').innerHTML = ids.map((k) => EN_ART[k]).join("");
function fill(a, mode) {{
  const d = EN[a.dataset.fid], tt = a.querySelector('[data-testid="tweetText"]'), row = a.querySelector(".x-tr");
  if (!d.xtr) {{ tt.setAttribute("lang", d.lang); tt.textContent = d.orig; row.innerHTML = ""; return; }}
  tt.setAttribute("lang", mode === "tr" ? "en" : d.lang);
  tt.textContent = mode === "tr" ? d.tr : d.orig;
  row.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/></svg><span>Translated from another language</span>' +
    (mode === "tr" ? '<button type="button" aria-label="Show original">Show original</button>'
      : '<button type="button" aria-label="Show translation">Show translation</button><button type="button" aria-label="About auto-translation">About</button>');
  a.dataset.mode = mode;
}}
document.querySelectorAll("article[data-fid]").forEach((a) => fill(a, "tr"));
document.addEventListener("click", (e) => {{
  const b = e.target.closest(".x-tr button");
  if (!b) return;
  const a = b.closest("article");
  queueMicrotask(() => fill(a, a.dataset.mode === "tr" ? "orig" : "tr"));
}});
history.replaceState({{}}, "", status ? "/en_op/status/5101" : "/home");
const sc = document.createElement("script"); sc.src = "/inject_bundle.js"; document.body.appendChild(sc);
</script></body></html>'''.replace("EN_ART[k]", "EN_ART[k]")
en_page = en_page.replace("const EN = ", "const EN_ART = " + _json.dumps({k: en_art(k) for k in EN}, ensure_ascii=False) + ";\nconst EN = ", 1)
open(os.path.join(HERE, "fakex", "translate_en.html"), "w", encoding="utf-8").write(en_page)

# translate_net.html + i/api/graphql/fake/{HomeTimeline,TweetDetail}：照真 X 的顺序——页面先用 XHR 请求时间线接口
# （/i/api/graphql/…/HomeTimeline，返回的格式照 X：rest_id、legacy.full_text、display_text_range、note_tweet.note_tweet_results、
# grok_translated_post_with_availability.data），拿到了再把帖子画出来。测 pagedata.js 旁听接口返回：
# 5001 短帖：接口里的译文和屏幕上的一样 → 原文用接口的，不点"显示原文"；5002 长帖（包在 TweetWithVisibilityResults 里）：
# 不展开就拿到全文；5003 短帖：接口里的译文和屏幕上的对不上 → 退回点按钮读原文；5004 回复：full_text 开头带 @、结尾带图片 t.co，
# 按 display_text_range 截掉。TweetDetail 那份给测试用 fetch 去取（测 fetch 也听得到），里面的 5005 页面上没有；
# TweetResultByRestId 是 5001、5002 不带译文和全文的又一份（测不会冲掉先前记下的）。全是合成文字。
NET = {
    "5001": {"orig": "Netflix just raised prices again, and honestly I'm done.", "tr": "网飞又涨价了，说真的我受够了。"},
    "5002": {"orig": "This is a long post about our hiring plans. We are opening ten new roles across",
             "tr": "这是一篇关于我们招聘计划的长文。我们会在",
             "full_orig": "This is a long post about our hiring plans. We are opening ten new roles across design and engineering, all remote.",
             "full_tr": "这是一篇关于我们招聘计划的长文。我们会在设计和工程方向开放十个新岗位，全部远程。", "more": True},
    "5003": {"orig": "This update is a nice change.", "tr": "这个更新真不错。", "api_tr": "这次更新是个很好的改变。"},
    "5004": {"orig": "Great point about caching", "tr": "关于缓存说得很好", "reply_to": "someone"},
}
def api_tweet(sid, d):
    if d.get("reply_to"):
        prefix, media = f"@{d['reply_to']} ", " https://t.co/media04"
        full = prefix + d["orig"] + media
        rng = [len(prefix), len(prefix) + len(d["orig"])]
        ent = {"urls": [], "media": [{"url": "https://t.co/media04", "display_url": "pic.x.com/media04", "type": "photo"}]}
    else:
        full = d.get("full_orig", d["orig"])[:280] if d.get("more") else d["orig"]
        rng, ent = [0, len(full)], {"urls": []}
    t = {"__typename": "Tweet", "rest_id": sid, "legacy": {"full_text": full, "display_text_range": rng, "entities": ent, "lang": "en"},
         "core": {"user_results": {"result": {"__typename": "User", "rest_id": "9" + sid, "legacy": {"screen_name": f"user{sid}"}}}},
         "grok_translated_post_with_availability": {"data": {"translation": d.get("full_tr", d.get("api_tr", d["tr"])), "source_language": "en",
             "destination_language": "zh", "entities": {"urls": []}, **({"preview_translation": d["tr"]} if d.get("more") else {})}, "is_available": True}}
    if d.get("more"):
        t["note_tweet"] = {"is_expandable": True, "note_tweet_results": {"result": {"id": "N" + sid, "text": d["full_orig"], "entity_set": {"urls": []}}}}
        t = {"__typename": "TweetWithVisibilityResults", "tweet": {k: v for k, v in t.items() if k != "__typename"}}
    return {"entryId": f"tweet-{sid}", "content": {"itemContent": {"tweet_results": {"result": t}}}}
api_dir = os.path.join(HERE, "i", "api", "graphql", "fake")
os.makedirs(api_dir, exist_ok=True)
home = {"data": {"home": {"home_timeline_urt": {"instructions": [{"type": "TimelineAddEntries", "entries": [api_tweet(k, v) for k, v in NET.items()]}]}}}}
open(os.path.join(api_dir, "HomeTimeline"), "w", encoding="utf-8").write(_json.dumps(home, ensure_ascii=False))
detail = {"data": {"threaded_conversation_with_injections_v2": {"instructions": [{"type": "TimelineAddEntries", "entries": [
    api_tweet("5005", {"orig": "Fetched through fetch, not XHR.", "tr": "这条是用 fetch 取的。"})]}]}}}
open(os.path.join(api_dir, "TweetDetail"), "w", encoding="utf-8").write(_json.dumps(detail, ensure_ascii=False))
# TweetDetailAmp（0.28.9）：回复正文里有 & 和 <（full_text 里是 &amp; &lt;），开头带 @、结尾带图片 t.co。5006 的 display_text_range 按还原后的字算，
# 5007 按转义后的字算——X 是哪种没找到文档，两种都要截对："Tom & Jerry are back <3"
def amp_tweet(sid, escaped):
    prefix, body, media = "@someone ", "Tom &amp; Jerry are back &lt;3", " https://t.co/media" + sid
    shown = body if escaped else body.replace("&lt;", "<").replace("&amp;", "&")
    t = {"__typename": "Tweet", "rest_id": sid, "legacy": {"full_text": prefix + body + media, "display_text_range": [len(prefix), len(prefix) + len(shown)],
         "entities": {"urls": [], "media": [{"url": "https://t.co/media" + sid, "display_url": "pic.x.com/m" + sid, "type": "photo"}]}, "lang": "en"},
         "core": {"user_results": {"result": {"__typename": "User", "rest_id": "9" + sid, "legacy": {"screen_name": f"user{sid}"}}}}}
    return {"entryId": f"tweet-{sid}", "content": {"itemContent": {"tweet_results": {"result": t}}}}
amp = {"data": {"threaded_conversation_with_injections_v2": {"instructions": [{"type": "TimelineAddEntries", "entries": [amp_tweet("5006", False), amp_tweet("5007", True)]}]}}}
open(os.path.join(api_dir, "TweetDetailAmp"), "w", encoding="utf-8").write(_json.dumps(amp, ensure_ascii=False))
# TweetResultByRestId：5001、5002 又来一份，这次不带译文和长帖全文（有的接口就是这样）——先前记下的不能被冲掉
def stripped(sid):
    t = api_tweet(sid, NET[sid])["content"]["itemContent"]["tweet_results"]["result"]
    t = t.get("tweet", t)  # 5002 包在 TweetWithVisibilityResults 里
    return {**{k: v for k, v in t.items() if k not in ("grok_translated_post_with_availability", "note_tweet")}, "__typename": "Tweet"}
lite = {"data": {"tweetResult": {"result": stripped("5001")}, "quoted": {"result": stripped("5002")}}}
open(os.path.join(api_dir, "TweetResultByRestId"), "w", encoding="utf-8").write(_json.dumps(lite, ensure_ascii=False))
net_cells = "".join(tx_art(k, v) for k, v in NET.items())
net_page = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>fake x net</title>
<style>body{font:15px/1.5 -apple-system,sans-serif;max-width:600px;margin:20px auto;background:#fff;color:#0f1419} article{border-bottom:1px solid #eee;padding:10px 16px;display:flow-root} [data-testid=User-Name]{white-space:pre;font-weight:600} [data-testid=tweetText]{white-space:pre-wrap;font-size:15px;line-height:20px} .x-tr{color:#536471;font-size:13px} .x-tr button{border:0;background:none;color:#1d9bf0;padding:0 4px;cursor:pointer}</style>
</head><body><main><div data-testid="primaryColumn"><section role="region"><div aria-label="时间线：你的主页时间线" id="tl"></div></section></div></main><script>
const NET = __NET__, CELLS = __CELLS__;
window.__toggles = {}; window.__moreClicks = 0;
function fill(a, mode) {
  const d = NET[a.dataset.fid], tt = a.querySelector('[data-testid="tweetText"]'), row = a.querySelector(".x-tr");
  tt.setAttribute("lang", mode === "tr" ? "zh" : "en");
  tt.textContent = mode === "tr" ? d.tr : d.orig;
  row.innerHTML = '<svg width="12" height="12"></svg><span>翻译自 英语</span>' + (mode === "tr"
    ? '<button type="button" aria-label="显示原文">显示原文</button>'
    : '<button type="button" aria-label="显示翻译">显示翻译</button><button type="button" aria-label="关于自动翻译">关于自动翻译</button>');
}
document.addEventListener("click", (e) => {
  if (e.target.closest('[data-testid="tweet-text-show-more-link"]')) { window.__moreClicks++; return; }
  const b = e.target.closest(".x-tr button");
  if (!b) return;
  const a = b.closest("article"); window.__toggles[a.dataset.fid] = (window.__toggles[a.dataset.fid] || 0) + 1;
  queueMicrotask(() => fill(a, b.getAttribute("aria-label") === "显示原文" ? "orig" : "tr"));
}, true);
history.replaceState({}, "", "/home");
// 先装好插件（测试包，里面有 pagedata.js），再像 X 一样请求时间线接口，拿到了才画帖子
const sc = document.createElement("script"); sc.src = "/inject_bundle.js";
sc.onload = () => {
  const x = new XMLHttpRequest();
  x.open("GET", "/i/api/graphql/fake/HomeTimeline"); // X 用 POST；本地静态服务器只收 GET，旁听不看方法
  x.onload = () => { document.getElementById("tl").innerHTML = CELLS; document.querySelectorAll("article[data-fid]").forEach((a) => fill(a, "tr")); window.__rendered = true; };
  x.send();
};
document.body.appendChild(sc);
</script></body></html>""".replace("__NET__", _json.dumps(NET, ensure_ascii=False)).replace("__CELLS__", _json.dumps(net_cells, ensure_ascii=False))
open(os.path.join(HERE, "fakex", "translate_net.html"), "w", encoding="utf-8").write(net_page)

# ---------- 仿新版 Reddit（结构照 2026-10-12 从 Arc 里记下的：shreddit-post、shreddit-comment 里 details > 作者栏 / 正文 / 操作栏，回复嵌在里面） ----------
# reddit/post.html → /r/fakesub/comments/abc123/slug/：r01 拉人（测试用 ?jev 给垃圾分）、r02 骂人（带"傻"，下面嵌着正常回复 r03）、r04 色情（"露骨"）、
# r05 楼主自己的（is-op，0.21.3 起照样发给 Jev 判，这句没问题、不折）、r06–r08 三个号刷同一句带"主页"的话（D1）、r09 正常的英文、一条评论区广告。
# reddit/feed.html → /r/fakesub/：f1 正常、f2 拉人、f3 色情、一条广告帖。reddit/search.html → /search/?q=fake：s1 正常、s2 骂人、s3 拉人。全是合成文字。
# 和真 Reddit 一样：<shreddit-post>、<shreddit-post-text-body> 有 shadow DOM，里面只有带名字的 slot，不带 slot 的孩子不显示；
# 主帖标题是 <h1 slot=title>（字直接在里面），正文是 <shreddit-post-text-body> > <div slot=text-body> > <div class="mb-xs …"> > <div class="md …">；
# 列表里的卡片上盖着一个透明的 <a slot=full-post-link>（absolute inset-0，点卡片哪里都进帖子），标题是 <a slot=title>。
def rcomment(cid, author, text, depth, op=False, kids="", minutes=30):
    ts = (NOW - datetime.timedelta(minutes=minutes)).isoformat() + "+0000"
    opattr = ' is-op=""' if op else ""
    return (f'<shreddit-comment thingid="t1_{cid}" author="{author}" depth="{depth}" created="{ts}" postid="t3_abc123" is-translatable=""{opattr}>'
            f'<details open><summary><div slot="commentMeta"><a href="/user/{author}/">{author}</a> · 1 小时</div></summary>'
            f'<div class="rgrid"><div class="min-w-0"><div slot="comment" id="t1_{cid}-comment-rtjson-content" class="md"><div dir="auto"><p>{text}</p></div></div></div>'
            f'<div class="min-w-0"><div slot="actionRow"><button>回复</button><button>分享</button></div></div>'
            f'<div id="t1_{cid}-children">{kids}</div></div></details></shreddit-comment>')
DUP = "这个福利大家快去看我主页领取吧真的"
r_comments = "".join([
    rcomment("r01", "spam_bot1", "加我微信领资料，名额有限</p>\n          <p>资料很全，先到先得", 0),  # 两段、带缩进换行：折起来以后不能一闪一闪
    rcomment("r02", "hater_x", "这个傻子什么都不懂", 0, kids=rcomment("r03", "calm_user", "别这样说话，好好讨论", 1)),
    rcomment("r04", "porn_x", "露骨的合成测试文字", 0),
    rcomment("r05", "op_user", "我说的是另一件事，大家别误会", 0, op=True),
    rcomment("r06", "dup_a", DUP, 0, minutes=20), rcomment("r07", "dup_b", DUP, 0, minutes=19), rcomment("r08", "dup_c", DUP, 0, minutes=18),
    rcomment("r09", "en_user", "Interesting point about caching, thanks for sharing.", 0),
    '<shreddit-comment-tree-ad><div>广告：买它买它</div></shreddit-comment-tree-ad>',
])
R_STYLE = ("body{font:15px/1.5 -apple-system,sans-serif;max-width:720px;margin:20px auto;background:#fff;color:#1a1a1b} shreddit-comment{display:block;margin:8px 0} "
           "details{padding-left:12px;border-left:2px solid #eee} shreddit-post{display:block;position:relative;border:1px solid #eee;border-radius:12px;padding:12px;margin:8px 0} "
           "summary{list-style:none} a[slot=full-post-link]{position:absolute;inset:0} h1[slot=title]{font-size:18px;margin:0} a[slot=title]{display:block;font-size:17px;font-weight:600;color:inherit;text-decoration:none} "
           "faceplate-screen-reader-content{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)} "
           ".md p{margin:4px 0} "
           # 照 Reddit 的几个工具类排版（搜索结果一行三格、盖住整条的透明链接、摘要宽屏 6 行），放错地方测得出来
           ".relative{position:relative} .absolute{position:absolute} .inset-0{inset:0} .flex{display:flex} .flex-col{flex-direction:column} "
           ".items-start{align-items:flex-start} .items-center{align-items:center} .justify-between{justify-content:space-between} .w-full{width:100%} "
           ".min-w-0{min-width:0} .thumb{flex:none;width:80px;height:60px;background:#ddd;border-radius:4px} .pointer-events-none{pointer-events:none} "
           ".feed-card-text-preview{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:6;overflow:hidden} "
           ".line-clamp-2{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden} .text-sm{font-size:14px;line-height:20px} "
           ".font-semibold{font-weight:600} .mt-2xs{margin-top:4px} .truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .shrink-0{flex-shrink:0} "
           ".no-underline{text-decoration:none} .avatar{display:inline-block;width:16px;height:16px;border-radius:50%;background:#f60;margin-right:4px} "
           ".m-0{margin:0} .text-14{font-size:14px;line-height:20px}")
# 仿 shreddit 的 shadow DOM：只放带名字的 slot（真插件的端到端测试也要它，所以和装测试包的那段 <script> 分开）
R_SHADOW = '''<script id="fake-shreddit">
const def = (name, slots) => customElements.define(name, class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block}</style>" + slots.map((s) => `<div><slot name="${s}"></slot></div>`).join(""); } });
def("shreddit-post", ["full-post-link", "credit-bar", "title", "post-flair", "text-body"]);
def("shreddit-post-text-body", ["text-body"]);
</script>'''
def rpage(title, path, body):
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title><style>{R_STYLE}</style>{R_SHADOW}</head><body><shreddit-app>{body}</shreddit-app><script id="ff-inject">
const P = {_json.dumps(path)}, q = location.search.slice(1); // 留着 ?jev=…（替身 Jev 读它）
history.replaceState({{}}, "", q ? P + (P.includes("?") ? "&" : "?") + q : P);
const sc = document.createElement("script"); sc.src = "/inject_reddit.js"; document.body.appendChild(sc);
</script></body></html>'''
def rmainpost(pid, author, title, lang, body):
    return (f'<shreddit-post id="t3_{pid}" author="{author}" post-title="{title}" post-language="{lang}" is-translatable="">'
            f'<div slot="credit-bar">r/fakesub · u/{author} · 3 小时</div>'
            f'<h1 slot="title" id="post-title-t3_{pid}" class="text-18 font-semibold" dir="auto" aria-describedby="post-meta">{title}<faceplate-perfmark name="title"></faceplate-perfmark></h1>'
            f'<shreddit-post-text-body slot="text-body" post-id="t3_{pid}"><div slot="text-body" class="text-neutral-content">'
            f'<div class="mb-xs px-md xs:px-0 overflow-hidden" data-post-click-location="text-body"><div class="md text-14" id="t3_{pid}-post-rtjson-content"><p>{body}</p></div></div>'
            f'</div></shreddit-post-text-body></shreddit-post>')
r_post = rpage("fake reddit post", "/r/fakesub/comments/abc123/slug/",
  rmainpost("abc123", "op_user", "合成帖子：大家怎么看这件事", "zh", "正文的合成文字，随便聊聊。")
  + f'<shreddit-comment-tree post-id="t3_abc123">{r_comments}</shreddit-comment-tree>')
# 正文摘要（paras 是几段字）：照真 Reddit 的样子（2026-10-13 记下的）——<a slot=text-body class=pointer-events-none> 里
# <div class=overflow-hidden> 里 <div class="md feed-card-text-preview line-clamp-3 xs:line-clamp-6">；
# 带服务端渲染的缩进换行——藏起来以后 innerText 读到的和显示时不一样（0.13.2 以前会一闪一闪）
def rpreview(pid, paras):
    ps = "".join(f"\n        <p>{x}</p>" for x in paras)
    return (f'<shreddit-post-text-body slot="text-body" post-id="t3_{pid}">\n  '
            f'<a slot="text-body" href="/r/fakesub/comments/{pid}/x/" class="hover:no-underline no-underline pointer-events-none text-neutral-content">\n    '
            f'<div class="overflow-hidden" data-post-click-location="text-body">\n      '
            f'<div class="md feed-card-text-preview text-ellipsis line-clamp-3 xs:line-clamp-6 text-14-scalable" id="t3_{pid}-post-rtjson-content">{ps}\n      </div>\n    </div>\n  </a>\n</shreddit-post-text-body>')
def rfeedpost(pid, author, title, lang="zh", paras=None):
    href = f"/r/fakesub/comments/{pid}/x/"
    return (f'<article data-post-id="t3_{pid}"><shreddit-post id="t3_{pid}" author="{author}" post-title="{title}" post-language="{lang}" feedindex="1">'
            f'<a slot="full-post-link" href="{href}"><faceplate-screen-reader-content>{title}</faceplate-screen-reader-content></a>'
            f'<span slot="credit-bar">r/fakesub · 1 小时</span>'
            f'<a slot="title" id="post-title-t3_{pid}" href="{href}" class="block" dir="auto" data-ks-id="t3_{pid}">{title}</a>'
            + (rpreview(pid, paras) if paras else "") + '</shreddit-post></article>')
r_feed = rpage("fake reddit feed", "/r/fakesub/", "<shreddit-feed>" + rfeedpost("f1", "nice_user", "今天的合成日常分享")
  + rfeedpost("f2", "spam_bot2", "加我微信领资料，名额有限", paras=["第一段合成文字，资料很全。", "第二段：名额有限，先到先得。"]) + rfeedpost("f3", "porn_y", "露骨的合成测试标题")
  + '<article><shreddit-ad-post><a slot="title">买它买它</a></shreddit-ad-post></article></shreddit-feed>')
# 搜索结果（"帖子"那一栏）一条：照真 Reddit 的样子（2026-10-13 记下的）——一行三格：① 盖住整条的透明链接
# <h2><a data-testid=post-title class="absolute inset-0">（只有读屏的字）；② 竖着排的一格：版块和时间、看得见的标题
# <a data-testid=post-title-text>（搜的词加粗）、票数评论数；③ 缩略图
def runit(pid, title, query=""):
    href = f"/r/fakesub/comments/{pid}/x/"
    shown = title.replace(query, f'<span data-testid="post-title-query" class="font-bold">{query}</span>', 1) if query and query in title else title
    return (f'<search-telemetry-tracker data-testid="search-sdui-post" data-thingid="t3_{pid}" view-events="x">'
            f'<div data-testid="search-post-unit" class="flex justify-between items-center relative">'
            f'<search-telemetry-tracker click-events="x"><h2 class="m-0"><a data-testid="post-title" class="absolute inset-0" href="{href}" aria-label="{title}">'
            f'<faceplate-screen-reader-content>{title}</faceplate-screen-reader-content></a></h2></search-telemetry-tracker>'
            f'<div data-testid="sdui-post-unit" class="w-full flex flex-col items-start min-w-0 pe-md">'
            f'<div><div class="post-credit-row flex items-center">r/fakesub · 2 天前</div></div>'
            f'<a data-testid="post-title-text" id="search-post-title-t3_{pid}" class="xs:text-18 no-underline" href="{href}">{shown}</a>'
            f'<div data-testid="search-counter-row">12 票 · 3 条评论</div></div>'
            f'<search-telemetry-tracker click-events="x"><a class="a" href="{href}"><div class="thumb"></div></a></search-telemetry-tracker>'
            f'</div></search-telemetry-tracker>')
# 带正文摘要的那种（2026-10-13 记下的：testid 是 search-post-with-content-preview，最外层的 tracker 没有 data-thingid；
# 摘要具体是什么元素还没记下来——nested=False 时是一层 <div class=line-clamp-2> 直接装字，True 时外面一层 div、里面 <p>）
def runit_pv(pid, title, preview, query="", nested=False):
    href = f"/r/fakesub/comments/{pid}/x/"
    pv = (f'<div class="line-clamp-2"><p class="m-0 text-14">{preview}</p></div>' if nested else f'<div class="line-clamp-2 text-14">{preview}</div>')
    return (f'<search-telemetry-tracker view-events="x" consume-events="x">'
            f'<div data-testid="search-post-with-content-preview" class="flex justify-between items-center relative">'
            f'<search-telemetry-tracker click-events="x"><h2 class="m-0"><a data-testid="post-title" class="absolute inset-0" href="{href}" aria-label="{title}">'
            f'<faceplate-screen-reader-content>{title}</faceplate-screen-reader-content></a></h2></search-telemetry-tracker>'
            f'<div data-testid="sdui-post-unit" class="w-full flex flex-col items-start min-w-0 pe-md">'
            f'<div><div class="post-credit-row flex items-center">r/fakesub · 2 天前</div></div>'
            f'<a data-testid="post-title-text" id="search-post-title-t3_{pid}" class="xs:text-18 no-underline" href="{href}">{title}</a>'
            f'{pv}<div data-testid="search-counter-row">12 票 · 3 条评论</div></div>'
            f'<search-telemetry-tracker click-events="x"><a class="a" href="{href}"><div class="thumb"></div></a></search-telemetry-tracker>'
            f'</div></search-telemetry-tracker>')
# 搜索的"媒体"那一栏一格（2026-10-13 记下的）：<search-media-feed> 的孩子 <search-telemetry-tracker view-events data-measured style> 里 <div data-id>：
# 图片链接（里面有"1/6"页数）、版块那一行 <div class=mt-2xs> 里 <faceplate-hovercard>、标题 <a class="… line-clamp-2">
def rmedia(pid, title, img_h=180):
    href = f"/r/fakesub/comments/{pid}/x/"
    return (f'<search-telemetry-tracker view-events="x" consume-events="x"><div data-id="t3_{pid}">'
            f'<search-telemetry-tracker click-events="x"><a class="no-underline" href="{href}"><div class="relative" style="height:{img_h}px;background:#ccd;border-radius:8px">'
            f'<div class="absolute inset-0 flex items-start" style="justify-content:flex-end"><button class="pointer-events-none"><span>1/6</span></button></div></div></a></search-telemetry-tracker>'
            f'<div class="mt-2xs"><faceplate-hovercard><search-telemetry-tracker click-events="x"><a class="flex items-center font-semibold no-underline" href="/r/fakesub/">'
            f'<span class="flex shrink-0 items-center"><span class="avatar"></span></span><span class="truncate">r/fakesub</span></a></search-telemetry-tracker>'
            f'<div slot="content" hidden><faceplate-partial></faceplate-partial></div></faceplate-hovercard></div>'
            f'<search-telemetry-tracker click-events="x"><a class="no-underline text-sm font-semibold mt-2xs line-clamp-2" href="{href}">{title}</a></search-telemetry-tracker>'
            f'</div></search-telemetry-tracker>')
# 瀑布流：和 Reddit 一样载入时量一次每格的高度、按量的排（grid-row-end: span N），以后不再量——插件换上的东西变高了就会压住下面那格
MASONRY = ('<style>search-media-feed{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:8px;column-gap:16px} '
           'search-media-feed>search-telemetry-tracker{display:block}</style>'
           '<script>for (const e of document.querySelectorAll("search-media-feed > search-telemetry-tracker")) {'
           ' e.style.gridRowEnd = "span " + Math.ceil((e.firstElementChild.getBoundingClientRect().height + 16) / 8); e.setAttribute("data-measured", ""); }</script>')
# reddit/posts.html → /posts/2026/global/（"Reddit 最佳"年度帖子页）：照真页面（2026-10-13 记下的）——不是 shreddit-post，一张卡片
# <div class="py-md …"> 里：版块和时间一行、指向帖子的链接里 <div class="i18n-list-item-post-content" post-id> 里 <h3 class="i18n-list-item-post-title">；
# 缩略图；票数评论数。y1 英文（要翻）、y2 拉人（要折）、y3 中文（不翻）
def ryearcard(pid, sub, title):
    href = f"/r/{sub}/comments/{pid}/x/"
    return (f'<div class="py-md px-md xs:px-0"><div actioned=""><div class="flex text-neutral-content text-12"><div class="flex flex-col grow min-w-0">'
            f'<div class="items-center w-full"><faceplate-hovercard><div class="flex items-center"><a href="/r/{sub}/">r/{sub}</a>'
            f'<span aria-hidden="true"> · </span><faceplate-timeago><time>13 天前</time></faceplate-timeago></div></faceplate-hovercard></div>'
            f'<div class="flex"><a class="flex flex-wrap group" href="{href}"><div class="i18n-list-item-post-content flex grow min-w-0" post-id="t3_{pid}">'
            f'<div class="flex flex-col grow"><h3 class="i18n-list-item-post-title line-clamp-2 m-0" dir="auto" title="{title}" aria-label="{title}">{title}</h3></div></div></a></div>'
            f'</div><div class="flex"><div data-testid="post-thumbnail" class="thumb"></div></div></div>'
            f'<div class="min-w-full"><div>12 万 个赞同 · 927 条评论</div></div></div></div>')
r_posts = rpage("fake reddit best of", "/posts/2026/global/", '<main id="main-content" dir="auto"><section><div>'
  + ryearcard("y1", "ExpectationVsReality", "What I asked for, color palette, and what I got") + ryearcard("y2", "spamsub", "加我微信领资料，名额有限")
  + ryearcard("y3", "zhsub", "今天的合成日常分享") + '</div></section></main>')
# reddit/news.html → /news/：网址不是认识的列表，但页面里是 Reddit 标准的帖子列表（shreddit-feed 里的 shreddit-post）：照帖子列表管
r_news = rpage("fake reddit news", "/news/", "<shreddit-feed>" + rfeedpost("n1", "news_a", "今天的合成新闻一则") + rfeedpost("n2", "spam_bot3", "加我微信领资料，名额有限") + "</shreddit-feed>")
r_search = rpage("fake reddit search", "/search/?q=fake", runit("s1", "正常的合成搜索结果") + runit("s2", "这个傻子发的合成帖子") + runit("s3", "加我微信领资料，名额有限")
  + runit_pv("s4", "分享一份合成的学习资料", "资料在这里，加我微信领资料，名额有限") + runit_pv("s5", "正常的带摘要的合成结果", "摘要里也是正常的合成文字。"))
# reddit/post_en.html → /r/fakesub/comments/def456/slug/：英文帖子（post-language="en"）。e1、e3 英文评论（要翻），e2 中文评论（不翻），
# e4 英文但带"傻"（替身给辱骂分：折叠时译文跟着藏起来），e5 日文（界面是中文，日文也翻），e6 西班牙文（帖子标的是英文，说明要写西班牙语）。
r_comments_en = "".join([
    rcomment("e1", "en_a", "This is the best explanation I have read all week.", 0),
    rcomment("e2", "zh_b", "我觉得这个说法有道理，谢谢分享。", 0),
    rcomment("e3", "en_c", "Does anyone know if this works on older versions?", 0),
    rcomment("e4", "en_d", "You are such a 傻 person, stop posting.", 0),
    rcomment("e5", "ja_e", "これはとても面白い話ですね。", 0),
    rcomment("e6", "es_f", "¿Alguien sabe si esto funciona en versiones antiguas?", 0),
]).replace('postid="t3_abc123"', 'postid="t3_def456"')
r_post_en = rpage("fake reddit post en", "/r/fakesub/comments/def456/slug/",
  rmainpost("def456", "op_en", "How do you keep your notes organized?", "en", "I keep losing track of things. Any tips?")
  + f'<shreddit-comment-tree post-id="t3_def456">{r_comments_en}</shreddit-comment-tree>')
# reddit/post_long.html → /r/fakesub/comments/lng789/slug/：很长的英文帖子（8 段，其中一段比一块还长），一条很长的英文评论 l1，一条短的 l2。
LONG_POST = [
  "I have been running a small home lab for about three years now, and I wanted to write up what I learned along the way.",
  "First, hardware. I started with an old office desktop I bought for forty dollars. It had a dated processor, eight gigs of memory and a single hard drive. Honestly, that machine taught me more than anything I bought since. If you are just starting, do not buy a rack server. They are loud, they eat power, and most of what you want to learn runs fine on a mini PC.",
  "Second, power and noise. My first upgrade was a used enterprise server, and within a month I was asked to move it to the garage. " * 8
  + "Then the garage got too hot in summer and the drives started throwing errors, so I sold it at a loss and bought two small fanless boxes.",
  "Third, backups. Everyone says this, and everyone ignores it until they lose something. Now I follow a simple rule: one copy on site, one copy off site, and one that cannot be changed for thirty days.",
  "Fourth, documentation. I keep a plain text file for every service: what it does, how it is installed, which ports it uses and how to restore it.",
  "Fifth, do not self-host your email. Deliverability was a nightmare and half my messages went to spam.",
  "Finally, the community. Most of what I know came from people in forums like this one who took the time to answer beginner questions.",
  "What would you add to this list? I am especially curious about how people handle updates without breaking things.",
]
r_comments_long = (rcomment("l1", "en_long", "</p>\n          <p>".join([
    "Great write-up. I went through almost exactly the same path, including the loud server phase that ended in the garage.",
    "One thing I would add about updates: keep a staging copy of the services that matter, even if it is just a second container with the same config. " * 3,
    "Also, schedule updates for a time when you can actually fix things if they break, not five minutes before you leave for the weekend."]), 0)
  + rcomment("l2", "en_short", "Thanks for sharing, this is useful.", 0)).replace('postid="t3_abc123"', 'postid="t3_lng789"')
r_post_long = rpage("fake reddit post long", "/r/fakesub/comments/lng789/slug/",
  rmainpost("lng789", "op_long", "What three years of running a home lab taught me", "en", "</p>\n        <p>".join(LONG_POST))
  + f'<shreddit-comment-tree post-id="t3_lng789">{r_comments_long}</shreddit-comment-tree>')
# reddit/post_fmt.html → /r/fakesub/comments/fmt321/slug/：带格式的英文评论（照 Reddit 渲染出来的 HTML）——
# m1 网址本身的链接（用户截图里那条）；m2 带字的链接 + 加粗；m3 列表 + 行内代码 + u/账号链接；m4 引用 + 斜体，两段；
# m5 测试里让替身把标记弄丢（退回纯文字时网址照样留着）。
def rcomment_html(cid, author, html, depth=0):
    ts = (NOW - datetime.timedelta(minutes=30)).isoformat() + "+0000"
    return (f'<shreddit-comment thingid="t1_{cid}" author="{author}" depth="{depth}" created="{ts}" postid="t3_fmt321" is-translatable="">'
            f'<details open><summary><div slot="commentMeta"><a href="/user/{author}/">{author}</a> · 1 小时</div></summary>'
            f'<div class="rgrid"><div class="min-w-0"><div slot="comment" id="t1_{cid}-comment-rtjson-content" class="md text-14-scalable pb-2xs pt-2xs">'
            f'<div dir="auto">\n      {html}\n    </div></div></div>'
            f'<div class="min-w-0"><div slot="actionRow"><button>回复</button></div></div><div id="t1_{cid}-children"></div></div></details></shreddit-comment>')
r_comments_fmt = "".join([
    rcomment_html("m1", "mod_a", '<p>Source with more info: <a href="https://x.com/TheEVuniverse/status/2108212821150613801" class="link">https://x.com/TheEVuniverse/status/2108212821150613801</a></p>'),
    rcomment_html("m2", "fmt_b", '<p>Check out <a href="https://example.com/article" class="link">this article</a> about <strong>battery chemistry</strong>, it explains the curve well.</p>'),
    rcomment_html("m3", "fmt_c", '<p>Things I would add to the list:</p>\n      <ul>\n        <li>Use <code>htop</code> for monitoring</li>\n        <li>Ask <a href="/user/someone/">u/someone</a> for help with the setup</li>\n      </ul>'),
    rcomment_html("m4", "fmt_d", '<p>Someone on another forum put it best:</p>\n      <blockquote><p><em>Backups are a promise to your future self.</em></p></blockquote>'),
    rcomment_html("m5", "fmt_e", '<p>Read the <a href="https://example.com/faq">FAQ</a> first, the details are here: <a href="https://example.com/details">https://example.com/details</a></p>'),
])
r_post_fmt = rpage("fake reddit post fmt", "/r/fakesub/comments/fmt321/slug/",
  rmainpost("fmt321", "op_fmt", "Formatting test thread", "en", 'See <a href="https://example.com/guide" class="link">the full guide</a> and <strong>read it twice</strong>.')
  + f'<shreddit-comment-tree post-id="t3_fmt321">{r_comments_fmt}</shreddit-comment-tree>')
# reddit/feed_en.html → /r/fakesub/：g1 英文标题 + 很长的英文摘要（只翻前 600 字左右）、g3 日文标题 + 日文摘要（要翻），g2 中文（不翻），一条英文广告帖（不翻）。
# reddit/search_en.html → /search/?q=keyboard：k1 英文（要翻）、k2 中文（不翻）。
LONG_EN = ["I have been comparing a few boards for a while and wanted to share my notes before I decide.",
           "The first one is quiet and solid, but the software is clunky and the keycaps feel cheap after a month of daily use. " * 3,
           "The second one is louder, though the build quality is better and it holds up well. " * 3,
           "What would you pick if you mostly type at night and share a room with someone who sleeps early?"]
r_feed_en = rpage("fake reddit feed en", "/r/fakesub/", "<shreddit-feed>" + rfeedpost("g1", "en_a", "Best budget mechanical keyboard this year?", "en", paras=LONG_EN)
  + rfeedpost("g2", "zh_b", "今天的合成日常分享", paras=["中文的摘要，不用翻。"]) + rfeedpost("g3", "ja_c", "これはとても面白い話ですね", "ja", paras=["短い日本語の本文です。"])
  + '<article><shreddit-ad-post><a slot="title">Buy this keyboard now</a></shreddit-ad-post></article></shreddit-feed>')
# c1–c3 带正文摘要：c1 标题、摘要都是英文（都翻），c2 中文标题、英文摘要（只翻摘要，摘要外面多一层），c3 英文标题、中文摘要（只翻标题）
r_search_en = rpage("fake reddit search en", "/search/?q=keyboard", runit("k1", "Which keyboard switches are the quietest?", "keyboard") + runit("k2", "安静的键盘推荐一下")
  + runit_pv("c1", "My first custom keyboard build", "It took three weekends, but the sound is exactly what I wanted.")
  + runit_pv("c2", "终于把键盘组装好了", "Lubing the stabilizers made the biggest difference for me.", nested=True)
  + runit_pv("c3", "Is this keyboard worth the price?", "做工不错，就是有点贵。"))
# reddit/search_media.html → /search/?q=idol&type=media："媒体"那一栏。w1 英文短标题、w2 英文长标题（原来两行，译文更长也不能变高）、
# w3 中文（不翻）、w4 色情（折起来，折叠条在格子里）、w5 w6 垫在下面（压没压住看得出）
r_search_media = rpage("fake reddit search media", "/search/?q=idol&type=media", "<main><search-media-feed>"
  + rmedia("w1", "Idols who look the same as debut", 200) + rmedia("w2", "What are the biggest downfalls you know about in this whole industry so far?", 150)
  + rmedia("w3", "合成的中文标题，不用翻", 170) + rmedia("w4", "露骨的合成测试标题", 160) + rmedia("w5", "Another synthetic media post", 120) + rmedia("w6", "One more synthetic media post", 140)
  + "</search-media-feed></main>" + MASONRY)
# reddit/feed_far.html：很长的帖子列表，英文帖子之间隔着很高的空白——测视野外先处理的范围（上下各一屏、左右各半屏）：
# h1 在最上面；h2 在三屏以下；h4 再往下三屏；h3 在最底下，和 h4 隔 900 像素（滚到底时 h4 在视野上面一屏以内）
SP = lambda h: f'<div style="height:{h}px"></div>'
r_feed_far = rpage("fake reddit feed far", "/r/fakesub/", "<shreddit-feed>" + rfeedpost("h1", "far_a", "First synthetic post at the top of the feed", "en")
  + SP(3000) + rfeedpost("h2", "far_b", "Second synthetic post three screens further down", "en")
  + SP(3000) + rfeedpost("h4", "far_d", "Fourth synthetic post just above the last one", "en")
  + SP(900) + rfeedpost("h3", "far_c", "Third synthetic post at the very bottom", "en") + SP(400) + "</shreddit-feed>")
# reddit/feed_many.html：40 条短的英文帖子（每条只有标题），?y=1000 打开时滚到中间——测先翻视野里的、上面那一屏的排在后面
r_feed_many = rpage("fake reddit feed many", "/r/fakesub/", "<shreddit-feed>" + "".join(rfeedpost(f"q{i:02d}", f"user_{i}", f"Synthetic English post number {i} about everyday things", "en") for i in range(40))
  + "</shreddit-feed>" + '<script>{ const y = new URLSearchParams(location.search).get("y"); if (y) scrollTo(0, Number(y)); }</script>')
os.makedirs(os.path.join(HERE, "fakex", "reddit"), exist_ok=True)
# reddit/post_img.html（看图片，0.18）：i1 有字有图、i2 只有图、i3 只有字；图是 preview.redd.it 的网址（测试里拦下来）
def rcomment_img(cid, author, text, src):
    return rcomment(cid, author, text, 0).replace(f'<div dir="auto"><p>{text}</p></div>', f'<div dir="auto">{f"<p>{text}</p>" if text else ""}<figure><a href="{src}"><img src="{src}" alt="图"></a></figure></div>', 1)
r_post_img = rpage("看图片 : r/fakesub", "/r/fakesub/comments/img777/slug/", rmainpost("img777", "op_user", "晒晒你们的桌面", "zh", "<p>合成的帖子正文</p>")
  + "".join([rcomment_img("i1", "img_text", "我的桌面", "https://preview.redd.it/fake_i1.jpg"), rcomment_img("i2", "img_only", "", "https://preview.redd.it/fake_i2.jpg"),
             rcomment("i3", "txt_only", "好整齐", 0)]))
# reddit/post_heavy.html → /r/fakesub/comments/hvy001/slug/（0.27）：7 条垃圾和正常评论一条隔一条（替身按"领福利"给引流分）：整条藏起来、最上面一行汇总
r_post_heavy = rpage("fake reddit post heavy", "/r/fakesub/comments/hvy001/slug/",
  rmainpost("hvy001", "op_heavy", "晒几张旅行照片", "zh", "上个月去海边拍的")
  + '<shreddit-comment-tree post-id="t3_hvy001">' + "".join(
      rcomment(f"h{i}", f"heavy_bot_{i}", sp, 0) + (rcomment(f"k{i}", f"heavy_ok_{i}", HEAVY_OK[i], 0) if i < len(HEAVY_OK) else "")
      for i, sp in enumerate(HEAVY_SPAM)).replace('postid="t3_abc123"', 'postid="t3_hvy001"') + '</shreddit-comment-tree>')
# reddit/post_many.html → /r/fakesub/comments/mny001/slug/（0.27）：18 条正常评论 + 2 条"nice"（替身给「赞」「mark」这类的分）：评论区长，下面也放一行
MANY_OK = [f"第 {i} 条正常的评论，说说我自己的看法和经历，写得长一点免得被当成短回复" for i in range(18)]
r_post_many = rpage("fake reddit post many", "/r/fakesub/comments/mny001/slug/",
  rmainpost("mny001", "op_many", "大家平时怎么整理照片", "zh", "手机里的照片越来越多了")
  + '<shreddit-comment-tree post-id="t3_mny001">' + "".join(
      [rcomment("n1", "nice_a", "nice", 0)] + [rcomment(f"m{i}", f"many_ok_{i}", t, 0) for i, t in enumerate(MANY_OK)] + [rcomment("n2", "nice_b", "nice", 0)]
    ).replace('postid="t3_abc123"', 'postid="t3_mny001"') + '</shreddit-comment-tree>')
for name, html in [("post_many", r_post_many), ("post_heavy", r_post_heavy), ("post_img", r_post_img), ("post", r_post), ("feed", r_feed), ("search", r_search), ("post_en", r_post_en), ("feed_en", r_feed_en), ("search_en", r_search_en), ("post_long", r_post_long), ("post_fmt", r_post_fmt), ("news", r_news), ("posts", r_posts), ("feed_far", r_feed_far), ("search_media", r_search_media), ("feed_many", r_feed_many)]:
    open(os.path.join(HERE, "fakex", "reddit", name + ".html"), "w", encoding="utf-8").write(html)


# ---------- 仿 Hacker News（结构照 2026-10-13 打开真页面看的：服务端直出的表格，回复不嵌套、层级在 td.ind[indent]，
# 评论正文 div.comment > div.commtext 第一段是裸文字、后面才是 <p>） ----------
# hn/news.html → /news：9001 9003 英文标题（要翻），9002 中文（不翻），9004 只有名字（测试里让替身原样返回：译文和原文一样就不换）。hn/item.html → /item?id=9100（Ask HN，楼主 alice）：
# h1 带格式的英文（裸文字 + 网址链接 + <p> + <i> + 带字的链接 + 代码块）、h2 回复（indent 1）、h3 骂人（带"傻"，替身给辱骂 0.9）、
# h4 自己做的工具（?jev 给"引流"0.95：HN 上不折垃圾）、h5 色情（"露骨"）、h6 楼主自己的（带"傻"，不折）、h7 中文（不翻）、
# h8 带刺的（?jev 给辱骂 0.75：HN 上辱骂要到 0.8 才折）。全是合成文字。
HN_STYLE = ("body{font-family:Verdana,Geneva,sans-serif;font-size:10pt;color:#828282;margin:8px} #hnmain{background:#f6f6ef} "
            ".titleline{font-size:10pt} .titleline>a{color:#000;text-decoration:none} .sitebit{font-size:8pt} .subtext{font-size:7pt} "
            ".comhead{font-size:8pt} .comment{font-size:9pt} .commtext{color:#000} .c00{color:#000} pre{white-space:pre-wrap} .votearrow{width:10px;height:10px}")
def hpage(title, path, body):
    return f"""<!doctype html><html lang="en" op="news"><head><meta charset="utf-8"><title>{title}</title><style>{HN_STYLE}</style></head><body><center>
<table id="hnmain" border="0" cellpadding="0" cellspacing="0" width="85%"><tr><td style="background:#ff6600;padding:2px"><b>Hacker News</b></td></tr>
<tr id="pagespace" title="" style="height:10px"></tr><tr><td>{body}</td></tr></table></center>
<script id="ff-inject">
const P = {_json.dumps(path)}, q = location.search.slice(1); // 留着 ?jev=…（替身 Jev 读它）
history.replaceState({{}}, "", q ? P + (P.includes("?") ? "&" : "?") + q : P);
const sc = document.createElement("script"); sc.src = "/inject_hn.js"; document.body.appendChild(sc);
</script></body></html>"""
def hstory(sid, rank, title, user="alice", site="example.com"):
    return (f'<tr class="athing submission" id="{sid}"><td align="right" valign="top" class="title"><span class="rank">{rank}.</span></td>'
            f'<td valign="top" class="votelinks"><center><a id="up_{sid}" href="vote?id={sid}&amp;how=up&amp;goto=news"><div class="votearrow" title="upvote"></div></a></center></td>'
            f'<td class="title"><span class="titleline"><a href="https://{site}/story/{sid}">{title}</a><span class="sitebit comhead"> (<a href="from?site={site}"><span class="sitestr">{site}</span></a>)</span></span></td></tr>'
            f'<tr><td colspan="2"></td><td class="subtext"><span class="subline"><span class="score" id="score_{sid}">174 points</span> by <a href="user?id={user}" class="hnuser">{user}</a> '
            f'<span class="age" title="2026-10-13T10:27:00"><a href="item?id={sid}">1 hour ago</a></span> | <a href="item?id={sid}">59&nbsp;comments</a></span></td></tr>'
            f'<tr class="spacer" style="height:5px"></tr>')
def hcomment(cid, user, html, indent=0):
    return (f'<tr class="athing comtr" id="{cid}"><td><table border="0"><tbody><tr><td class="ind" indent="{indent}"><img src="s.gif" height="1" width="{indent * 40}"></td>'
            f'<td valign="top" class="votelinks"><center><a id="up_{cid}" href="vote?id={cid}&amp;how=up&amp;goto=item%3Fid%3D9100"><div class="votearrow" title="upvote"></div></a></center></td>'
            f'<td class="default"><div style="margin-top:2px; margin-bottom:-10px;"><span class="comhead"><a href="user?id={user}" class="hnuser">{user}</a> '
            f'<span class="age" title="2026-10-13T11:16:53"><a href="item?id={cid}">53 minutes ago</a></span> <span id="unv_{cid}"></span><span class="navs"> | '
            f'<a class="togg clicky" id="{cid}" n="1" href="javascript:void(0)">[–]</a></span></span></div><br>\n'
            f'<div class="comment"><div class="commtext c00">{html}</div><div class="reply"><p><font size="1"><u><a href="reply?id={cid}&amp;goto=item%3Fid%3D9100">reply</a></u></font></p></div></div></td></tr></tbody></table></td></tr>')
hn_news = hpage("Hacker News", "/news", '<table border="0" cellpadding="0" cellspacing="0">'
  + hstory("9001", 1, "Synthetic story about faster build systems") + hstory("9002", 2, "合成的中文标题，不用翻", "bob", "example.cn")
  + hstory("9003", 3, "Show HN: A tiny synthetic weather station") + hstory("9004", 4, "Apple HomeView", "carol", "apple.com") + "</table>")
HN_H1 = ('Type systems are hard!  Check out <a href="https://counterexamples.org/" rel="nofollow">https://counterexamples.org/</a>'
         '<p>I gave it a <i>quick</i> scan for examples in other languages.</p><p>Second paragraph with a <a href="https://example.com/notes" rel="nofollow">named link</a> in it.</p>'
         '<pre><code>  let x = compute(1);</code></pre>\nThe last part comes after the code block.')
hn_item = hpage("Ask HN: What tools do you use? | Hacker News", "/item?id=9100",
  '<table class="fatitem" border="0"><tr class="athing submission" id="9100"><td align="right" valign="top" class="title"><span class="rank"></span></td>'
  '<td valign="top" class="votelinks"><center><a id="up_9100" href="vote?id=9100&amp;how=up&amp;goto=item%3Fid%3D9100"><div class="votearrow" title="upvote"></div></a></center></td>'
  '<td class="title"><span class="titleline"><a href="item?id=9100">Ask HN: What synthetic tools do you use every day?</a></span></td></tr>'
  '<tr><td colspan="2"></td><td class="subtext"><span class="subline"><span class="score" id="score_9100">88 points</span> by <a href="user?id=alice" class="hnuser">alice</a> '
  '<span class="age" title="2026-10-13T09:00:00"><a href="item?id=9100">3 hours ago</a></span> | <a href="item?id=9100">8&nbsp;comments</a></span></td></tr>'
  '<tr><td colspan="2"></td><td><div class="toptext">I have been looking for <i>good</i> tools for a while.<p>Any suggestions are welcome.</p></div></td></tr></table><br>'
  '<table border="0" class="comment-tree"><tbody>'
  + hcomment("9101", "bob", HN_H1) + hcomment("9102", "carol", "Thanks, this is a really useful list of references.", 1)
  + hcomment("9103", "dave", "You are a 傻 person, stop posting nonsense.") + hcomment("9104", "eve", "I built a tool for exactly this, check out https://mytool.example.com")
  + hcomment("9105", "mallory", "露骨 synthetic test text") + hcomment("9106", "alice", "Thanks everyone for the suggestions so far.")
  + hcomment("9107", "frank", "这个说法有道理，谢谢分享。") + hcomment("9108", "grace", "This is a borderline remark about boomers and their tools.")
  + "</tbody></table>")
# hn/item_misc.html → /item?id=9200（0.28.10，tx_misc_headless）：9201 只贴了一段代码（不翻）；9202 字里本来就有"<t1>""<x3/>"（像插件的标记）；
# 9203 测试里会改它的字（改了要重翻）。全是合成文字。
hn_misc = hpage("Ask HN: Synthetic misc | Hacker News", "/item?id=9200",
  '<table class="fatitem" border="0"><tr class="athing submission" id="9200"><td align="right" valign="top" class="title"><span class="rank"></span></td>'
  '<td valign="top" class="votelinks"><center><a id="up_9200" href="vote?id=9200&amp;how=up&amp;goto=item%3Fid%3D9200"><div class="votearrow" title="upvote"></div></a></center></td>'
  '<td class="title"><span class="titleline"><a href="item?id=9200">Ask HN: Synthetic misc thread</a></span></td></tr>'
  '<tr><td colspan="2"></td><td class="subtext"><span class="subline"><span class="score" id="score_9200">5 points</span> by <a href="user?id=alice" class="hnuser">alice</a> '
  '<span class="age" title="2026-10-13T09:00:00"><a href="item?id=9200">3 hours ago</a></span></span></td></tr></table><br>'
  '<table border="0" class="comment-tree"><tbody>'
  + hcomment("9201", "bob", "<pre><code>  let total = items.reduce((a, b) =&gt; a + b, 0);</code></pre>")
  + hcomment("9202", "carol", "Write &lt;t1&gt; and &lt;x3/&gt; literally in the template, the engine replaces them later.")
  + hcomment("9203", "dave", "The first version of this comment talks about synthetic gardens.")
  + "</tbody></table>")
# hn/news_many.html → /news?p=2：30 个英文标题（0.19.4，测短的几条拼一个请求）。全是编的
HN_WORDS = ["compiler", "database", "kernel", "browser", "garden", "satellite", "keyboard", "protocol", "bicycle", "telescope"]
hn_many = hpage("Hacker News", "/news?p=2", '<table border="0" cellpadding="0" cellspacing="0">' + "".join(
  hstory(str(9200 + k), k + 1, f"Synthetic story {k + 1}: a new {HN_WORDS[k % 10]} written from scratch in a weekend", "user%d" % k, "example%d.com" % k) for k in range(30)) + "</table>")
os.makedirs(os.path.join(HERE, "fakex", "hn"), exist_ok=True)
for name, html in [("news", hn_news), ("item", hn_item), ("news_many", hn_many), ("item_misc", hn_misc)]:
    open(os.path.join(HERE, "fakex", "hn", name + ".html"), "w", encoding="utf-8").write(html)

# ---------- 仿 YouTube（结构照 2026-10-13 在无头 Chrome 里看的真页面：ytd-comment-thread-renderer > ytd-comment-view-model，
# 正文 yt-attributed-string#content-text 里一个 span，时间链接带 &lc=评论 id；标题是链接里夹着一段字，链接限 2–3 行） ----------
# yt/watch.html → /watch?v=SYNTHVID001（频道 Synthetic Channel，@SynthChannel）：
#   c01 正常英文（要翻）、c02 频道主自己的（页面数据 isCreator，不折）、c03 冒充频道主（@SynthChannel-x7k2，留 Telegram 领奖；?jev 给 setup 0.6：名字像、Jev 也觉得像骗局才折）、
#   c04–c06 三个号吹同一个币 Zentrocoin（?jev 给引流 0.5/0.55/0.62：单看只有一条到 0.6，成群才都折）、
#   c07 粉丝喊刷播放量（?jev 给"伪装的推广"0.9：YouTube 只看引流，不折）、c08 骂人（带"傻"）、c09 中文（不翻）、
#   c10 带时间戳链接、外链和表情图片（带格式翻）；r01 是 c01 下面的回复（评论 id 里有点）。
#   0.15.1/0.15.2：c11 一串西班牙语的一唱一和（"引流"都不高，setup 高：开头的人自己在回复里说去 Telegram 找、有人报"老师"全名、
#   有人跟着夸，只问了一句的不折——规则只看分和结构，不读字）、c12 英文、c15 中文的"晒收益"开头（?jev 给 setup 0.85 / 0.82）、
#   c13 只贴一个链接（页面数据里是完整网址）、c14 一个词报币名（?jev 给引流 0.7：短评论要 0.85 才折）、
#   @repeater 在 c12–c14 下面各回一遍同一句话（同一个号发了 3 遍）。
#   页面数据（yt/youtubei/v1/next，ytdata.js 旁听）：谁是频道主、频道 id；ytInitialPlayerResponse 给这个视频是谁的。
# yt/results.html → /results?search_query=engines：s1 英文标题 + 简介摘要（要翻），s2 中文（不翻）。全是合成文字。
YT_STYLE = ("body{font:14px/20px Roboto,Arial,sans-serif;margin:0;background:#fff;color:#0f0f0f} #primary{max-width:860px;margin:16px} "
            "ytd-watch-metadata h1{font-size:20px;line-height:28px;font-weight:700;margin:0} #channel-name a{color:#0f0f0f;text-decoration:none} "
            "#snippet{overflow:hidden;max-height:6rem} ytd-comment-view-model{display:block;margin:16px 0} #header-author{display:flex;gap:6px;font-size:13px} "
            "#header-author h3{margin:0;font-size:13px} ytd-expander{display:block} #action-buttons{display:block;font-size:12px;color:#606060} "
            "ytd-comment-replies-renderer{display:block;margin-left:56px} .lockup a.ytLockupMetadataViewModelTitle{display:flow-root;-webkit-line-clamp:3;max-height:60px;overflow:hidden;font-size:14px;line-height:20px} "
            "ytd-video-renderer{display:block;margin:12px 0} ytd-video-renderer a#video-title{display:flow-root;-webkit-line-clamp:2;max-height:52px;overflow:hidden;font-size:18px;line-height:26px;color:#0f0f0f} "
            ".metadata-snippet-text{display:block;-webkit-line-clamp:2;max-height:36px;overflow:hidden;font-size:12px;line-height:18px;color:#606060} "
            ".ytAttributedStringWhiteSpacePreWrap{white-space:pre-wrap}")
def ypage(title, path, body, extra=""):
    return f"""<!doctype html><html lang="zh-Hans-CN"><head><meta charset="utf-8"><title>{title}</title><style>{YT_STYLE}</style>{extra}</head><body><ytd-app><div id="content">{body}</div></ytd-app>
<script id="ff-inject">
const P = {_json.dumps(path)}, q = location.search.slice(1); // 留着 ?jev=…（替身 Jev 读它）
history.replaceState({{}}, "", q ? P + (P.includes("?") ? "&" : "?") + q : P);
const sc = document.createElement("script"); sc.src = "/inject_yt.js";
// 评论像真页面一样：先从 youtubei/v1/next 回来数据，再画出来（模板里的评论放进评论区）
sc.onload = () => fetch("/fakex/yt/youtubei/v1/next").then((r) => r.json()).then(() => {{
  const t = document.getElementById("yt-comments"), box = document.querySelector("ytd-comments #contents");
  if (t && box) box.append(t.content.cloneNode(true));
}}).catch(() => {{}});
document.body.appendChild(sc);
</script></body></html>"""
VID = "SYNTHVID001"
def ycomment(cid, handle, html, tx=None):
    # tx：YouTube 自己的"翻译成中文（中国）"按钮（native.html 用）："ok" 点了换成译文，"fail" 点了没反应
    btn = (f'<ytd-tri-state-button-view-model class="translate-button style-scope ytd-comment-view-model" state="untoggled" data-fake="{tx}">'
           '<tp-yt-paper-button role="button">' + ("Translate to Chinese (China)" if tx == "ok" else "日本語に翻訳") + '</tp-yt-paper-button></ytd-tri-state-button-view-model>') if tx else ""
    return (f'<ytd-comment-view-model id="comment" class="style-scope ytd-comment-thread-renderer"><div id="body"><div id="main">'
            f'<div id="header"><div id="header-author"><h3><a id="author-text" class="yt-simple-endpoint" href="/{handle}"><span> {handle} </span></a></h3>'
            f'<span id="author-comment-badge"></span><span dir="auto" id="published-time-text"><a class="yt-simple-endpoint" href="/watch?v={VID}&amp;lc={cid}">1 小时前</a></span></div></div>'
            f'<ytd-expander id="expander"><div id="content"><yt-attributed-string slot="content" id="content-text"><span class="ytAttributedStringHost ytAttributedStringWhiteSpacePreWrap" dir="auto" role="text">{html}</span></yt-attributed-string></div></ytd-expander>{btn}'
            f'<ytd-comment-engagement-bar id="action-buttons"><div id="toolbar"><span id="vote-count-middle">12</span> · 回复</div></ytd-comment-engagement-bar>'
            f'<div id="action-menu"></div></div></div></ytd-comment-view-model>')
def ythread(cid, handle, html, replies=""):
    rep = (f'<ytd-comment-replies-renderer><div id="expander"><div id="expander-contents"><div id="contents">{replies}</div></div></div></ytd-comment-replies-renderer>' if replies else "")
    return f'<ytd-comment-thread-renderer>{ycomment(cid, handle, html)}<div id="replies">{rep}</div></ytd-comment-thread-renderer>'
YT_COMMENTS = [
    ("Ugc01", "@synthfan1", "This explanation finally made the topic click for me, thanks!", ythread),
    ("Ugc02", "@SynthChannel", "Thanks for watching everyone! New video next week.", ythread),
    ("Ugc03", "@SynthChannel-x7k2", "Thanks for watching! Contact me on Telegram @synthgift to claim your prize 🎁", ythread),
    ("Ugc04", "@coinfan_a", "Glad I found Zentrocoin early, it is going to fly.", ythread),
    ("Ugc05", "@coinfan_b", "Zentrocoin presale is almost over, I am already in.", ythread),
    ("Ugc06", "@coinfan_c", "If one coin hits 100x this year it is Zentrocoin.", ythread),
    ("Ugc07", "@streamfan", "Let us stream more, we are so close to 100M views!", ythread),
    ("Ugc08", "@angry_x", "You are a 傻 idiot, nobody asked.", ythread),
    ("Ugc09", "@zh_viewer", "讲得很清楚，谢谢分享。", ythread),
    ("Ugc10", "@timefan", f'The best part is at <a class="yt-core-attributed-string__link" href="/watch?v={VID}&amp;t=95s">1:35</a> and the notes are on <a class="yt-core-attributed-string__link" href="https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.com">example.com</a> <img class="yt-core-image" alt="👍" src="data:,"> so good', ythread),
    ("Ugc11", "@quietstart", "¿Alguien de verdad gana dinero con esto? Llevo meses aprendiendo y sigo perdiendo.", ythread),
    ("Ugc12", "@growthstory", "I started with $3,000 last month and now I am at $21,400. Thank you for all the knowledge you share!", ythread),
    ("Ugc13", "@linkdrop", '<a class="yt-core-attributed-string__link" href="/watch?v=PROMOVID001">https://www.youtube.com/watch?v=PROMOVID001</a>', ythread),
    ("Ugc14", "@adafan", "Cardano!", ythread),
    ("Ugc15", "@growthzh", "上个月才投了三万，现在已经二十一万了，真心感谢一路带我的人！", ythread),
]
GOD = "God bless you all and tell your friends and family about this"
YT_REPLIES = {
    "Ugc01": [("Ugc01.R01", "@replyguy", "Agreed, the second half is even better.")],
    "Ugc11": [("Ugc11.R01", "@asker1", "¿Cómo empezaste?"),
              ("Ugc11.R02", "@mentorfan", "Yo sigo a la señora Valeria Ostin, explica todo en vivo, búscala."),
              ("Ugc11.R03", "@praiser", "Esta mujer de verdad cambió mi vida, la recomiendo a todos."),
              ("Ugc11.R04", "@quietstart", "Está sobre todo en Telegram, busca su nombre.")],
    "Ugc12": [("Ugc12.R01", "@repeater", "@growthstory " + GOD)],
    "Ugc13": [("Ugc13.R01", "@repeater", "@linkdrop " + GOD)],
    "Ugc14": [("Ugc14.R01", "@repeater", GOD)],
}
yt_comments_html = "".join(f(cid, h, t, "".join(ycomment(rid, rh, rt) for rid, rh, rt in YT_REPLIES.get(cid, []))) for cid, h, t, f in YT_COMMENTS)
_txt = lambda h: __import__("re").sub(r"<[^>]+>", "", h)  # 页面数据里是纯文字（链接是完整网址）
yt_next = {"frameworkUpdates": {"entityBatchUpdate": {"mutations": [
    {"payload": {"commentEntityPayload": {"properties": {"commentId": cid, "content": {"content": _txt(t)}, "replyLevel": 0},
      "author": {"channelId": "UCsynthchannel00000000000" if cid == "Ugc02" else "UCother" + cid, "displayName": h, "isCreator": cid == "Ugc02", "isVerified": False}}}}
    for cid, h, t, _ in YT_COMMENTS] + [{"payload": {"commentEntityPayload": {"properties": {"commentId": rid, "content": {"content": rt}, "replyLevel": 1},
      "author": {"channelId": "UC" + rh[1:], "displayName": rh, "isCreator": False, "isVerified": False}}}} for rs in YT_REPLIES.values() for rid, rh, rt in rs]}}}
yt_watch = ypage("How Synthetic Engines Work, Explained - YouTube", f"/watch?v={VID}",
  '<div id="primary"><ytd-watch-metadata><div id="title"><h1 class="style-scope ytd-watch-metadata"><yt-formatted-string class="style-scope ytd-watch-metadata">How Synthetic Engines Work, Explained</yt-formatted-string></h1></div>'
  '<div id="owner"><ytd-video-owner-renderer><div id="channel-name"><a class="yt-simple-endpoint" href="/@SynthChannel">Synthetic Channel</a></div></ytd-video-owner-renderer></div>'
  '<div id="description-inner"><div id="info-container">12万次观看 2 天前</div><ytd-text-inline-expander id="description-inline-expander"><div id="expanded"><yt-attributed-string user-input=""></yt-attributed-string></div>'
  '<div id="snippet"><span id="snippet-text"><yt-attributed-string id="attributed-snippet-text"><span class="ytAttributedStringHost ytAttributedStringWhiteSpacePreWrap" dir="auto" role="text">In this video we walk through synthetic engines step by step, from the basics to the tricky parts.</span></yt-attributed-string></span><span id="ellipsis">…</span></div>'
  '<tp-yt-paper-button id="expand">...更多</tp-yt-paper-button></ytd-text-inline-expander></div></ytd-watch-metadata>'
  '<div id="related"><yt-lockup-view-model class="lockup"><div class="ytLockupViewModelHost content-id-RELATEDV001"><div class="ytLockupViewModelMetadata"><h3 title="Synthetic engines, part two"><a href="/watch?v=RELATEDV001" class="ytLockupMetadataViewModelTitle"><span class="ytAttributedStringHost" role="text">Synthetic engines, part two</span></a></h3></div></div></yt-lockup-view-model>'
  '<yt-lockup-view-model class="lockup"><div class="ytLockupViewModelHost content-id-RELATEDV002"><div class="ytLockupViewModelMetadata"><h3 title="合成发动机第三集"><a href="/watch?v=RELATEDV002" class="ytLockupMetadataViewModelTitle"><span class="ytAttributedStringHost" role="text">合成发动机第三集</span></a></h3></div></div></yt-lockup-view-model></div>'
  f'<ytd-comments id="comments"><ytd-item-section-renderer id="sections"><div id="contents"></div></ytd-item-section-renderer></ytd-comments></div><template id="yt-comments">{yt_comments_html}</template>',
  extra='<script>window.ytInitialPlayerResponse = { videoDetails: { videoId: "SYNTHVID001", channelId: "UCsynthchannel00000000000", author: "Synthetic Channel" } };</script>')
def yresult(vid, title, snippet):
    return (f'<ytd-video-renderer><div id="dismissible"><div class="text-wrapper"><div id="title-wrapper"><h3 class="title-and-badge"><a id="video-title" class="yt-simple-endpoint" title="{title}" href="/watch?v={vid}">'
            f'<yt-icon id="inline-title-icon" hidden=""></yt-icon><yt-formatted-string class="style-scope ytd-video-renderer">{title}</yt-formatted-string></a></h3></div>'
            f'<div class="metadata-snippet-container"><yt-formatted-string class="metadata-snippet-text style-scope ytd-video-renderer">{snippet}</yt-formatted-string></div></div></div></ytd-video-renderer>')
# yt/native.html → /watch?v=SYNTHVID001（0.28.1）：评论带 YouTube 自己的"翻译成中文（中国）"按钮（登录了才有，Shorts、视频页都是）。
#   Ugn01 韩文、按钮能用（点了正文换成"【YouTube 翻译】…"）；Ugn02 西班牙文、按钮点了没反应（YouTube 没翻成 → 插件自己翻）；
#   Ugn03 日文、没按钮（插件自己翻）；Ugn04 中文、没按钮（不翻）。按钮上的字故意是英文、日文（插件认的是组件和 state，不读字——
#   YouTube 的按钮按你账号的界面语言写"翻译成中文（中国）""Translate to English""日本語に翻訳"……）。
YT_NATIVE = [("Ugn01", "@kfan", "수많은 챌린지를 했지만 선생님 옆에선 정말 사랑스러워", "ok"), ("Ugn02", "@esfan", "¿Alguien sabe dónde comprar esta tienda de campaña?", "fail"),
             ("Ugn03", "@jafan", "このテントはとても大きくて素敵ですね。", None), ("Ugn04", "@zhfan", "这个帐篷看起来真不错，求链接。", None)]
yt_native_js = """<script>
document.addEventListener("click", (ev) => {
  const p = ev.target.closest(".translate-button tp-yt-paper-button"), host = p && p.closest(".translate-button");
  if (!host || host.dataset.fake !== "ok") return;
  const span = host.closest("ytd-comment-view-model").querySelector("#content-text > span");
  if (host.getAttribute("state") === "untoggled") { span.__orig = span.textContent; span.textContent = "【YouTube 翻译】" + span.__orig; host.setAttribute("state", "toggled"); p.textContent = "See original (Translated by Google)"; }
  else { span.textContent = span.__orig; host.setAttribute("state", "untoggled"); p.textContent = "Translate to Chinese (China)"; }
});
</script>"""
yt_native = ypage("How Synthetic Engines Work, Explained - YouTube", f"/watch?v={VID}",
  '<div id="primary"><ytd-watch-metadata><div id="title"><h1 class="style-scope ytd-watch-metadata"><yt-formatted-string class="style-scope ytd-watch-metadata">合成发动机讲解</yt-formatted-string></h1></div></ytd-watch-metadata>'
  f'<ytd-comments id="comments"><ytd-item-section-renderer id="sections"><div id="contents"></div></ytd-item-section-renderer></ytd-comments></div>'
  f'<template id="yt-comments">{"".join(f"<ytd-comment-thread-renderer>{ycomment(cid, h, t, tx)}</ytd-comment-thread-renderer>" for cid, h, t, tx in YT_NATIVE)}</template>',
  extra='<script>window.ytInitialPlayerResponse = { videoDetails: { videoId: "SYNTHVID001", channelId: "UCsynthchannel00000000000", author: "Synthetic Channel" } };</script>' + yt_native_js)
# yt/long.html → /watch?v=SYNTHVID001（0.28.7，review）：Ugl01 英文、字里带换行（YouTube 的评论是 pre-wrap，换行是 \n 不是 <br>）；
#   Ugl02 英文长评论（9000 多字，中间一个链接）：整段超过后台一条 5000 字的上限，要切成几截翻。全是合成文字。
LONG_SENT = ["The first engine we built in the garage was loud, heavy and leaked oil everywhere.", "We replaced the gaskets twice before the summer was over.",
             "Nobody in the family believed it would ever run for more than a minute.", "Then one evening it idled for an hour while we ate dinner outside.",
             "That was the moment I decided to study mechanical engineering."]
yt_long_body = " ".join(LONG_SENT[k % 5] for k in range(60)) + ' The notes are on <a class="yt-core-attributed-string__link" href="https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.com%2Fnotes">example.com/notes</a> if you want them. ' + " ".join(LONG_SENT[(k + 2) % 5] for k in range(60)) + " Thanks for reading this far, it really is the end now."
YT_LONG = [("Ugl01", "@linefan", "First line of my note.\nSecond line goes here.\n\nThird line after a blank one."), ("Ugl02", "@storyfan", yt_long_body)]
yt_long = ypage("How Synthetic Engines Work, Explained - YouTube", f"/watch?v={VID}",
  '<div id="primary"><ytd-watch-metadata><div id="title"><h1 class="style-scope ytd-watch-metadata"><yt-formatted-string class="style-scope ytd-watch-metadata">合成发动机讲解</yt-formatted-string></h1></div></ytd-watch-metadata>'
  f'<ytd-comments id="comments"><ytd-item-section-renderer id="sections"><div id="contents"></div></ytd-item-section-renderer></ytd-comments></div>'
  f'<template id="yt-comments">{"".join(f"<ytd-comment-thread-renderer>{ycomment(cid, h, t)}</ytd-comment-thread-renderer>" for cid, h, t in YT_LONG)}</template>',
  extra='<script>window.ytInitialPlayerResponse = { videoDetails: { videoId: "SYNTHVID001", channelId: "UCsynthchannel00000000000", author: "Synthetic Channel" } };</script>')
yt_results = ypage("engines - YouTube", "/results?search_query=engines", '<div id="primary"><ytd-section-list-renderer><div id="contents">'
  + yresult("SEARCHV0001", "Why synthetic engines are quieter than you think", "A long look at noise levels, materials and the tricks engineers use every day.")
  + yresult("SEARCHV0002", "合成发动机入门", "从零开始讲合成发动机。") + "</div></ytd-section-list-renderer></div>")
os.makedirs(os.path.join(HERE, "fakex", "yt", "youtubei", "v1"), exist_ok=True)
for name, html in [("watch", yt_watch), ("results", yt_results), ("native", yt_native), ("long", yt_long)]:
    open(os.path.join(HERE, "fakex", "yt", name + ".html"), "w", encoding="utf-8").write(html)
open(os.path.join(HERE, "fakex", "yt", "youtubei", "v1", "next"), "w", encoding="utf-8").write(_json.dumps(yt_next, ensure_ascii=False))

# ---------- 仿小红书（结构照 2026-10-15 在浏览器里登录后看的真页面：#noteContainer 里标题 #detail-title、正文 #detail-desc > span.note-text，
# 评论 .parent-comment > .comment-item#comment-<id>，回复在后面的 .reply-container 里（.comment-item-sub），正文 .content > span.note-text，
# 回复楼中楼时 .content 里先是"回复 某某："；作者 .author a.name[data-user-id]，笔记作者自己的名字后面有 span.tag"作者"） ----------
# xhs/note.html → /explore/<笔记 id>（整页打开的笔记；作者"合成作者小蓝"）：英文标题、英文正文（带 #话题 链接和表情图片）要翻；
#   c01 英文（要翻）、r01 是它下面的回复（"回复 Mia："不算正文，正文英文要翻）、r02 色情（"露骨"）、c02 笔记作者自己的（带"傻"，不折、不发给 Jev）、
#   c03 骂人（带"傻"）、c04 引流（?jev 给引流 0.9；带评论配图，折起来配图也藏）、c05 中文（不翻不折）、c06 日文（要翻）、c07 只有表情图片（没字，不判）、
#   c08 只 @ 了朋友（?jev 给引流 0.9：小红书上不按垃圾折）、c09 c0a c0b 三条"原评论已删除"（删掉了的评论，不判、不当同帖复读）。
# xhs/explore.html → /explore（首页列表）：n1、n3 英文标题（要翻，✦ 在最前面）、n2 中文；页面上 __openNote() 像真页面一样点开浮层
#   （网址变成 /explore/<笔记 id>，下面的列表还在），__closeNote() 关掉回到列表。xhs/search.html → /search_result?keyword=outfit。全是合成文字。
XHS_STYLE = ("body{margin:0;font:14px/1.5 -apple-system,'PingFang SC',sans-serif;color:#333;background:#fff} .feeds-container{display:grid;grid-template-columns:repeat(3,200px);gap:16px;padding:16px} "
             "section.note-item .footer{padding:8px} section.note-item a.title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;font-weight:500;color:#333;text-decoration:none} "
             ".note-detail-mask{position:fixed;inset:0;background:rgba(0,0,0,.25);overflow:auto} #noteContainer{display:flex;background:#fff;max-width:960px;margin:24px auto;height:calc(100vh - 48px);overflow:auto} "
             ".media-container{width:360px;flex:none;background:#eee} .interaction-container{flex:1;padding:16px} .author-container a.name{color:#333;text-decoration:none} "
             "#detail-title{font-size:18px;font-weight:600;margin:12px 0 8px} #detail-desc{font-size:16px;line-height:1.6} #detail-desc a.tag{color:#13386c;text-decoration:none} "
             ".comment-item{display:block;margin:12px 0} .comment-inner-container{display:flex;gap:12px} .avatar img{width:40px;height:40px;border-radius:50%} .right{flex:1} "
             ".author-wrapper{display:flex;justify-content:space-between} .author{display:flex;align-items:center;gap:4px;font-size:14px} .author a.name{color:rgba(51,51,51,.8);text-decoration:none} "
             ".author .tag{font-size:12px;padding:0 4px;border-radius:8px;background:#f5f5f5;color:#999} .content{margin-top:4px;font-size:14px;line-height:1.5} .content .nickname{color:rgba(51,51,51,.8)} "
             ".note-content-emoji{width:16px;height:16px;vertical-align:-3px} .comment-picture img{width:120px;height:120px;background:#ddd} .info{display:flex;justify-content:space-between;font-size:12px;color:#999;margin-top:8px} "
             ".reply-container{margin-left:52px} .show-more{color:#13386c;font-size:14px;cursor:pointer}")
def xpage(title, path, body, extra_js=""):
    return f"""<!doctype html><html class="ai-layout-active"><head><meta charset="utf-8"><title>{title}</title><style>{XHS_STYLE}</style></head><body><div id="app"><div id="global" class="layout">{body}</div></div>
<script id="ff-inject">
const P = {_json.dumps(path)}, q = location.search.slice(1); // 留着 ?jev=…（替身 Jev 读它）
history.replaceState({{}}, "", q ? P + (P.includes("?") ? "&" : "?") + q : P);
{extra_js}
const sc = document.createElement("script"); sc.src = "/inject_xhs.js"; document.body.appendChild(sc);
</script></body></html>"""
XNID, XUID = "6f00000000000000000a0001", "5f00000000000000000a0001"
EMOJI = '<img class="note-content-emoji" crossorigin="anonymous" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'
def xcomment(cid, uid, name, inner, sub=False, author=False, pic=False, to=None):
    tag = '<span class="tag" selected-disabled-search="">作者</span>' if author else ""
    pre = f'<span>回复</span><span class="nickname">{to}</span> : ' if to else ""
    picture = '<div class="comment-picture"><div class="comment-image-gallery"><div class="img-box"><img class="inner" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div></div></div>' if pic else ""
    return (f'<div id="comment-{cid}" class="comment-item{" comment-item-sub" if sub else ""}"><div class="comment-inner-container">'
            f'<div class="avatar"><a href="/user/profile/{uid}?xsec_source=pc_comment" data-user-id="{uid}"><img class="avatar-item" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a></div>'
            f'<div class="right"><div class="author-wrapper"><div class="author"><a href="/user/profile/{uid}?xsec_source=pc_comment" class="name" data-user-id="{uid}">{name}</a>{tag}</div>'
            f'<div class="comment-menu"><div class="delete-dropdown"><svg width="16" height="16"></svg></div></div></div>'
            f'<div class="content">{pre}<span class="note-text">{inner}</span></div>{picture}'
            f'<div class="info"><div class="date"><span>3天前</span><span class="location">上海</span></div><div class="interactions"><div class="like"><span class="count">12</span></div>'
            f'<div class="reply icon-container"><span class="count">回复</span></div></div></div></div></div></div>')
def xparent(c, replies=(), more=None):
    rep = f'<div class="reply-container"><div class="list-container">{"".join(replies)}</div>{f"<div class=show-more>{more}</div>" if more else ""}</div>' if replies else ""
    return f'<div class="parent-comment">{c}{rep}</div>'
X_COMMENTS = "".join([
  xparent(xcomment("6f10000000000000000c0001", "5f10000000000000000a0001", "Mia", "<span>This color looks amazing, where did you buy it?</span>"),
          [xcomment("6f10000000000000000c0011", "5f10000000000000000a0002", "Leo", "<span>Same question, the coat is lovely.</span>", sub=True, to="Mia"),
           xcomment("6f10000000000000000c0012", "5f10000000000000000a0003", "合成号甲", "<span>露骨 合成测试文字</span>", sub=True)], more="展开 3 条回复"),
  xparent(xcomment("6f10000000000000000c0002", XUID, "合成作者小蓝", "<span>谢谢大家，有问题也可以问我</span>", author=True)),
  xparent(xcomment("6f10000000000000000c0003", "5f10000000000000000a0004", "合成号乙", "<span>你这个傻 博主懂什么</span>")),
  xparent(xcomment("6f10000000000000000c0004", "5f10000000000000000a0005", "合成号丙", "<span>姐妹看我主页，同款低价出</span>", pic=True)),
  xparent(xcomment("6f10000000000000000c0005", "5f10000000000000000a0006", "合成号丁", "<span>好好看，求链接！</span>" + EMOJI)),
  xparent(xcomment("6f10000000000000000c0006", "5f10000000000000000a0007", "合成号戊", "<span>この色すごく可愛い！どこで買えますか</span>")),
  xparent(xcomment("6f10000000000000000c0007", "5f10000000000000000a0008", "合成号己", EMOJI + EMOJI)),
  xparent(xcomment("6f10000000000000000c0008", "5f10000000000000000a0009", "合成号庚", "<span>@合成好友阿星 快看这个</span>")),
  xparent(xcomment("6f10000000000000000c0009", "5f10000000000000000a0010", "合成号辛", "<span>原评论已删除</span>"),
          [xcomment("6f10000000000000000c0019", "5f10000000000000000a0013", "合成号壬", "<span>楼上说得对</span>", sub=True)]),
  xparent(xcomment("6f10000000000000000c000a", "5f10000000000000000a0011", "合成号癸", "<span>原评论已删除</span>")),
  xparent(xcomment("6f10000000000000000c000b", "5f10000000000000000a0012", "合成号子", "<span>原评论已删除</span>")),
])
def xnote(nid=XNID):
    return (f'<div id="noteContainer" class="note-container"><div class="media-container"></div><div class="interaction-container">'
            f'<div class="author-container"><div class="author-wrapper"><div class="info"><div class="avatar-click"><div class="avatar-container">'
            f'<a href="/user/profile/{XUID}?channel_type=web_explore_feed&amp;xsec_source=pc_user"><img class="avatar-item" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a></div></div>'
            f'<a href="/user/profile/{XUID}?channel_type=explore_feed&amp;xsec_source=pc_user" class="name" target="_blank"><span class="username">合成作者小蓝</span></a></div>'
            f'<div class="note-detail-follow-btn"><button class="reds-button-new follow-button"><span class="reds-button-new-text">关注</span></button></div></div></div>'
            f'<div class="note-scroller"><div class="note-content"><h1 id="detail-title" class="title">Autumn outfit ideas for rainy days</h1>'
            f'<div id="detail-desc" class="desc"><span class="note-text"><span>Three looks I wear every week when it rains. Warm, simple and easy to copy.</span>{EMOJI}'
            f'<a id="hash-tag" target="_blank" class="tag" href="/search_result?keyword=ootd&amp;type=54">#ootd</a></span></div>'
            f'<div class="bottom-container"><span class="date">10-12 上海</span></div></div><div class="divider"></div>'
            f'<div class="comments-el"><div class="comments-container"><div class="total">共 9 条评论</div><div class="list-container">{X_COMMENTS}</div>'
            f'<div class="end-container">- THE END -</div></div></div></div></div></div>')
def xcard(nid, title, author="合成号"):
    return (f'<section class="note-item"><div><a href="/explore/{nid}" style="display:none"></a><a class="cover mask ld" href="/explore/{nid}?xsec_token=FAKE&amp;xsec_source=pc_feed"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a>'
            f'<div class="footer"><a class="title" href="/explore/{nid}?xsec_token=FAKE&amp;xsec_source=pc_feed"><span>{title}</span></a>'
            f'<div class="author-wrapper"><a class="author" href="/user/profile/{XUID}"><span class="name">{author}</span></a><span class="like-wrapper"><span class="count">8</span></span></div></div></div></section>')
X_FEED = ('<div class="main-container"><div class="with-side-bar main-content"><div id="mfContainer" class="feeds-page"><div class="feeds-container">'
          + xcard(XNID, "Autumn outfit ideas for rainy days") + xcard("6f00000000000000000a0002", "秋天的第一杯奶茶") + xcard("6f00000000000000000a0003", "Weekend hiking trip in the hills")
          + "</div></div></div></div>")
X_MODAL_JS = ("const NOTE = " + _json.dumps(xnote()) + ";\n"
  "const KEEP = location.search.slice(1); // 留着 ?jev=…（替身 Jev 读它）\n"
  "window.__openNote = () => { const m = document.createElement('div'); m.className = 'note-detail-mask'; m.innerHTML = NOTE; document.getElementById('global').append(m); history.pushState({}, '', '/explore/" + XNID + "?xsec_token=FAKE&xsec_source=pc_feed' + (KEEP ? '&' + KEEP : '')); };\n"
  "window.__closeNote = () => { document.querySelector('.note-detail-mask')?.remove(); history.pushState({}, '', '/explore' + (KEEP ? '?' + KEEP : '')); };")
xhs_note = xpage("Autumn outfit ideas for rainy days - 小红书", f"/explore/{XNID}?xsec_token=FAKE&xsec_source=pc_feed", f'<div class="note-detail-mask undertake-ssr">{xnote()}</div>')
xhs_explore = xpage("小红书 - 你的生活兴趣社区", "/explore", X_FEED, X_MODAL_JS)
xhs_search = xpage("outfit - 小红书搜索", "/search_result?keyword=outfit&source=web_explore_feed", X_FEED.replace("feeds-page", "feeds-page search-layout"))
# xhs/note_img.html（看图片，0.18）：m1 有字有配图、m2 只有配图（.content 里一个空的 note-text）、m3 只有字；配图是 xhscdn 的 http 网址（测试里拦下来）
def xpic(cid, uid, name, text, src):
    return xcomment(cid, uid, name, f"<span>{text}</span>" if text else "", pic=False).replace('<div class="info">',
        f'<div class="comment-picture"><div class="comment-image-gallery"><div class="img-box"><img class="inner" src="{src}"></div></div></div><div class="info">', 1)
X_IMG_COMMENTS = "".join([
  xparent(xpic("6f20000000000000000c0001", "5f20000000000000000a0001", "合成配图甲", "好看", "http://sns-webpic-qc.xhscdn.com/fake/m1")),
  xparent(xpic("6f20000000000000000c0002", "5f20000000000000000a0002", "合成配图乙", "", "http://sns-webpic-qc.xhscdn.com/fake/m2")),
  xparent(xcomment("6f20000000000000000c0003", "5f20000000000000000a0003", "合成配图丙", "<span>同款求链接</span>")),
])
xhs_note_img = xhs_note.replace(X_COMMENTS, X_IMG_COMMENTS).replace(XNID, "6f00000000000000000a0009")
os.makedirs(os.path.join(HERE, "fakex", "xhs"), exist_ok=True)
for name, html in [("note", xhs_note), ("explore", xhs_explore), ("search", xhs_search), ("note_img", xhs_note_img)]:
    open(os.path.join(HERE, "fakex", "xhs", name + ".html"), "w", encoding="utf-8").write(html)
print("fakex pages →", OUT, "+ fakex/spa.html + fakex/translate.html + fakex/thread.html + fakex/translate_en.html + fakex/translate_net.html")
