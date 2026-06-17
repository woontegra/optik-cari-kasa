# Woontegra Optik Desktop — Kullanım Kılavuzu Notları

Bu dosya PDF kılavuzu hazırlamak için kaynak notlardır. Son kullanıcıya doğrudan verilmez.

**Genel:** Tutarlar ekranda `1.000,00 ₺` formatında gösterilir. Medula, ÜTS ve E-Dönüşüm modülleri resmi sistem entegrasyonu değildir; hazırlık, takip ve dışa aktarım içindir.

---

## 0. Dashboard ve renk sistemi

**Nereden:** Giriş sonrası ana sayfa (`/`).

**Yapı:**
1. **Hızlı İşlemler** — üst bant; modül rengine göre renkli kısayollar (Satış, Stok, Finans, Resmi İşlemler).
2. **Günlük İşler** — bugünkü satış, tahsilat, kasa, kritik stok, Medula bekleyen, net kâr özeti + günlük detay kartları.
3. **Finans Durumu** — vadesi geçen alacak/borç, POS bekleyen, gider özeti (yetkiye göre).
4. **Stok / Ürün Uyarıları** — kritik stok, pasif ürün, son hareket vb.
5. **Resmi İşlem Uyarıları** — Medula, ÜTS, E-Dönüşüm taslak sayıları (varsayılan kapalı bölüm).
6. **Müşteri Hatırlatmaları** — randevu ve kontrol hatırlatmaları (varsayılan kapalı).

**Renk kodları:**
| Modül | Renk | Kullanım |
|-------|------|----------|
| Satış / Müşteri | Mavi | Satış, müşteri, randevu kartları |
| Ürün / Stok | Yeşil | Stok, mal kabul, sayım uyarıları |
| Finans | Turuncu | Kasa, banka, gider, kâr kartları |
| Resmi İşlemler | Mor | Medula, ÜTS, E-Dönüşüm |
| Kritik / eksik / hata | Kırmızı | Sıfırdan büyük kritik uyarılar |
| Rapor / yönetim | Gri-lacivert | Rapor ve yönetim kısayolları |

**Davranış:** Sıfır değerli uyarılar nötr (gri) görünür; değer olan kritik uyarılar renkle vurgulanır. Bölümler açılıp kapatılabilir; tercih `localStorage`’da saklanır.

**Sol menü:** Dashboard tek satır; diğer gruplar varsayılan kapalı. Grup aç/kapat `woontegra_sidebar_collapsed` anahtarıyla saklanır. Aktif sayfa sol kenarda modül rengiyle vurgulanır.

---

## 1. İlk giriş / lisans

**Nereden:** Uygulama ilk açılışında lisans ekranı, ardından giriş ekranı.

**Adımlar:**
1. Demo lisans anahtarı ile aktivasyon yapın (veya satın alınan anahtarı girin).
2. Giriş: kullanıcı `admin`, şifre `admin123` (ilk kurulum).
3. Üst bantta şifre değiştirme uyarısı çıkarsa **Şifre Değiştir** ile yeni şifre belirleyin.

**Sonuç:** Dashboard açılır; sol menü yetkiye göre görünür.

**Dikkat:** İlk girişten sonra admin şifresini mutlaka değiştirin. Veritabanı `%AppData%\Woontegra Optik Desktop\` altında oluşur.

---

## 2. Stok kartı oluşturma

**Nereden:** Sol menü → Ürün / Stok → Stok Kartları (`/stok`).

**Adımlar:**
1. **Yeni Ürün** ile formu açın.
2. Ürün tipi seçin (Çerçeve / Cam / Lens / Aksesuar vb.); tipine göre alanlar değişir.
3. Barkod, fiyat, KDV, raf yeri girin; Optik Tanımlar’dan marka/model bağlayın.
4. **Kaydet**.

**Sonuç:** Ürün stok listesinde görünür; barkodlu satış ve mal kabulde kullanılabilir.

**Dikkat:** ÜTS takibi gereken ürünlerde UBB/seri alanlarını doldurun. Pasif ürün satışta listelenmez.

---

## 3. Optik Tanımlar

**Nereden:** Ürün / Stok → Optik Tanımlar.

**Adımlar:** Ana grup, alt grup, marka, model, renk, cam tipi vb. kayıtları ekleyin/düzenleyin.

**Sonuç:** Stok kartı ve rapor filtrelerinde kullanılır.

---

## 4. Barkodlu satış

**Nereden:** Satış / Müşteri → Barkodlu Satış (`/satis`).

**Adımlar:**
1. Müşteri seçin (isteğe bağlı; perakende boş bırakılabilir).
2. Barkod okutun veya yazın; ürün listeye eklenir.
3. Kampanya otomatik uygulanabilir; yetkili kullanıcı manuel indirim girebilir.
4. Ödeme türü: Nakit, POS, Havale, Açık Hesap veya parçalı ödeme.
5. **Satışı Tamamla**.

**Sonuç:** Stok düşer, kasa/cari/POS hareketi oluşur, satış fişi yazdırılabilir.

**Dikkat:** Açık hesap seçildiğinde müşteri carisine borç yazılır. SGK reçeteli satışta hasta/kurum payı alanlarını kontrol edin.

---

## 5. Mal kabul

**Nereden:** Ürün / Stok → Mal Kabul (`/stok-giris`).

**Adımlar:**
1. Tedarikçi ve belge bilgilerini girin.
2. Barkod okutarak satır ekleyin; bilinmeyen barkodda hızlı ürün tanımı açılır.
3. **Girişi Tamamla**.

**Sonuç:** Stok artar; batch kaydı oluşur; fiş/etiket yazdırılabilir.

**Dikkat:** Aynı mal için hem mal kabul hem alış faturası açılırsa stok iki kez artmaması için alış belgesini mal kabulden türetin.

---

## 6. Envanter / sayım

**Nereden:** Ürün / Stok → Envanter / Sayım.

**Adımlar:**
1. **Sayım Başlat** ile oturum açın.
2. Barkod okutun; sayılan adet artar.
3. **Sayımı Tamamla** (stok değişmez, fark raporu oluşur).
4. Onay sonrası **Farkları Stoğa İşle**.

**Sonuç:** Stoklar sayım farkına göre güncellenir.

**Dikkat:** Aynı sayım ikinci kez stoğa işlenemez.

---

## 7. Müşteri oluşturma

**Nereden:** Satış / Müşteri → Müşteri / Hasta.

**Adımlar:**
1. **Yeni Müşteri**; Genel, İletişim, Fatura Bilgileri sekmelerini doldurun.
2. Fotoğraf ekle/kaldır isteğe bağlı.
3. **Kaydet**.

**Sonuç:** Satış, reçete, randevu ve cari işlemlerinde seçilebilir.

---

## 8. Reçete girme

**Nereden:** Satış / Müşteri → Reçete Kayıtları.

**Adımlar:**
1. Müşteri seçin, reçete tipi (Özel / SGK) belirleyin.
2. SGK için kurum, provizyon, doktor bilgilerini girin.
3. Cam değerleri ve notları kaydedin.

**Sonuç:** Satışta reçeteye bağlanabilir; Medula hazırlık listesine düşer.

**Dikkat:** Medula ekranı gerçek Medula gönderimi yapmaz; Excel hazırlık ve durum takibidir.

---

## 9. Randevu oluşturma

**Nereden:** Satış / Müşteri → Randevular.

**Adımlar:**
1. Müşteri, tarih, saat ve randevu tipi girin.
2. Durum: Planlandı, Tamamlandı, İptal vb.

**Sonuç:** Takvim/liste görünümünde izlenir; müşteri kartında sonraki kontrol bilgisi güncellenebilir.

---

## 10. Tedarikçi alış belgesi

**Nereden:** Finans → Tedarikçiler → Alış sekmesi.

**Adımlar:**
1. Tedarikçi seçin; belge türü (fatura/irsaliye), tarih, kalemler.
2. Mal kabul batch’inden oluşturma seçeneği ile çift stok artışını önleyin.
3. İlk ödeme varsa girin; **Kaydet**.

**Sonuç:** Tedarikçi cari borç oluşur; ödeme takibi yapılır.

---

## 11. Kasa tahsilat

**Nereden:** Finans → Kasa / Tahsilat.

**Adımlar:**
1. Hareket listesini inceleyin.
2. Satış detayından veya kasadan tahsilat ekleyin.
3. Tahsilat fişi yazdırın.

**Sonuç:** Kasa bakiyesi ve müşteri cari güncellenir.

---

## 12. Banka / POS

**Nereden:** Finans → Banka / POS.

**Adımlar:**
1. Banka ve POS hesapları tanımlayın.
2. Kasadan bankaya / bankadan kasaya aktarım yapın.
3. Satışta POS seçildiğinde ilgili POS hareketi oluşur.

**Sonuç:** Banka ve POS bakiyeleri raporlarda görünür.

---

**Dikkat:** Medula V2 gerçek Medula API bağlantısı yapmaz; hazırlık, eksik alan kontrolü ve takip amaçlıdır.

---

## 12b. Finans V2

**Nereden:** Finans menü grubu.

**Modüller:**
- **Kasa / Tahsilat** — nakit hareketler, tahsilat fişi, günlük özet.
- **Banka / POS** — hesap tanımları, kasa↔banka aktarımı, POS bekleyen tutarlar.
- **Giderler** — gider türleri, personel gideri, ödeme kaynağı.
- **Tedarikçiler** — alış belgesi, ödeme, cari borç takibi.
- **Kâr-Zarar** — günlük/aylık özet, gider ve satış karşılaştırması.

**Dashboard bağlantısı:** Finans Durumu bölümündeki kartlar bu modüllere kısayol verir; vadesi geçen alacak/borç ve POS bekleyen turuncu tonla gösterilir.

---

## 13. Gider

**Nereden:** Finans → Giderler.

**Adımlar:**
1. Gider türü, tutar, ödeme kaynağı (nakit/banka) girin.
2. Personel gideri işaretlenebilir.

**Sonuç:** Kasa/banka düşer; kâr-zarar ve gider raporlarına yansır.

---

## 14. Kampanya

**Nereden:** Satış / Müşteri → Kampanyalar.

**Adımlar:**
1. Kampanya kodu, indirim tipi/oranı, tarih aralığı tanımlayın.
2. Satış ekranında kod girilince otomatik uygulanır.

**Sonuç:** Satış kalemlerinde indirim; kampanya raporunda izlenir.

---

## 15. ÜTS Operasyonları V2

**Nereden:** Resmi İşlemler → Medula / ÜTS (ÜTS sekmeleri) veya Ürün / Stok → ÜTS / UBB Takip.

**Sekmeler / işlevler:**
- **Alma / Verme / İade** listeleri — filtre, durum, parti bilgisi.
- **Excel dışa aktarım** — resmi ÜTS sürecine manuel aktarım için.
- **Durum işaretleme** — ÜTS'de işlendi / işlem dışı.
- **Operasyon geçmişi** — kim, ne zaman işaretledi.

**Adımlar:**
1. Alma/verme/iade listelerini filtreleyin.
2. Excel dışa aktarın.
3. Resmi ÜTS sisteminde işlem yaptıktan sonra **ÜTS'de İşlendi** veya **İşlem Dışı** işaretleyin.

**Sonuç:** Operasyon geçmişi ve raporlar güncellenir.

**Dikkat:** ÜTS Operasyonları V2 otomatik ÜTS bildirimi göndermez; hazırlık ve takip amaçlıdır.

---

## 16. Medula V2 / SGK hazırlık

**Nereden:** Resmi İşlemler → Medula / ÜTS.

**Sekmeler (Medula V2):**
- **Medula takip:** Reçete listesi, eksik alan uyarıları, durum filtreleri, Excel export.
- **SGK reçeteler / kurum alacağı:** Hasta-kurum payı takibi, kurum alacağı özeti.
- **SGK fatura hazırlık:** Batch oluşturma, Excel, yazdırma, batch durumları.

**Adımlar:**
1. Eksik alanları tamamlayın.
2. Excel hazırlayıp resmi süreçte kullanın.
3. İşlem sonrası durumu programda güncelleyin (işlendi / faturalandı vb.).

**Dikkat:** Gerçek Medula bağlantısı yoktur; hazırlık ve takip amaçlıdır.

---

## 17. E-Dönüşüm

**Nereden:** Resmi İşlemler → E-Dönüşüm.

**Önemli uyarı (ekranda gösterilir):** Resmi e-fatura/e-arşiv gönderimi kullanıcının kendi entegratörü üzerinden yapılır.

**Adımlar:**
1. Entegratör ayarlarını girin.
2. Satış, alış, SGK batch veya mal kabulden **taslak oluşturun**.
3. Excel / XML (taslak veri) / HTML yazdır ile çıktı alın.
4. Entegratörde gönderdikten sonra **Gönderildi İşaretle** ve resmi belge no girin (yetkili kullanıcı).

---

## 18. Raporlar

**Nereden:** Raporlar menüsü.

**Adımlar:**
1. Sekme seçin (satış, kasa, stok, cari, Medula, ÜTS, E-Dönüşüm vb.).
2. Tarih ve filtreleri ayarlayın; **Yükle**.
3. **Excel** veya **Yazdır**.

**Sonuç:** Özet kutuları ve tablo; Excel dosyası kaydedilir.

---

## 19. Yedekleme

**Nereden:** Yönetim → Yedekleme.

**Adımlar:**
1. **Yedek Al** — tarihli `.sqlite` dosyası oluşur.
2. **Geri Yükle** — önce güvenlik yedeği alınır, sonra seçilen dosya uygulanır.
3. **Veritabanı Klasörünü Aç** — AppData konumunu gösterir.
4. İsteğe bağlı: bütünlük kontrolü ve vacuum.

**Dikkat:** Geri yükleme öncesi uygulamayı kapatmanız önerilir; işlem sonrası yeniden başlatma gerekebilir.

---

## 20. Kullanıcı ve yetki

**Nereden:** Yönetim → Kullanıcılar (yönetici).

**Roller:** Yönetici, Satış Personeli, Kasa Personeli, Stok Personeli, Rapor Kullanıcısı.

**Dikkat:** Yetkisiz menü görünmez; doğrudan URL ile erişim engellenir.

---

## 21. Firma ayarları ve etiket

**Firma:** Yönetim → Firma Ayarları — unvan, vergi, adres (yazdırma ve E-Dönüşüm doğrulamasında kullanılır).

**Etiket:** Stok Kartları veya Mal Kabul sonrası etiket basma penceresi — barkod ve fiyatlı etiket önizleme/yazdırma.

---

## 22. Excel import / export

**Stok import:** Stok Kartları → Excel içe aktarım sihirbazı.

**Export:** Stok, raporlar, Medula, ÜTS, E-Dönüşüm ekranlarındaki ilgili butonlar.

**Dikkat:** Şablon sütun başlıkları programdaki alan adlarıyla uyumlu olmalıdır.
