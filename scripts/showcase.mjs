// Showcase pages for the Chrome Web Store screenshots (used by scripts/store-assets.mjs). Each page copies the markup the extension
// reads on one site (same structure as the test pages in extension/test/build_fakex.py) and loads the extension from the test bundle,
// with a stand-in Jev (scores given per snippet, `?jev=`) and stand-in translations (`window.__ffTxFn`). Every post, name and comment
// here is invented. `pages(locale)` returns [{ key, path, html, width }] for one of LOCALES.
// 每个语言的那套：X 上是那个语言自己的帖子（看清理）；Reddit、YouTube 上挑的都是对那个语言来说是外文的评论（看翻译），
// 每条原文配好译成五种界面语言的译文；第 4 张（0.26 起，以前是小红书 / Hacker News）标一条、同类都清理。

export const LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const AV = ["#f4b183", "#9dc3e6", "#c5e0b4", "#ffd966", "#d5a6bd", "#b4a7d6", "#a9d18e", "#f8cbad", "#9fc5e8", "#ffe599", "#c9daf8", "#ead1dc"];
// 中日韩的字用对字形：日文用日文字体、繁中用繁中字体（都列在 sans-serif 前面，没装就退回系统的）
const FONT = { en: '"PingFang SC"', "zh-CN": '"PingFang SC"', "zh-TW": '"PingFang TC"', ja: '"Hiragino Sans","Hiragino Kaku Gothic ProN"', ko: '"Apple SD Gothic Neo"' };
export const fontOf = (loc) => FONT[loc] || FONT.en;

// language of a text (the stand-in for chrome.i18n.detectLanguage): by script, then by a few common words
const DETECT = `window.__ffDetect = (t) => {
  const L = (l) => ({ isReliable: true, languages: [{ language: l, percentage: 97 }] });
  if (/[\\u0400-\\u04ff]/.test(t)) return L("ru"); if (/[\\u0e00-\\u0e7f]/.test(t)) return L("th"); if (/[\\u0600-\\u06ff]/.test(t)) return L("ar");
  if (/[\\u3040-\\u30ff]/.test(t)) return L("ja"); if (/[\\uac00-\\ud7af]/.test(t)) return L("ko"); if (/[\\u0900-\\u097f]/.test(t)) return L("hi");
  if (/[\\u4e00-\\u9fff]/.test(t)) return L("zh");
  if (/[¿¡ñ]|\\b(qué|quiero|puede|integral|envidia)\\b/i.test(t)) return L("es");
  if (/\\b(fiz|ficou|minha|salvei|aventura)\\b/i.test(t)) return L("pt");
  if (/\\b(wie|bist|und|der|das|Wetter)\\b/.test(t)) return L("de");
  if (/\\b(récit|dormi|sauvage)\\b/i.test(t)) return L("fr");
  return /^[\\x00-\\x7f\\u2019\\u2014–—]+$/.test(t) && t.length > 3 ? L("en") : { isReliable: false, languages: [] };
};`;
// stand-in translations: whole text, or each innermost <pN>/<tN> piece when the extension sends formatted text
const txScript = (dict) => `window.__ffTx = ${JSON.stringify(dict)};
window.__ffTxFn = (m) => {
  const D = window.__ffTx, key = (s) => s.replace(/\\s+/g, " ").trim();
  const one = (s) => D[key(s)];
  let text;
  if (m.markup) { let miss = false; text = m.source.replace(/>([^<]+)</g, (all, s) => { if (!s.trim()) return all; const x = one(s); if (x == null) miss = true; return ">" + (x ?? s) + "<"; }); if (miss) text = null; }
  else text = one(m.source) ?? null;
  if (text == null) { console.warn("no translation for", m.source); return null; }
  return { action: "fill", text, model: "openai/gpt-6-luna", cost: 0, cached: false };
};`;
const route = (path, jev) => `history.replaceState({}, "", ${JSON.stringify(path)} + (${JSON.stringify(path)}.includes("?") ? "&" : "?") + "jev=" + encodeURIComponent(${JSON.stringify(JSON.stringify(jev))}));`;
const shell = (lang, title, css, body, setup, bundle) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${css}</style></head><body>${body}<script>${DETECT}\n${setup}\nconst sc = document.createElement("script"); sc.src = "/${bundle}"; document.body.appendChild(sc);</script></body></html>`;
// [原文, {界面语言: 译文}] → 这个语言的替身译文表（没写这个语言的译文，就是原文本来就是这个语言）
const dictOf = (loc, items) => Object.fromEntries(items.map(([src, tx]) => [src, tx[loc] ?? src]));

// ---------- the words of each locale's fake site chrome ----------
const UI = {
  en: { ago: (n) => `${n}h`, min: (n) => `${n}m`, reply: "Reply", share: "Share", views: "41K views · 2 days ago", comments: (n) => `${n} comments`, follow: "Follow", total: (n) => `${n} comments` },
  "zh-CN": { ago: (n) => `${n} 小时前`, min: (n) => `${n} 分钟`, reply: "回复", share: "分享", views: "4.1 万次观看 · 2 天前", comments: (n) => `${n} 条评论`, follow: "关注", total: (n) => `共 ${n} 条评论` },
  "zh-TW": { ago: (n) => `${n} 小時前`, min: (n) => `${n} 分鐘`, reply: "回覆", share: "分享", views: "觀看次數：4.1 萬次 · 2 天前", comments: (n) => `${n} 則留言`, follow: "追蹤", total: (n) => `共 ${n} 則留言` },
  ja: { ago: (n) => `${n}時間前`, min: (n) => `${n}分`, reply: "返信", share: "共有", views: "4.1万 回視聴 · 2 日前", comments: (n) => `コメント ${n} 件`, follow: "フォロー", total: (n) => `コメント ${n} 件` },
  ko: { ago: (n) => `${n}시간 전`, min: (n) => `${n}분`, reply: "답글", share: "공유", views: "조회수 4.1만회 · 2일 전", comments: (n) => `댓글 ${n}개`, follow: "팔로우", total: (n) => `댓글 ${n}개` },
};

// ---------- X: cleaning (reasons, a merged run, "nice" / "+1" replies), in each locale's own language ----------
// names：第一条"赞"、刷同一句的三个、第二三条"赞"、@ 陌生账号的、第四条"赞"、骂人的
const XC = {
  en: {
    post: ["Lena Kovac", "@lena_restores", "Finally finished restoring my grandfather’s 1962 road bike. Eight months, mostly waiting for parts from three different countries. Happy to answer questions!"],
    a: ["Tomás R.", "@tomas_rides_92", "That paint is perfect. Did you strip it down to bare metal first, or sand over the original?"],
    spam: "Made $8,400 last week with an amazing trading mentor, everything is explained in my bio, go check it",
    spamVar: ["Made $8,400 last week with a brilliant trading mentor, everything is explained in my bio, go check it", "Made $8,400 last week with an amazing trading mentor, everything is explained in my bio, check it now"],
    fill: ["nice", "+1", "🔥🔥🔥", "following"],
    b: ["Hiro", "@hiro_cycles", "What did you use on the handlebar chrome? Mine pitted badly after one winter."],
    m1: "@quickcash_365 look at this 😍",
    c: ["Ruth Okafor", "@ruth_okafor", "My dad rode the same model to work for twenty years. Seeing it shine again made my day."],
    abuse: "Nobody cares about your junk bike, you absolute clown.",
    d: ["Ines", "@ines_builds", "Where did you find the original decals? I’ve been looking for those for months."],
    names: ["Aki", "Jordan Wu", "Priya", "Marco D", "Sam", "Dana", "Alex", "bikefan", "Kev"],
  },
  "zh-CN": {
    post: ["林小满", "@xiaoman_rides", "终于把爷爷那辆 1962 年的老自行车修好了。花了八个月，大部分时间在等从三个国家寄来的零件。有问题欢迎问！"],
    a: ["阿哲", "@azhe_ride92", "这漆面太完美了。是磨到见金属重新喷的，还是在原漆上打磨？"],
    spam: "上周跟着一位交易导师赚了八千四，方法全写在我主页简介里，快去看看",
    spamVar: ["上周跟着一位交易导师赚了八千四，方法全写在我主页简介里，赶紧去看", "上周跟着一位很厉害的交易导师赚了八千四，方法全写在我主页简介里，快去看看"],
    fill: ["赞", "+1", "mark", "已关注"],
    b: ["小宇", "@xiaoyu_cycles", "车把上的镀铬你用什么处理的？我的那辆一个冬天就起锈斑了。"],
    m1: "@quickcash_888 看这个😍",
    c: ["周阿姨", "@zhou_ayi_ride", "我爸也骑过同款，骑了二十年去上班。看到它重新亮起来，心情一下子好了。"],
    abuse: "谁在乎你这堆破铜烂铁，蠢货一个。",
    d: ["Ines", "@ines_builds", "原厂贴花在哪儿找到的？我找了好几个月了。"],
    names: ["小凯", "王总说", "财富自由", "马克", "阿森", "丹丹", "阿亮", "路人甲", "老K"],
  },
  "zh-TW": {
    post: ["林小滿", "@xiaoman_rides", "終於把爺爺那台 1962 年的老單車修好了。花了八個月，大部分時間都在等從三個國家寄來的零件。有問題歡迎問！"],
    a: ["阿哲", "@azhe_ride92", "這烤漆太完美了。是磨到見金屬重新噴的，還是在原漆上打磨？"],
    spam: "上週跟著一位交易導師賺了八千四，方法全寫在我主頁簡介裡，快去看看",
    spamVar: ["上週跟著一位交易導師賺了八千四，方法全寫在我主頁簡介裡，趕快去看", "上週跟著一位很厲害的交易導師賺了八千四，方法全寫在我主頁簡介裡，快去看看"],
    fill: ["讚", "+1", "推", "已追蹤"],
    b: ["小宇", "@xiaoyu_cycles", "車把上的電鍍你用什麼保養？我那台一個冬天就生鏽了。"],
    m1: "@quickcash_888 看這個😍",
    c: ["周阿姨", "@zhou_ayi_ride", "我爸也騎過同款，騎了二十年去上班。看到它重新亮起來，心情一下子變好了。"],
    abuse: "誰在乎你這堆破銅爛鐵，蠢貨一個。",
    d: ["Ines", "@ines_builds", "原廠貼紙在哪裡找到的？我找了好幾個月了。"],
    names: ["小凱", "王總說", "財富自由", "馬克", "阿森", "丹丹", "阿亮", "路人甲", "老K"],
  },
  ja: {
    post: ["佐藤みなみ", "@minami_rides", "祖父の1962年製ロードバイクのレストアがやっと終わりました。8か月かかって、ほとんどは3か国から届く部品待ちでした。質問あればどうぞ！"],
    a: ["タケル", "@takeru_ride92", "この塗装、完璧ですね。一度地金まで剥がしたんですか？それとも元の塗装の上から研いだんですか？"],
    spam: "先週トレードの師匠のおかげで84万円稼げました。やり方は全部プロフに書いてあるので見てください",
    spamVar: ["先週トレードの師匠のおかげで84万円稼げました。やり方は全部プロフに書いてあるので見てみて", "先週すごいトレードの師匠のおかげで84万円稼げました。やり方は全部プロフに書いてあるので見てください"],
    fill: ["草", "それな", "👍👍", "フォローしました"],
    b: ["ヒロ", "@hiro_cycles", "ハンドルのメッキは何で手入れしましたか？自分のはひと冬で錆が出ちゃいました。"],
    m1: "@quickcash_888 これ見て😍",
    c: ["山田", "@yamada_ride", "父も同じモデルで20年通勤してました。また輝いているのを見て、なんだか嬉しくなりました。"],
    abuse: "お前のガラクタ自転車なんて誰も興味ねえよ、バカじゃねえの。",
    d: ["Ines", "@ines_builds", "オリジナルのデカールはどこで見つけたんですか？何か月も探してるんです。"],
    names: ["アキ", "FX王", "自由人", "マルコ", "サトシ", "ダナ", "アキラ", "通りすがり", "ケン"],
  },
  ko: {
    post: ["김하늘", "@haneul_rides", "할아버지가 타시던 1962년식 로드바이크 복원을 드디어 끝냈어요. 8개월 걸렸는데, 대부분은 세 나라에서 오는 부품을 기다리는 시간이었어요. 궁금한 거 있으면 물어보세요!"],
    a: ["민준", "@minjun_ride92", "도색이 완벽하네요. 금속까지 다 벗겨내고 다시 칠한 건가요, 아니면 원래 도장 위에 샌딩한 건가요?"],
    spam: "지난주에 트레이딩 멘토 덕분에 840만 원 벌었어요. 방법은 제 프로필에 다 적어놨으니 꼭 보세요",
    spamVar: ["지난주에 트레이딩 멘토 덕분에 840만 원 벌었어요. 방법은 제 프로필에 다 적어놨으니 확인해 보세요", "지난주에 대단한 트레이딩 멘토 덕분에 840만 원 벌었어요. 방법은 제 프로필에 다 적어놨으니 꼭 보세요"],
    fill: ["ㅋㅋㅋ", "+1", "👍👍", "팔로우했어요"],
    b: ["지호", "@jiho_cycles", "핸들 크롬은 뭘로 관리하셨어요? 제 건 겨울 한 번 지나고 녹이 슬었어요."],
    m1: "@quickcash_888 이거 봐요😍",
    c: ["박선영", "@park_ride", "저희 아버지도 같은 모델로 20년 동안 출퇴근하셨어요. 다시 반짝이는 걸 보니 괜히 기분이 좋네요."],
    abuse: "네 고물 자전거 아무도 관심 없어, 진짜 한심하다.",
    d: ["Ines", "@ines_builds", "순정 데칼은 어디서 구하셨어요? 몇 달째 찾고 있거든요."],
    names: ["아키", "조던", "경제적자유", "마르코", "샘", "다나", "알렉스", "지나가던사람", "케브"],
  },
};
function xPage(loc) {
  const u = UI[loc], C = XC[loc], N = C.names;
  let n = 0;
  const art = (name, handle, text, mins) => {
    const id = 9100 + n, av = AV[n++ % AV.length];
    return `<div data-testid="cellInnerDiv"><div><article data-testid="tweet" style="--av:${av}">
  <div data-testid="User-Name">${esc(name)}\n${handle}</div>
  <a href="/${handle.slice(1)}/status/${id}"><time datetime="2026-10-10T00:00:00.000Z">${u.min(mins)}</time></a>
  <div data-testid="tweetText">${esc(text)}</div>
  <button data-testid="caret" aria-label="More" type="button">…</button></article></div></div>`;
  };
  const posts = [
    art(...C.post, 95), art(...C.a, 80), art(N[0], "@aki_k2017", C.fill[0], 78),
    art(N[1], "@jwu_fx_77", C.spamVar[0], 77), art(N[2], "@priya_trades", C.spam, 76), art(N[3], "@marco_d_wins", C.spamVar[1], 75),
    art(N[4], "@samuel_b_44", C.fill[1], 74), art(...C.b, 70), art(N[5], "@dana_k_5513", C.fill[2], 66),
    art(N[6], "@alex_m_3390", C.m1, 64), art(...C.c, 60), art(N[7], "@bikefan_8812", C.fill[3], 58),
    art(N[8], "@kev_rants_01", C.abuse, 55), art(...C.d, 50),
  ];
  const jev = Object.fromEntries([...C.fill.map((f) => [f, { filler: 0.94 }]), [C.abuse.slice(0, 12), { abuse: 0.93 }]]);
  const css = `body{font:15px/1.45 -apple-system,"Segoe UI",Roboto,${fontOf(loc)},sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#0f1419;-webkit-font-smoothing:antialiased}
main{border-inline:1px solid #eff3f4;min-height:100vh} article{position:relative;padding:12px 16px 12px 68px;border-bottom:1px solid #eff3f4;display:flow-root}
article::before{content:"";position:absolute;left:16px;top:14px;width:40px;height:40px;border-radius:50%;background:var(--av)}
[data-testid=User-Name]{white-space:pre;font-weight:700;line-height:1.25} time{color:#536471;font-size:13px} a{text-decoration:none}
[data-testid=tweetText]{margin-top:4px} [data-testid=caret]{display:none} main > div:first-child article{padding-top:18px} main > div:first-child [data-testid=tweetText]{font-size:17px}`;
  return { key: "x", width: 600, path: `/sc/${loc}/x`, html: shell(loc, "X", css, `<main>${posts.join("")}</main>`, route(`/${C.post[1].slice(1)}/status/9100`, jev), "inject_bundle.js") };
}

// ---------- Reddit: a Hokkaido trip post, comments in languages foreign to the locale, translated in place ----------
const RT = {
  ja_title: ["自転車で北海道を一周しました（10日間・テント泊）", { en: "I cycled around Hokkaido (10 days, camping)", "zh-CN": "骑自行车环游了北海道（10 天·露营）", "zh-TW": "騎單車環島北海道（10 天・露營）", ko: "자전거로 홋카이도 일주했어요 (10일, 캠핑)" }],
  ja_body: ["テントと寝袋だけで1,200km走りました。海沿いの道が最高でした。質問があれば何でもどうぞ！", { en: "I rode 1,200 km with just a tent and a sleeping bag. The coastal roads were the best part. Ask me anything!", "zh-CN": "只带了帐篷和睡袋，骑了 1200 公里。海边的路最棒。有问题尽管问！", "zh-TW": "只帶了帳篷和睡袋，騎了 1200 公里。海邊的路最棒。有問題儘管問！", ko: "텐트랑 침낭만 챙겨서 1,200km를 달렸어요. 해안 도로가 최고였어요. 궁금한 거 뭐든 물어보세요!" }],
  ja_reply: ["8月の後半です。毎日だいたい120kmくらい走りました。", { en: "Late August. I rode about 120 km a day.", "zh-CN": "八月下旬。每天大概骑 120 公里。", "zh-TW": "八月下旬。每天大概騎 120 公里。", ko: "8월 말이요. 하루에 120km 정도 달렸어요." }],
  en_title: ["I cycled around Hokkaido (10 days, camping)", { ja: "自転車で北海道を一周しました（10日間・テント泊）", ko: "자전거로 홋카이도 일주했어요 (10일, 캠핑)" }],
  en_body: ["I rode 1,200 km with just a tent and a sleeping bag. The coastal roads were the best part. Ask me anything!", { ja: "テントと寝袋だけで1,200km走りました。海沿いの道が最高でした。何でも聞いてください！", ko: "텐트랑 침낭만 챙겨서 1,200km를 달렸어요. 해안 도로가 최고였어요. 궁금한 거 뭐든 물어보세요!" }],
  en_reply: ["Late August. I rode about 120 km a day.", { ja: "8月の後半です。毎日120kmくらい走りました。", ko: "8월 말이요. 하루에 120km 정도 달렸어요." }],
  de: ["Wie viele Kilometer bist du am Tag gefahren? Und wie war das Wetter?", { en: "How many kilometres did you ride per day? And how was the weather?", "zh-CN": "你每天骑多少公里？天气怎么样？", "zh-TW": "你每天騎多少公里？天氣怎麼樣？", ja: "1日に何キロ走りましたか？天気はどうでしたか？", ko: "하루에 몇 킬로미터씩 달리셨어요? 날씨는 어땠어요?" }],
  es: ["¡Qué envidia! ¿En qué mes fuiste? Quiero hacerlo el año que viene.", { en: "So jealous! Which month did you go? I want to do it next year.", "zh-CN": "太羡慕了！你是几月去的？我明年也想去。", "zh-TW": "太羨慕了！你是幾月去的？我明年也想去。", ja: "うらやましい！何月に行きましたか？来年やってみたいです。", ko: "너무 부러워요! 몇 월에 가셨어요? 내년에 저도 해보고 싶어요." }],
  photos_ko: ["사진 더 올려주세요! 해안 도로 풍경이 정말 멋지네요.", { en: "Please post more photos! The coastal road looks amazing.", "zh-CN": "请多发点照片！海边公路的风景太美了。", "zh-TW": "請多發點照片！海邊公路的風景太美了。", ja: "写真をもっと載せてください！海沿いの道の景色、本当に素敵ですね。" }],
  photos_zh: ["请多发点照片！海边公路的风景太美了。", { en: "Please post more photos! The coastal road looks amazing." }],
  photos_ja: ["写真をもっと載せてください！海沿いの道の景色、本当に素敵ですね。", { ko: "사진 더 올려주세요! 해안 도로 풍경이 정말 멋지네요." }],
  fr: ["Super récit. Tu as dormi dans des campings ou en camping sauvage ?", { en: "Great write-up. Did you sleep at campsites or wild camp?", "zh-CN": "写得真好。你是住营地还是野营？", "zh-TW": "寫得真好。你是住營地還是野營？", ja: "すばらしい旅行記ですね。キャンプ場に泊まりましたか、それとも野営ですか？", ko: "글 정말 잘 쓰셨네요. 캠핑장에서 주무셨어요, 아니면 야영하셨어요?" }],
  pt: ["Que aventura! Salvei para planejar a minha.", { en: "What an adventure! Saved it to plan my own.", "zh-CN": "好一场冒险！收藏了，打算照着规划我自己的。", "zh-TW": "好一場冒險！收藏了，打算照著規劃我自己的。", ja: "すごい冒険ですね！自分の旅の計画用に保存しました。", ko: "대단한 모험이네요! 제 여행 계획하려고 저장했어요." }],
  spam: ["Cheap flights to Japan from $99!! DM me, link in my profile", { "zh-CN": "日本特价机票 99 美元起！！私信我，链接在我主页", "zh-TW": "日本特價機票 99 美元起！！私訊我，連結在我主頁", ja: "日本行き格安航空券が99ドルから！！DMください、リンクはプロフに", ko: "일본행 특가 항공권 99달러부터!! DM 주세요, 링크는 프로필에" }],
  nice: ["nice", { "zh-CN": "不错", "zh-TW": "不錯", ja: "いいね", ko: "좋네요" }],
};
const RAUTH = { de: "kurt_on_wheels", es: "lucia_viaja", photos_ko: "minjun_rides", photos_zh: "xiaolin_rides", photos_ja: "kenji_trails", fr: "camille_bikes", pt: "rafa_trilhas" };
function redditPage(loc) {
  const u = UI[loc], post = loc === "ja" || loc === "ko" ? "en" : "ja"; // 日文、韩文那套帖子是英文的，别的是日文的
  const photos = loc === "en" ? "photos_zh" : loc === "ko" ? "photos_ja" : "photos_ko";
  const dict = dictOf(loc, [`${post}_title`, `${post}_body`, `${post}_reply`, "de", "es", photos, "fr", "pt", "spam", "nice"].map((k) => RT[k]));
  const OP = post === "ja" ? "yuki_pedals" : "liam_pedals";
  let n = 0;
  const com = (id, author, text, depth = 0, kids = "", op = false) => {
    const av = AV[n++ % AV.length];
    return `<shreddit-comment thingid="t1_${id}" author="${author}" depth="${depth}" created="2026-10-10T00:00:00+0000" postid="t3_sc1" is-translatable=""${op ? ' is-op=""' : ""}>`
      + `<details open><summary><div slot="commentMeta"><span class="av" style="background:${av}"></span><a href="/user/${author}/">${author}</a>${op ? ' <span class="op">OP</span>' : ""} · ${u.ago(2)}</div></summary>`
      + `<div class="rgrid"><div class="min-w-0"><div slot="comment" id="t1_${id}-comment-rtjson-content" class="md"><div dir="auto"><p>${esc(text)}</p></div></div></div>`
      + `<div class="min-w-0"><div slot="actionRow"><span>▲ 42 ▼</span><button>${u.reply}</button><button>${u.share}</button></div></div><div id="t1_${id}-children">${kids}</div></div></details></shreddit-comment>`;
  };
  const reply = com("a2", OP, RT[`${post}_reply`][0], 1, "", true);
  const tree = [
    com("a1", RAUTH.de, RT.de[0], 0, reply),
    com("b1", RAUTH.es, RT.es[0]),
    com("c1", "cheap_trips_4u", RT.spam[0]),
    com("d1", RAUTH[photos], RT[photos][0]),
    com("e1", "quiet_reader_71", RT.nice[0]),
    com("f1", RAUTH.fr, RT.fr[0]),
    com("g1", RAUTH.pt, RT.pt[0]),
  ].join("");
  const title = RT[`${post}_title`][0], body = RT[`${post}_body`][0];
  const postEl = `<shreddit-post id="t3_sc1" author="${OP}" post-title="${esc(title)}" post-language="${post}" is-translatable="">`
    + `<div slot="credit-bar"><span class="sub">r/bicycletouring</span> · u/${OP} · ${u.ago(5)}</div>`
    + `<h1 slot="title" id="post-title-t3_sc1" dir="auto">${esc(title)}</h1>`
    + `<shreddit-post-text-body slot="text-body" post-id="t3_sc1"><div slot="text-body"><div class="mb-xs" data-post-click-location="text-body"><div class="md" id="t3_sc1-post-rtjson-content"><p>${esc(body)}</p></div></div></div></shreddit-post-text-body>`
    + `<div class="photo"></div></shreddit-post>`;
  const shadow = `const def = (name, slots) => customElements.define(name, class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block}</style>" + slots.map((s) => '<div><slot name="' + s + '"></slot></div>').join(""); } });
def("shreddit-post", ["full-post-link", "credit-bar", "title", "post-flair", "text-body"]); def("shreddit-post-text-body", ["text-body"]);`;
  const jev = { "Cheap flights to Japan": { benefit: 0.94 }, nice: { filler: 0.95 } };
  const css = `body{font:14px/1.5 -apple-system,"Segoe UI",Roboto,${fontOf(loc)},sans-serif;margin:0;background:#fff;color:#1a1a1b;-webkit-font-smoothing:antialiased}
.wrap{max-width:740px;margin:0 auto;padding:20px 24px} shreddit-post{display:block;padding:4px 0 16px;border-bottom:1px solid #edeff1;margin-bottom:8px}
[slot=credit-bar]{font-size:12px;color:#576f76;margin-bottom:6px} .sub{font-weight:700;color:#1a1a1b} h1[slot=title]{font-size:22px;line-height:1.3;margin:6px 0 8px}
.md p{margin:4px 0} .photo{height:150px;border-radius:12px;margin-top:10px;background:linear-gradient(135deg,#7db9e8,#a3d9a5 55%,#f3e2a9)}
shreddit-comment{display:block;margin:12px 0} details{padding-left:4px} summary{list-style:none} [slot=commentMeta]{font-size:12px;color:#576f76;display:flex;align-items:center;gap:6px}
[slot=commentMeta] a{color:#1a1a1b;font-weight:600;text-decoration:none} .av{width:22px;height:22px;border-radius:50%;display:inline-block} .op{color:#0079d3;font-weight:700}
.rgrid{padding-left:28px} [slot=actionRow]{display:flex;gap:14px;font-size:12px;color:#576f76;margin-top:2px} [slot=actionRow] button{border:0;background:none;color:#576f76;font:inherit;padding:0}
[id$=-children]{border-left:2px solid #edeff1;margin-left:-17px;padding-left:15px}`;
  return { key: "reddit", width: 740, path: `/sc/${loc}/reddit`,
    html: shell(loc, "r/bicycletouring", css, `<shreddit-app><div class="wrap">${postEl}<shreddit-comment-tree post-id="t3_sc1">${tree}</shreddit-comment-tree></div></shreddit-app>`,
      `${shadow}\n${txScript(dict)}\n${route("/r/bicycletouring/comments/sc1/hokkaido/", jev)}`, "inject_reddit.js") };
}

// ---------- YouTube: a Korean cooking video, comments in languages foreign to the locale, a scam thread cleaned ----------
const YT = {
  title: ["10분 만에 만드는 김치볶음밥 (자취생 레시피)", { en: "Kimchi fried rice in 10 minutes (easy recipe for one)", "zh-CN": "10 分钟做好泡菜炒饭（一个人也能做）", "zh-TW": "10 分鐘做好泡菜炒飯（一個人也能做）", ja: "10分で作るキムチチャーハン（一人暮らしレシピ）" }],
  pt: ["Fiz hoje e ficou perfeito, minha família amou!", { en: "Made it today and it came out perfect, my family loved it!", "zh-CN": "今天做了，效果完美，家里人都很喜欢！", "zh-TW": "今天做了，效果完美，家人都很喜歡！", ja: "今日作ってみたら完璧にできました。家族も大喜びです！", ko: "오늘 만들어 봤는데 완벽했어요. 가족들이 정말 좋아했어요!" }],
  hi: ["बहुत बढ़िया रेसिपी! क्या चावल एक दिन पुराना होना चाहिए?", { en: "Great recipe! Does the rice need to be a day old?", "zh-CN": "很棒的食谱！米饭需要是隔夜的吗？", "zh-TW": "很棒的食譜！米飯需要是隔夜的嗎？", ja: "最高のレシピ！ご飯は一日置いたものがいいですか？", ko: "정말 좋은 레시피예요! 밥은 하루 지난 걸 써야 하나요?" }],
  owner: ["네, 하루 지난 밥이 훨씬 고슬고슬해요!", { en: "Yes — day-old rice comes out much fluffier!", "zh-CN": "对，隔夜饭炒出来粒粒分明得多！", "zh-TW": "對，隔夜飯炒起來粒粒分明多了！", ja: "はい、一日置いたご飯のほうがずっとパラパラになります！" }],
  scam: ["I was struggling until I found Mr. Daniel Ross, made $6,200 in two weeks. He’s on Telegram, look him up", { "zh-CN": "以前日子很难，直到遇到 Daniel Ross 先生，两周赚了 6200 美元。他在 Telegram 上，搜他名字就行", "zh-TW": "以前日子很難，直到遇到 Daniel Ross 先生，兩週賺了 6200 美元。他在 Telegram 上，搜他名字就行", ja: "苦しかった時にDaniel Rossさんに出会って、2週間で6,200ドル稼げました。Telegramにいるので検索してみて", ko: "힘들 때 Daniel Ross 님을 만나서 2주 만에 6,200달러를 벌었어요. 텔레그램에 계시니 검색해 보세요" }],
  scam2: ["He changed my life too, best mentor ever!", { "zh-CN": "他也改变了我的人生，最好的导师！", "zh-TW": "他也改變了我的人生，最好的導師！", ja: "私の人生も変えてくれました。最高のメンターです！", ko: "제 인생도 바꿔주셨어요. 최고의 멘토예요!" }],
  es: ["¿Se puede usar arroz integral?", { en: "Can you use brown rice?", "zh-CN": "可以用糙米吗？", "zh-TW": "可以用糙米嗎？", ja: "玄米でも作れますか？", ko: "현미로도 만들 수 있나요?" }],
  ar: ["هل يمكن استخدام الأرز البني؟", { en: "Can you use brown rice?" }],
  ja: ["ごま油を最後に入れるのがポイントですね。", { en: "Adding the sesame oil at the end is the trick, isn’t it?", "zh-CN": "最后再放香油是关键吧。", "zh-TW": "最後再放香油是關鍵吧。", ko: "마지막에 참기름을 넣는 게 포인트군요." }],
  en: ["Adding the sesame oil at the end is the trick, isn't it?", { ja: "最後にごま油を入れるのがポイントなんですね。" }],
};
const YAUTH = { pt: "@ana.cozinha", hi: "@priya_cooks", es: "@marta_en_casa", ar: "@layla_cooks", ja: "@kenji_eats", en: "@mike_cooks_at_home" };
function ytPage(loc) {
  const u = UI[loc], VID = "SHOWVIDEO01"; // YouTube 的视频 id 是 11 位
  const brown = loc === "en" ? "ar" : "es", oil = loc === "ja" ? "en" : "ja";
  const dict = dictOf(loc, ["title", "pt", "hi", "owner", "scam", "scam2", brown, oil].map((k) => YT[k]));
  let n = 0;
  const yc = (cid, handle, text) => {
    const av = AV[n++ % AV.length];
    return `<ytd-comment-view-model id="comment"><div id="body"><span class="yav" style="background:${av}"></span><div id="main">`
      + `<div id="header"><div id="header-author"><h3><a id="author-text" href="/${handle}"><span>${handle}</span></a></h3><span id="author-comment-badge"></span>`
      + `<span dir="auto" id="published-time-text"><a href="/watch?v=${VID}&amp;lc=${cid}">${u.ago(3)}</a></span></div></div>`
      + `<ytd-expander id="expander"><div id="content"><yt-attributed-string slot="content" id="content-text"><span class="ytAttributedStringHost" dir="auto" role="text">${esc(text)}</span></yt-attributed-string></div></ytd-expander>`
      + `<ytd-comment-engagement-bar id="action-buttons"><div id="toolbar">👍 128 · ${u.reply}</div></ytd-comment-engagement-bar><div id="action-menu"></div></div></div></ytd-comment-view-model>`;
  };
  const thread = (cid, handle, text, replies = []) => `<ytd-comment-thread-renderer>${yc(cid, handle, text)}<div id="replies">${replies.length
    ? `<ytd-comment-replies-renderer><div id="expander"><div id="expander-contents"><div id="contents">${replies.map((r) => yc(...r)).join("")}</div></div></div></ytd-comment-replies-renderer>` : ""}</div></ytd-comment-thread-renderer>`;
  const comments = [
    thread("Ugs01", YAUTH.pt, YT.pt[0]),
    thread("Ugs02", YAUTH.hi, YT.hi[0], [["Ugs02.R1", "@SoraKitchen", YT.owner[0]]]),
    thread("Ugs03", "@richlife_2026", YT.scam[0], [["Ugs03.R1", "@grateful_mom88", YT.scam2[0]]]),
    thread("Ugs04", "@firstcomment", "🔥🔥🔥"),
    thread("Ugs05", YAUTH[brown], YT[brown][0]),
    thread("Ugs06", YAUTH[oil], YT[oil][0]),
  ].join("");
  const jev = { "Mr. Daniel Ross": { setup: 0.93, benefit: 0.55 }, "best mentor ever": { setup: 0.88 }, "🔥🔥🔥": { filler: 0.95 } };
  const css = `body{font:14px/20px Roboto,Arial,${fontOf(loc)},sans-serif;margin:0;background:#fff;color:#0f0f0f;-webkit-font-smoothing:antialiased}
#primary{max-width:820px;margin:0 auto;padding:16px 24px} .player{height:150px;border-radius:12px;background:linear-gradient(135deg,#3a1c1c,#c0392b 60%,#f5b041);margin-bottom:12px}
ytd-watch-metadata h1{font-size:20px;line-height:28px;font-weight:700;margin:0 0 8px} #owner{display:flex;align-items:center;gap:10px;margin-bottom:16px}
#owner .cav{width:36px;height:36px;border-radius:50%;background:#e67e22} #channel-name a{color:#0f0f0f;font-weight:600;text-decoration:none} #owner .subs{font-size:12px;color:#606060}
.chead{font-size:18px;font-weight:700;margin:8px 0 12px} ytd-comment-thread-renderer{display:block;margin:0 0 14px} ytd-comment-view-model{display:block}
#body{display:flex;gap:14px} .yav{flex:none;width:36px;height:36px;border-radius:50%;display:inline-block} #main{flex:1;min-width:0}
#header-author{display:flex;gap:6px;font-size:13px;align-items:baseline} #header-author h3{margin:0;font-size:13px;font-weight:600} #header-author a{color:#0f0f0f;text-decoration:none}
#published-time-text a{color:#606060} ytd-expander{display:block;margin-top:2px} #action-buttons{display:block;font-size:12px;color:#606060;margin-top:4px}
ytd-comment-replies-renderer{display:block;margin:10px 0 0 50px} ytd-comment-replies-renderer .yav{width:24px;height:24px}`;
  const body = `<ytd-app><div id="content"><div id="primary"><div class="player"></div><ytd-watch-metadata><div id="title"><h1><yt-formatted-string>${esc(YT.title[0])}</yt-formatted-string></h1></div>
<div id="owner"><span class="cav"></span><ytd-video-owner-renderer><div id="channel-name"><a href="/@SoraKitchen">Sora Kitchen</a></div><div class="subs">${u.views}</div></ytd-video-owner-renderer></div></ytd-watch-metadata>
<div class="chead">${u.comments(312)}</div><ytd-comments id="comments"><ytd-item-section-renderer id="sections"><div id="contents">${comments}</div></ytd-item-section-renderer></ytd-comments></div></div></ytd-app>`;
  const setup = `window.ytInitialPlayerResponse = { videoDetails: { videoId: "${VID}", channelId: "UCsorakitchen0000000000", author: "Sora Kitchen" } };\n${txScript(dict)}\n${route(`/watch?v=${VID}`, jev)}`;
  return { key: "yt", width: 820, path: `/sc/${loc}/yt`, html: shell(loc, "YouTube", css, body, setup, "inject_yt.js") };
}

// ---------- 标一条、同类都清理（0.26）：Reddit 帖子，评论用这个语言写；三条换了说法的同一套"交易老师"骗局，Jev 五问都没过线（替身给低分），
// 标了第一条以后另外两条按"和你标记过的垃圾是同一类"清理（替身的 markedCheck 按 ?jev= 里的 marked 给分）。截图前 store-assets.mjs 点第一条的漏斗 ----------
const MK = {
  en: { title: "How I paid off $23k of credit card debt in two years", body: "No windfalls, just a budget I actually stuck to and the avalanche method. Happy to share the spreadsheet.",
    n1: "The avalanche method is so underrated. Did you ever consider a balance transfer card?",
    a: "I was stuck in debt too until a trading mentor showed me his system. Made $9k last month. Message me and I'll send you his contact.",
    n2: "Congrats! What was the hardest month and how did you get through it?",
    b: "Same here, his trading system changed everything for me. Cleared my loans in 4 months — DM me for the mentor's details.",
    n3: "Would love the spreadsheet if you're still sharing it.",
    c: "Debt-free thanks to the trading coach someone here told me about. Best decision ever, ask me how." },
  "zh-CN": { title: "两年还清 15 万信用卡债，我是怎么做的", body: "没有意外之财，就是一份真的坚持下来的预算，加上先还利率最高的那张。表格可以分享。",
    n1: "先还高利率这个方法真的被低估了。你考虑过转卡分期吗？",
    a: "我以前也欠了一屁股债，后来跟着一位交易老师学了他的方法，上个月赚了六万多。私信我，我把老师联系方式发你。",
    n2: "恭喜！最难熬的是哪个月？怎么撑过来的？",
    b: "一样，老师那套交易方法真的改变了我，四个月就把贷款清了，想要老师联系方式的私信我。",
    n3: "表格还能分享吗？想要一份。",
    c: "多亏这里有人推荐的那位交易导师，我现在一身轻松，最正确的决定，想知道怎么做的问我。" },
  "zh-TW": { title: "兩年還清 50 萬卡債，我是怎麼做到的", body: "沒有意外之財，就是一份真的有堅持下來的預算，加上先還利率最高的那張。表格可以分享。",
    n1: "先還高利率這招真的被低估了。你有考慮過餘額代償嗎？",
    a: "我以前也欠了一屁股債，後來跟著一位交易老師學他的方法，上個月賺了二十幾萬。私訊我，我把老師的聯絡方式給你。",
    n2: "恭喜！最難熬的是哪個月？怎麼撐過來的？",
    b: "一樣，老師那套交易方法真的改變了我，四個月就把貸款還清了，想要老師聯絡方式的私訊我。",
    n3: "表格還能分享嗎？想要一份。",
    c: "多虧這裡有人推薦的那位交易導師，我現在無債一身輕，最正確的決定，想知道怎麼做的問我。" },
  ja: { title: "2年で300万円のカード借金を完済した方法", body: "臨時収入はなし。本当に続けられた予算と、金利の高い順に返す方法だけです。スプレッドシートも共有できます。",
    n1: "金利の高い順に返す方法、もっと知られていいですよね。おまとめローンは検討しましたか？",
    a: "私も借金まみれでしたが、あるトレードの先生に手法を教わって先月90万円稼げました。DMくれたら先生の連絡先を送ります。",
    n2: "おめでとうございます！一番きつかったのは何か月目で、どう乗り越えましたか？",
    b: "同じく、先生のトレード手法で人生が変わりました。4か月でローン完済。先生の連絡先が欲しい人はDMください。",
    n3: "スプレッドシート、まだ共有してもらえますか？",
    c: "ここで紹介されたトレードコーチのおかげで借金ゼロになりました。人生で一番の決断。やり方は聞いてください。" },
  ko: { title: "2년 만에 카드빚 3천만 원 갚은 방법", body: "목돈이 생긴 것도 아니고, 진짜로 지킨 예산이랑 금리 높은 것부터 갚는 방법뿐이었어요. 스프레드시트 공유할게요.",
    n1: "금리 높은 것부터 갚는 방법 진짜 저평가돼 있어요. 대환대출은 생각해 보셨어요?",
    a: "저도 빚더미였는데 한 트레이딩 선생님께 방법을 배워서 지난달 900만 원 벌었어요. DM 주시면 선생님 연락처 보내드릴게요.",
    n2: "축하해요! 제일 힘들었던 달은 언제였고 어떻게 버티셨어요?",
    b: "저도요, 선생님 트레이딩 방법 덕분에 인생이 바뀌었어요. 4개월 만에 대출 다 갚았어요. 선생님 연락처 필요하신 분 DM 주세요.",
    n3: "스프레드시트 아직 공유해 주시나요?",
    c: "여기서 누가 추천해 준 트레이딩 코치 덕분에 빚 없이 살아요. 인생 최고의 결정이에요. 방법 궁금하면 물어보세요." },
};
function markPage(loc) {
  const u = UI[loc], C = MK[loc];
  let n = 0;
  const com = (id, author, text) => {
    const av = AV[(n++ * 3) % AV.length];
    return `<shreddit-comment thingid="t1_${id}" author="${author}" depth="0" created="2026-10-10T00:00:00+0000" postid="t3_mk1">`
      + `<details open><summary><div slot="commentMeta"><span class="av" style="background:${av}"></span><a href="/user/${author}/">${author}</a> · ${u.ago(3)}</div></summary>`
      + `<div class="rgrid"><div class="min-w-0"><div slot="comment" id="t1_${id}-comment-rtjson-content" class="md"><div dir="auto"><p>${esc(text)}</p></div></div></div>`
      + `<div class="min-w-0"><div slot="actionRow"><span>▲ 18 ▼</span><button>${u.reply}</button><button>${u.share}</button></div></div><div id="t1_${id}-children"></div></div></details></shreddit-comment>`;
  };
  const tree = [com("m1", "budget_bea", C.n1), com("m2", "freedom_fx_77", C.a), com("m3", "dan_saves", C.n2), com("m4", "wealth_daily22", C.b),
    com("m5", "lin_notes", C.n3), com("m6", "blessed_mom_88", C.c)].join("");
  const post = `<shreddit-post id="t3_mk1" author="slow_and_steady" post-title="${esc(C.title)}" post-language="${loc.slice(0, 2)}">`
    + `<div slot="credit-bar"><span class="sub">r/personalfinance</span> · u/slow_and_steady · ${u.ago(6)}</div>`
    + `<h1 slot="title" id="post-title-t3_mk1" dir="auto">${esc(C.title)}</h1>`
    + `<shreddit-post-text-body slot="text-body" post-id="t3_mk1"><div slot="text-body"><div class="mb-xs"><div class="md" id="t3_mk1-post-rtjson-content"><p>${esc(C.body)}</p></div></div></div></shreddit-post-text-body></shreddit-post>`;
  const shadow = `const def = (name, slots) => customElements.define(name, class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block}</style>" + slots.map((s) => '<div><slot name="' + s + '"></slot></div>').join(""); } });
def("shreddit-post", ["full-post-link", "credit-bar", "title", "post-flair", "text-body"]); def("shreddit-post-text-body", ["text-body"]);`;
  const jev = { [C.b.slice(0, 12)]: { marked: 0.91 }, [C.c.slice(0, 12)]: { marked: 0.87 } };
  const css = `body{font:15px/1.5 -apple-system,"Segoe UI",Roboto,${fontOf(loc)},sans-serif;margin:0;background:#fff;color:#1a1a1b;-webkit-font-smoothing:antialiased}
.wrap{max-width:740px;margin:0 auto;padding:20px 24px 90px} shreddit-post{display:block;padding:4px 0 14px;border-bottom:1px solid #edeff1;margin-bottom:8px}
[slot=credit-bar]{font-size:12px;color:#576f76;margin-bottom:6px} .sub{font-weight:700;color:#1a1a1b} h1[slot=title]{font-size:22px;line-height:1.3;margin:6px 0 8px}
.md p{margin:4px 0} shreddit-comment{display:block;margin:14px 0} details{padding-left:4px} summary{list-style:none} [slot=commentMeta]{font-size:12px;color:#576f76;display:flex;align-items:center;gap:6px}
[slot=commentMeta] a{color:#1a1a1b;font-weight:600;text-decoration:none} .av{width:22px;height:22px;border-radius:50%;display:inline-block}
.rgrid{padding-left:28px} [slot=actionRow]{display:flex;gap:14px;font-size:12px;color:#576f76;margin-top:2px} [slot=actionRow] button{border:0;background:none;color:#576f76;font:inherit;padding:0}`;
  return { key: "mark", width: 740, path: `/sc/${loc}/mark`,
    html: shell(loc, "r/personalfinance", css, `<shreddit-app><div class="wrap">${post}<shreddit-comment-tree post-id="t3_mk1">${tree}</shreddit-comment-tree></div></shreddit-app>`,
      `${shadow}\n${route("/r/personalfinance/comments/mk1/debt/", jev)}`, "inject_reddit.js"), markTarget: "t1_m2", hoverAfter: "t1_m5" };
}

export function pages(locale) {
  const loc = LOCALES.includes(locale) ? locale : "en";
  return [xPage(loc), redditPage(loc), ytPage(loc), markPage(loc)];
}
