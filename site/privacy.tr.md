# ClearFlow Gizlilik Politikası

Yürürlük tarihi: 23 Ekim 2026

ClearFlow; X, Reddit, YouTube, Xiaohongshu (RedNote) ve Hacker News'te yorum bölümlerini temizleyen ve gönderileri çeviren bir tarayıcı uzantısıdır. OhMyAI tarafından yayımlanır. Bu politika, uzantının hangi bilgileri okuduğunu, neleri kime gönderdiğini ve cihazınızda neleri sakladığını açıklar.

**Kısaca:** ClearFlow, baktığınız yorumları ve gönderileri, kendi girdiğiniz API anahtarını kullanarak seçtiğiniz ve ücretini ödediğiniz OpenRouter'a gönderir; OpenRouter bunları değerlendirme için TypeSafe'in Jev modeline, çeviri içinse bir çeviri modeline iletir. İsteğe bağlı bir TypeSafe anahtarı da eklerseniz değerlendirme istekleri doğrudan TypeSafe'e gider. Geliştiricileri olan bize hiçbir şey göndermez. Kullanım istatistiklerini yüklemez, gezinme davranışınızı izlemez ve uzaktan kod çalıştırmaz. Diğer kayıtlı veriler tarayıcınızda kalır.

## Nerede çalışır?

Uzantının betikleri yalnızca şu sitelerde çalışır: `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` ve `news.ycombinator.com`. Tarama geçmişinizi veya başka siteleri okumaz. Bu sitelerde, kendi gönderilerinizi değerlendirmemek için yalnızca kendi kullanıcı adınızı cihazınızda okur; bunu hiçbir yere göndermez.

## Ne, kime gönderilir?

### TypeSafe'in Jev modeli — yorumları değerlendirme

Spamı, hakaretleri, cinsel içeriği ve ‘güzel’ veya ‘+1’ gibi kısa yanıtları ayıklamak; X'in kendi çevirilerinin ve YouTube'un otomatik çevrilmiş altyazılarının kalitesini değerlendirmek için kullanılır. Varsayılan olarak bu istekler OpenRouter (`openrouter.ai`) üzerinden, OpenRouter anahtarınızla gönderilir ve OpenRouter bunları TypeSafe'e iletir. TypeSafe anahtarı girdiyseniz (isteğe bağlı, Ayarlar → Gelişmiş bölümünde), istekler bunun yerine doğrudan TypeSafe'e (`api.typesafe.ai`) gider. İki anahtardan hiçbirini girmediyseniz hiçbir şey gönderilmez.

- Yerel kuralların karar veremediği her yorum için yorum metni (en fazla 600 karakter), yorumcunun görünen adı ve kullanıcı adı, yorumun bağlı olduğu gönderinin metni (en fazla 400 karakter) ile gönderi yazarının görünen adı ve kullanıcı adı gönderilir. Bir istekte en fazla 10 yorum bulunur.
- X'teki profil ve arama sayfalarında ve Reddit'teki liste sayfalarında yorumlar yerine listedeki gönderiler gönderilir; gönderi metni alanına sabit, tek satırlık bir açıklama konur.
- X'in otomatik çevirdiği gönderilerde, çevirinin yeterince iyi olup olmadığını değerlendirmek için özgün metin ve X'in (Grok'un) çevirisi gönderilir. ClearFlow'un kendi yeniden çevirisi gönderilmez.
- Yalnızca TypeSafe anahtarı girdiyseniz ve ‘Yanıtlardaki görselleri kontrol et’ seçeneğini açarsanız (varsayılan olarak kapalıdır), bu yorumlara eklenmiş görseller küçültülerek metinle birlikte doğrudan TypeSafe'e gönderilir (OpenRouter görselleri iletmediğinden TypeSafe anahtarı olmadan hiçbir görsel gönderilmez). Bunun için uzantı `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` ve `*.xhscdn.com` adreslerindeki görselleri okuma izni ister; seçeneği kapattığınızda izni bırakır.
- Yalnızca o sitede bir yanıtı kendiniz spam olarak işaretlediyseniz (‘Bu yanıtı gizle’ veya bildirim çubuğundaki huni simgesi), o sitede en son işaretlediğiniz en fazla 10 yanıt, değerlendirilen yorumlarla birlikte örnek olarak gönderilir. Her örnekte en fazla 240 karakterlik metin ve hesap bilgisi bulunur. TypeSafe bunları yorumun aynı tür spam olup olmadığını anlamak için kullanır. Bir yanıtı işaretler işaretlemez, o sayfada henüz temizlenmemiş yorumlar örneklere göre bir kez daha kontrol edilir (istek başına en fazla 25 yorum).
- Yalnızca YouTube'un otomatik çevrilmiş altyazılarını seçtiğinizde, ‘Otomatik çevrilmiş altyazıları iyileştir’ açık olduğunda ve bunun yerine kullanılabilecek insan çevirisi Çince altyazı bulunmadığında, çeviri kalitesini değerlendirmek için özgün altyazının ilk satırları (en fazla 40 satır) ve YouTube'un çevirisi gönderilir.
- Aynı bağlamdaki aynı yorum için yinelenen istekleri azaltmak amacıyla değerlendirme sonuçları cihazda en fazla 7 gün önbelleğe alınır. Önbellek temizlenirse, bir kayıt silinirse veya yeniden değerlendirme gerekirse yorum tekrar gönderilebilir.

### OpenRouter (`openrouter.ai`) — çeviri ve varsayılan değerlendirme

Çeviri istekleri yalnızca bir OpenRouter anahtarı girdiyseniz ve ilgili sitede çeviri açıksa gönderilir. TypeSafe anahtarı olmadan OpenRouter, yukarıda açıklanan değerlendirme isteklerini de iletir.

- Çevrilmesi gereken ya da X'in çevirisinden daha iyi bir çeviri gerektiren gönderi ve yorumların metni gönderilir. Yazar, gönderi kimliği veya sayfadaki başka hiçbir bilgi gönderilmez.
- Yalnızca TypeSafe, YouTube'un otomatik çevrilmiş altyazılarını yetersiz bulursa (yukarıda açıklandığı gibi), yeniden çevirmek için videonun izlediğiniz bölümündeki özgün altyazılar bir seferde yaklaşık 40 satır halinde gönderilir. Geleneksel Çince altyazıların Basitleştirilmiş Çinceye dönüştürülmesi bilgisayarınızda yapılır ve hiçbir şey gönderilmez.
- OpenRouter, metni Ayarlar'da seçtiğiniz çeviri modeline iletir. Varsayılan olarak bir OpenAI modeli, yedek olarak bir DeepSeek modeli kullanılır. Bu sağlayıcıların her birinin kendi veri politikası vardır.

### Başka kimseye gönderilmez

ClearFlow, yukarıdaki iki hizmet dışında OhMyAI'a veya başka hiç kimseye hiçbir şey göndermez. Kullanım ve maliyet istatistikleri cihazınızda kalır. Analiz veya çökme raporlaması, reklam ya da izleme kodu yoktur. Tüm kod uzantı paketinin içindedir; daha sonra indirilip çalıştırılan bir kod yoktur.

Ayarlar'da ‘Bağlantıyı test et’e tıkladığınızda, test edilen hizmete kısa ve sabit bir örnek metin gönderilir.

## Cihazınızda neler saklanır?

Aşağıdaki veriler, tarayıcınızın uzantı depolama alanında (`chrome.storage.local` ve IndexedDB) saklanır. API anahtarları ilgili hizmetlere yapılan istekleri doğrulamak için kullanılır; işaretlediğiniz spam, yukarıda açıklandığı gibi TypeSafe'e örnek olarak gönderilebilir. Saklanan diğer veriler yüklenmez.

- Ayarlarınız ve API anahtarlarınız (OpenRouter'ın ve eklediyseniz TypeSafe'in). Anahtarlar bu tarayıcıdaki, yalnızca uzantıya ait veritabanında tutulur. Ziyaret ettiğiniz siteler ve uzantının bu sitelerde çalışan betikleri anahtarları okuyamaz; yalnızca uzantının arka plan işlemi kullanır. Anahtarlar şifrelenmez.
- Günlük sayaçlar (temizlenen veya çevrilen öğe sayısı ve tahmini maliyet).
- Yaptığınız düzeltmeler (‘spam değil’, ‘bu yanıtı gizle’) ve işaretlediğiniz spam, yorum metniyle birlikte saklanır (metin en fazla 300 karakter; son 3.000 düzeltme ve son 500 işaretlenmiş yanıt).
- TypeSafe sonuçlarının önbelleği (yalnızca parmak izi ve puan, metin içermez; değerlendirmeden 7 gün sonra silinir) ve çeviri önbelleği (çevrilmiş metin; 30 gün kullanılmazsa silinir). Her önbelleğin varsayılan üst sınırı 50 MB'tır; dolduğunda önce en eski kayıtlar silinir.

X ve YouTube'da iki küçük betik (`pagedata.js`, `ytdata.js`) sayfa içinde çalışarak sitenin, sayfanın zaten almış olduğu API yanıtlarını okur. Böylece gönderinin özgün (çevrilmemiş) metni ve yorumu kimin yazdığı belirlenir. Bu betikler yalnızca okur; istek göndermez veya sitenin aldığı bilgileri değiştirmez.

## Seçenekleriniz

- Açılır pencereden veya Ayarlar'dan ClearFlow'u herhangi bir sitede tamamen kapatabilir ya da yorum temizliğini ve çeviriyi ayrı ayrı kapatabilirsiniz.
- Ayarlar → Veri ve gizlilik bölümünden verilerinizi (ayarlar, istatistikler, düzeltmeleriniz ve işaretlediğiniz spam) dışa aktarabilir, önbellekleri temizleyebilir veya düzeltmeleriniz dahil istatistikleri ve kayıtları silebilirsiniz. İşaretlediğiniz spam, Ayarlar'da listelenir; kayıtları tek tek veya topluca silebilirsiniz.
- Uzantıyı kaldırmak, sakladığı her şeyi siler.
- API anahtarlarınızı TypeSafe veya OpenRouter üzerinden istediğiniz zaman iptal edebilir ya da yenileyebilirsiniz.

## Çocuklar

ClearFlow çocuklara yönelik değildir ve hiç kimseden bilerek bilgi toplamaz.

## Değişiklikler

Bu politika değişirse yeni sürüm, yeni yürürlük tarihiyle https://github.com/remember2015/clearflow/blob/main/PRIVACY.md adresinde yayımlanır ve değişiklik günlüğünde belirtilir.

## İletişim

developer@ohmyai.app
