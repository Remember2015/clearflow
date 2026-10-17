// 看图片（0.18，设置里"看回复里的图片"，默认关）：后台把回复里的图下载下来，缩成 Jev 收的样子，转 base64 交给 jev.js。
// Jev 的要求（docs.typesafe.ai/go/images，2026-10-15）：只收 PNG / JPEG；每边 256–1568 像素、总像素至少 78,400（256×256 实测被拒），
// 超出的直接拒、不帮你缩；不转 EXIF 方向；按输入 token 计费，大约 370 像素一个 token。所以这里：
// - 长边缩到 768（一张大约 1–2 千 token；二维码、图里的字还认得出）；
// - 太小的放大到每边至少 256、总像素至少 78,400；太扁太长、放大后长边超过 1568 的，长边定在 1568、短边补白；
// - createImageBitmap 默认按 EXIF 转正；WebP、GIF（取第一帧）都先解开再存成 JPEG（基线编码）。
// 读图要用户给的权限（settings.js 的 IMAGE_ORIGINS）；没权限、下载失败、解不开都返回 null，这张图就不发，这一条照样按字判。
// 同一个网址在这个 service worker 里只处理一次（成功的记着，失败的下次再试）。
export const MAX_SIDE = 768, MIN_SIDE = 256, MAX_EDGE = 1568, MIN_AREA = 78400, MAX_BYTES = 16 * 1048576;

// 原图 w×h → 画布 cw×ch（Jev 收的尺寸）、图画在 (dx, dy) 的 dw×dh
export function fitSize(w, h) {
  let dw = w * Math.min(1, MAX_SIDE / Math.max(w, h)), dh = h * Math.min(1, MAX_SIDE / Math.max(w, h));
  const up = Math.max(1, MIN_SIDE / Math.min(dw, dh), Math.sqrt(MIN_AREA / (dw * dh)));
  if (up > 1) {
    if (Math.max(dw, dh) * up <= MAX_EDGE) { dw *= up; dh *= up; } else { const k = MAX_EDGE / Math.max(dw, dh); dw *= k; dh *= k; }
    dw = Math.ceil(dw); dh = Math.ceil(dh);
  } else { dw = Math.round(dw); dh = Math.round(dh); }
  dw = Math.min(MAX_EDGE, Math.max(1, dw)); dh = Math.min(MAX_EDGE, Math.max(1, dh));
  let cw = Math.max(dw, MIN_SIDE), ch = Math.max(dh, MIN_SIDE);
  if (cw * ch < MIN_AREA) { if (cw <= ch) cw = Math.min(MAX_EDGE, Math.ceil(MIN_AREA / ch)); else ch = Math.min(MAX_EDGE, Math.ceil(MIN_AREA / cw)); }
  return { cw, ch, dw, dh, dx: Math.floor((cw - dw) / 2), dy: Math.floor((ch - dh) / 2) };
}

export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const memo = new Map(); // 网址 → Promise<{format, data_base64, width, height} | null>
export function imageAsset(url, { fetchImpl = fetch, signal } = {}) {
  if (memo.has(url)) return memo.get(url);
  const job = (async () => {
    try {
      const resp = await fetchImpl(url, { credentials: "omit", signal });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (!blob.size || blob.size > MAX_BYTES) return null;
      const bmp = await createImageBitmap(blob);
      const f = fitSize(bmp.width, bmp.height);
      const canvas = new OffscreenCanvas(f.cw, f.ch);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, f.cw, f.ch);
      ctx.drawImage(bmp, f.dx, f.dy, f.dw, f.dh);
      bmp.close?.();
      const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
      return { format: "jpg", data_base64: toBase64(new Uint8Array(await out.arrayBuffer())), width: f.cw, height: f.ch };
    } catch (e) {
      return null;
    }
  })();
  memo.set(url, job);
  if (memo.size > 300) memo.delete(memo.keys().next().value);
  job.then((x) => { if (!x && memo.get(url) === job) memo.delete(url); });
  return job;
}
export const forgetImages = () => memo.clear(); // 测试用

// 网址能不能读：http(s)、在 IMAGE_ORIGINS 里（"*://*.xhscdn.com/*" 这种匹配模式）
export function allowedImage(url, origins) {
  let u;
  try { u = new URL(url); } catch (e) { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  return origins.some((pat) => {
    const m = pat.match(/^(\*|https?):\/\/(\*\.)?([^/]+)\/\*$/);
    if (!m) return false;
    if (m[1] !== "*" && m[1] + ":" !== u.protocol) return false;
    return m[2] ? u.hostname === m[3] || u.hostname.endsWith("." + m[3]) : u.hostname === m[3];
  });
}
