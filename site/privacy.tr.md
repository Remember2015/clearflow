# ClearFlow Gizlilik Politikası

Yürürlük tarihi: 26 Ekim 2026

ClearFlow, X, Reddit, YouTube, Xiaohongshu (RedNote) ve Hacker News’teki yorum bölümlerini düzenleyen ve gönderileri çeviren bir tarayıcı uzantısıdır. OhMyAI tarafından yayımlanır. Bu politika, uzantının neleri okuduğunu, neleri kime gönderdiğini ve cihazınızda neleri sakladığını açıklar.

**Kısaca:** ClearFlow, görüntülediğiniz yorum ve gönderileri seçtiğiniz ve ücretini ödediğiniz OpenRouter hizmetine, kendiniz girdiğiniz bir API anahtarıyla gönderir. OpenRouter bunları değerlendirmesi için TypeSafe'in Jev modeline, çevirmesi içinse bir çeviri modeline iletir. İsteğe bağlı olarak bir TypeSafe anahtarı da eklerseniz değerlendirme istekleri doğrudan TypeSafe'e gönderilir. Bu kullanımda geliştiriciler olarak bize hiçbir şey gönderilmez. Bunun yerine isteğe bağlı ve ücretli ClearFlow Üyeliği'ni seçerseniz (aşağıdaki ilgili bölüme bakın), aynı içerikler sunucumuz üzerinden işlenir; sunucumuz yalnızca o bölümde belirtilen verileri saklar. Kullanım istatistikleri yüklenmez, gezinme davranışınız izlenmez ve uzaktan kod çalıştırılmaz. Diğer kayıtlı veriler tarayıcınızda kalır.

## Nerede çalışır

Uzantının komut dosyaları yalnızca şu sitelerde çalışır: `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` ve `news.ycombinator.com`. Gezinme geçmişinizi veya başka siteleri okumaz. Bu sitelerde yalnızca kendi kullanıcı adınızı yerel olarak okur; böylece kendi gönderilerinizi değerlendirmez. Bu bilgiyi hiçbir yere göndermez.

## Neler, kime gönderilir

### TypeSafe'in Jev modeli — yorumları değerlendirme

Temizleme (spam, kötüye kullanım, cinsel içerik ve "güzel" ya da "+1" gibi yanıtlardan arındırma) için; ayrıca X'in kendi çevirilerinin ve YouTube'un otomatik çevrilmiş altyazılarının kalitesini değerlendirmek için kullanılır. Varsayılan olarak bu istekler OpenRouter (`openrouter.ai`) üzerinden, OpenRouter anahtarınızla gönderilir ve OpenRouter bunları TypeSafe'e iletir. Bir TypeSafe anahtarı girdiyseniz (isteğe bağlı, Ayarlar → Gelişmiş bölümünde), istekler doğrudan TypeSafe'e (`api.typesafe.ai`) gönderilir. Hiçbir anahtar girmediyseniz hiçbir şey gönderilmez.

- Sayfadaki yerel kuralların karar veremediği her yorum için: yorum metni (en fazla 600 karakter), yorum yapan kişinin görünen adı ve kullanıcı adı, yorumun yanıtlandığı gönderinin metni (en fazla 400 karakter) ve gönderi sahibinin adı ve kullanıcı adı. İstek başına en fazla 10 yorum gönderilir.
- X'teki profil ve arama sayfalarında, Reddit'teki liste sayfalarında yorumlar yerine listedeki gönderiler gönderilir. Gönderi metninin yerine sabit, tek satırlık bir açıklama kullanılır.
- X'in otomatik çevirdiği gönderilerde, çevirinin yeterli olup olmadığını değerlendirmek için özgün metin ve X'in (Grok'un) çevirisi gönderilir. ClearFlow'un kendi yeniden çevirisi gönderilmez.
- Yalnızca bir TypeSafe anahtarı girdiyseniz ve "Yanıtlardaki görselleri kontrol et" seçeneğini açtıysanız (varsayılan olarak kapalıdır): bu yorumlara eklenmiş görseller küçültülerek metinle birlikte doğrudan TypeSafe'e gönderilir. OpenRouter görselleri iletmediği için TypeSafe anahtarı olmadan görsel gönderilmez. Bunun için uzantı, `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` ve `*.xhscdn.com` adreslerindeki görselleri okuma izni ister; seçeneği kapattığınızda izni geri verir.
- Yalnızca ilgili sitede kendiniz spam olarak işaretlediyseniz ("Bu yanıtı gizle" seçeneğiyle veya bildirim çubuğundaki huni simgesiyle): TypeSafe'in bir yorumun aynı tür spam olup olmadığını anlaması için o sitede en son işaretlediğiniz 10 yanıt (en fazla 240 karakterlik metin ve hesap bilgisi), örnek olarak yorumlarla birlikte gönderilir. Bir yanıtı işaretledikten hemen sonra, o sayfada temizlenmemiş yorumlar örneklere göre bir kez daha kontrol edilir (istek başına en fazla 25 yorum).
- YouTube'da yalnızca YouTube'un otomatik çevrilmiş altyazılarını seçtiğinizde, "Otomatik çevrilmiş altyazıları iyileştir" seçeneği açıksa ve kullanılabilecek insan çevirisi Çince altyazı yoksa, YouTube'un çevirisinin kalitesini değerlendirmek için özgün altyazıların ilk satırları (en fazla 40 satır) ve YouTube çevirisi gönderilir.
- Aynı bağlamdaki aynı yorum için yinelenen istekleri azaltmak üzere sonuçlar yerel olarak en fazla 7 gün önbelleğe alınır. Önbellek temizlenirse, bir kayıt kaldırılırsa veya yeniden değerlendirme gerekirse yorum tekrar gönderilebilir.

### OpenRouter (`openrouter.ai`) — çeviri ve varsayılan değerlendirme

Çeviri istekleri yalnızca OpenRouter anahtarı girdiyseniz ve o site için çeviriyi açtıysanız gönderilir. TypeSafe anahtarınız yoksa yukarıda açıklanan değerlendirme istekleri de OpenRouter üzerinden iletilir.

- Çevrilmesi gereken (veya X'in çevirisinden daha iyi çevrilmesi gereken) gönderi ve yorum metinleri gönderilir. Gönderinin yazarı, gönderi kimliği veya sayfadaki başka hiçbir bilgi gönderilmez.
- YouTube'da yalnızca TypeSafe YouTube'un otomatik çevrilmiş altyazılarını yetersiz bulduğunda (yukarıya bakın), izlediğiniz bölümün özgün altyazıları yeniden çevrilmek üzere gönderilir; seferde yaklaşık 40 satır. Geleneksel Çince altyazıları Basitleştirilmiş Çinceye dönüştürme işlemi bilgisayarınızda yapılır ve hiçbir şey gönderilmez.
- OpenRouter, metni Ayarlar'da seçtiğiniz çeviri modeline iletir (varsayılan olarak bir OpenAI modeli, yedek olarak bir DeepSeek modeli kullanılır). Bu sağlayıcıların her birinin kendi veri politikası vardır.

### Başka hiç kimseye

Kendi anahtarınızı kullandığınızda ClearFlow, yukarıda belirtilen iki hizmet dışında OhMyAI'ye veya başka birine hiçbir şey göndermez (ClearFlow Üyeliği için aşağıya bakın). Kullanım ve maliyet istatistikleri cihazınızda kalır. Analiz, hata raporlama, reklam veya izleme kodu yoktur. Tüm kod uzantı paketinin içindedir; sonradan indirilip çalıştırılan bir kod yoktur.

Ayarlar'da "Bağlantıyı test et"e tıkladığınızda, test edilen hizmete sabit ve kısa bir örnek metin gönderilir.

## Cihazınızda neler saklanır

Aşağıdaki veriler tarayıcınızın uzantı depolama alanında (`chrome.storage.local` ve IndexedDB) saklanır. API anahtarları ilgili hizmetlere yapılan isteklerde kimlik doğrulamak için kullanılır. İşaretlediğiniz spam de yukarıda açıklandığı gibi örnek olarak TypeSafe'e gönderilebilir. Saklanan diğer veriler yüklenmez:

- Ayarlarınız ve API anahtarlarınız (OpenRouter anahtarı ve eklediyseniz TypeSafe anahtarı). Anahtarlar, bu tarayıcıdaki uzantının kendi veritabanında saklanır; ziyaret ettiğiniz siteler ve bu sitelerde çalışan uzantı komut dosyaları bunları okuyamaz. Yalnızca uzantının arka plan işlemi kullanabilir. Anahtarlar şifrelenmez.
- Günlük sayaçlar (temizlenen veya çevrilen öğe sayısı ve tahmini maliyet).
- Düzeltmeleriniz ("spam değil", "bu yanıtı gizle") ve işaretlediğiniz spam; yorum metniyle birlikte (en fazla 300 karakter; son 3,000 düzeltme ve son 500 işaretlenmiş yanıt).
- TypeSafe sonuçlarının önbelleği (yalnızca parmak izleri ve puanlar, metin yok; yorum değerlendirildikten 7 gün sonra silinir) ve çevirilerin önbelleği (çevrilmiş metin; 30 gün kullanılmadığında silinir). Her önbelleğin varsayılan boyut sınırı 50 MB'tır; dolduğunda en eski kayıtlar silinir.

X ve YouTube'da iki küçük komut dosyası (`pagedata.js`, `ytdata.js`) sayfanın içinde çalışır ve sayfanın zaten aldığı sitenin kendi API yanıtlarını okuyarak gönderinin özgün (çevrilmemiş) metnini ve yorumu kimin yazdığını öğrenir. Yalnızca okuma yaparlar; istek göndermez veya sitenin aldığı yanıtları değiştirmezler.

## Seçenekleriniz

- Açılır pencereden veya Ayarlar'dan ClearFlow'u herhangi bir site için kapatabilir ya da temizleme ve çeviriyi ayrı ayrı devre dışı bırakabilirsiniz.
- Ayarlar → Veri ve gizlilik: Verilerinizi dışa aktarabilir (ayarlar, istatistikler, düzeltmeleriniz ve işaretlediğiniz spam), önbellekleri temizleyebilir veya düzeltmeleriniz dâhil istatistikleri ve kayıtları silebilirsiniz. İşaretlediğiniz spam Ayarlar'da listelenir; kayıtları tek tek veya topluca silebilirsiniz.
- Uzantıyı kaldırmak, sakladığı her şeyi siler.
- TypeSafe veya OpenRouter üzerinden API anahtarlarınızı istediğiniz zaman iptal edebilir ya da yenileyebilirsiniz.

## ClearFlow Üyeliği (isteğe bağlı, ücretli)

ClearFlow Üyeliği, kendi anahtarınızı kullanmaya bir alternatiftir: e-postanızla giriş yapar, ClearFlow'un yapay zekâ özelliklerini sunucumuz üzerinden kullanırsınız. Üyelik hakkında [Hizmet Koşullarımız](https://clearflow.ohmyai.app/tr/terms/) geçerlidir. Üyeliği kullanıyorsanız, bu politikanın geri kalanına ek olarak aşağıdakiler de geçerlidir.

### İçerik nereye gider

Uzantı, "Neler, kime gönderilir" bölümünde açıklanan aynı içeriği doğrudan OpenRouter'a göndermek yerine sunucumuza, `api.clearflow.ohmyai.app` adresine gönderir (Cloudflare üzerinde çalışır). Sunucumuz içeriği aynı şekilde OpenRouter ve TypeSafe'e iletir, ardından sonuçları geri gönderir. Üyelik kullanılırken görseller kontrol edilmez.

### Sunucumuz neleri saklar

- **Hesabınız:** e-posta adresiniz, günlük sınırların gece yarınızda sıfırlanması için saat diliminiz ve ücretsiz denemenizin başlangıç tarihi.
- **Cihazlarınız:** uzantının oluşturduğu rastgele kimlik, cihazın adı (tarayıcı ve işletim sistemi), uzantı sürümü, cihazın giriş yaptığı ve en son görüldüğü zaman.
- **Giriş:** giriş kodları ve belirteçler yalnızca karma değerleriyle saklanır; süresi dolanlar her gün silinir.
- **Kullanım:** her gün için kullanım hakkınızın ne kadarını kullandığınız ve kaç istek yaptığınız. Sınırlar ve faturalandırma soruları için 13 ay saklanır.
- **Ödemeler:** ödeme işlemcimiz ve kayıtlı satıcımız Waffo'dan alınan sipariş ve ödeme kimlikleri, plan, tutar ve para birimi, tarihler ve iade durumu. Kart bilgilerinizi hiçbir zaman almayız. Waffo, ödeme bilgilerinizi kendi gizlilik politikası kapsamında saklar.
- **Paylaşılan sonuç önbelleği:** aynı işlem için iki kez ödeme yapılmasını önlemek amacıyla değerlendirmeler 7 gün, çeviriler 30 gün boyunca girdinin karmasıyla önbelleğe alınır. Değerlendirmeler yalnızca puan olarak; çeviriler ise çevrilmiş metin olarak saklanır. Önbellek kayıtları hesabınızla ilişkilendirilmez.
- **İstek ölçümleri:** her istek için hangi özelliğin kullanıldığı, planınız, maliyeti, önbellek isabetleri ve işlem süresi hesap kimliğinizle birlikte kaydedilir; maliyetleri ve hataları takip etmek için yaklaşık 3 ay saklanır.

Önbellek dışında sunucumuz işlediği yorumları, gönderileri veya altyazıları saklamaz ve bunları modelleri eğitmek için kullanmayız.

### E-postalar

Giriş kodları Cloudflare'ın e-posta hizmetiyle gönderilir. Pazarlama e-postası göndermeyiz.

### Hesabınızı silme

Hesap sayfanızdan hesabınızı silebilirsiniz. Bu işlem e-posta adresinizi, cihazlarınızı, giriş oturumlarınızı ve kullanım kayıtlarınızı siler. Muhasebe ve iadeler için e-posta adresiniz olmadan ödeme kayıtlarını, ücretsiz deneme süresinin yeniden kullanılmasını önlemek için de denemeyi kullanan cihazın kimliğini saklarız.

### Hizmet sağlayıcılar

Cloudflare (barındırma, veritabanı ve e-posta), Waffo (ödemeler), OpenRouter, TypeSafe ve çeviri modeli sağlayıcıları (içeriğin işlenmesi).

## Çocuklar

ClearFlow çocuklara yönelik değildir ve hiç kimseden bilerek bilgi toplamaz.

## Değişiklikler

Bu politikada değişiklik yapılırsa yeni sürüm, yeni bir yürürlük tarihiyle https://github.com/remember2015/clearflow/blob/main/PRIVACY.md adresinde yayımlanır ve değişiklik günlüğünde belirtilir.

## İletişim

developer@ohmyai.app
