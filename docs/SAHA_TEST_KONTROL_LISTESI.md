# Woontegra Optik Desktop — Saha Test Kontrol Listesi

**Sürüm:** 1.0.0 (Beta)  
**Test eden:** ______________________  
**Tarih:** ______________________  
**Makine / Windows:** ______________________

Her satır için **Geçti / Kaldı** işaretleyin ve gerekirse not yazın.

---

## Kurulum

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | `Woontegra Optik Desktop Setup 1.0.0.exe` ile kurulum | Kurulum hatasız tamamlanır | | |
| 2 | Masaüstü kısayolu | Kısayol oluşur ve program açılır | | |
| 3 | Program Ekle/Kaldır | "Woontegra Optik Desktop" görünür | | |
| 4 | İlk açılış | Lisans / giriş ekranı gelir | | |

## İlk giriş

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Demo lisans aktivasyonu | Aktivasyon başarılı | | |
| 2 | admin / admin123 giriş | Dashboard açılır | | |
| 3 | Şifre değiştirme uyarısı | Uyarı görünür, şifre değiştirilebilir | | |
| 4 | Sol menü yetkileri | Yetkisiz menüler görünmez | | |

## Firma bilgileri

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Yönetim → Firma Ayarları | Form açılır | | |
| 2 | Unvan, VKN, adres kaydet | Kayıt başarılı | | |
| 3 | Yazdırma çıktısında firma adı | Firma bilgisi görünür | | |

## Stok kartı oluşturma

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Yeni ürün (çerçeve/cam/lens) | Tipine göre alanlar gelir | | |
| 2 | Barkod ve fiyat gir, kaydet | Ürün listede görünür | | |
| 3 | Ürün düzenle / pasife al | Değişiklikler kaydedilir | | |
| 4 | Etiket basma | Önizleme / yazdırma açılır | | |

## Excel'den stok aktarımı

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Excel içe aktarım sihirbazı | Şablon yüklenir | | |
| 2 | Örnek satırları içe aktar | Ürünler oluşur veya güncellenir | | |
| 3 | Hatalı satır | Anlaşılır hata mesajı | | |

## Barkodlu satış

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Barkod okut / elle gir | Ürün listeye eklenir | | |
| 2 | Aynı barkod tekrar | Adet artar | | |
| 3 | Nakit satış tamamla | Stok düşer, kasa artar | | |
| 4 | Satış fişi yazdır | Fiş düzgün formatlanır (₺) | | |

## Barkodlu mal kabul

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Mal kabul batch başlat | Form açılır | | |
| 2 | Barkod okut | Satır eklenir | | |
| 3 | Bilinmeyen barkod | Hızlı ürün modalı açılır | | |
| 4 | Girişi tamamla | Stok artar, batch kaydı oluşur | | |

## Barkodlu sayım

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Sayım başlat | Oturum açılır | | |
| 2 | Barkod okut | Sayılan adet artar | | |
| 3 | Sayımı tamamla | Stok değişmez, fark raporu oluşur | | |
| 4 | Farkları stoğa işle | Stok güncellenir | | |
| 5 | Aynı sayımı tekrar işle | Engellenir veya uyarı verir | | |

## Müşteri oluşturma

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Yeni müşteri, fatura bilgileri sekmesi | Kayıt başarılı | | |
| 2 | Fotoğraf ekle/kaldır | Çalışır | | |
| 3 | Müşteri belgesi yazdır | Çıktı alınır | | |

## Reçete oluşturma

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Özel reçete | Kayıt oluşur | | |
| 2 | SGK reçetesi alanları | Kurum/provizyon alanları çalışır | | |
| 3 | Satışa bağlama | Reçete satışta seçilebilir | | |

## Randevu oluşturma

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Yeni randevu | Listede görünür | | |
| 2 | Durum değiştir (Tamamlandı/İptal) | Güncellenir | | |

## Kasa tahsilat

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Satıştan tahsilat ekle | Kasa ve cari güncellenir | | |
| 2 | Tahsilat fişi | Yazdırılabilir | | |

## POS ödeme

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Satışta POS hesabı seç | Satış tamamlanır | | |
| 2 | Banka/POS ekranında hareket | POS bekleyen/bakiye güncellenir | | |

## Tedarikçi / alış belgesi

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Tedarikçi oluştur | Kayıt başarılı | | |
| 2 | Alış faturası/irsaliye | Cari borç oluşur | | |
| 3 | Mal kabulden alış belgesi | Stok çift artmaz | | |
| 4 | Tedarikçi ödemesi | Kasa/banka düşer | | |

## Kampanya indirimi

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Aktif kampanya tanımla | Kampanya listede | | |
| 2 | Satışta kampanya kodu | İndirim uygulanır | | |
| 3 | Manuel indirim (yetkili kullanıcı) | İndirim uygulanır | | |

## ÜTS hazırlık

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | ÜTS alma/verme listesi | Sekmeler açılır | | |
| 2 | Excel dışa aktarım | Dosya kaydedilir | | |
| 3 | ÜTS'de işlendi işaretle | Durum güncellenir | | |
| 4 | Otomatik gönderim yok uyarısı | Resmi entegrasyon iddiası yok | | |

## Medula hazırlık

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Medula takip listesi | Reçeteler listelenir | | |
| 2 | Eksik alan uyarısı | Eksikler gösterilir | | |
| 3 | Medula Excel export | Dosya oluşur | | |
| 4 | SGK fatura batch oluştur | Batch kaydı oluşur | | |
| 5 | Kurum alacağı | Ayrı takip edilir | | |

## E-Dönüşüm taslak

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Satıştan fatura taslağı | Taslak oluşur | | |
| 2 | Excel / XML / HTML çıktı | Dosyalar kaydedilir | | |
| 3 | Resmi gönderim uyarısı ekranda | Hazırlık amaçlı not görünür | | |
| 4 | Gönderildi işaretle (yetkili) | Durum güncellenir | | |

## Raporlar

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Satış / kasa / stok raporu | Filtre + tablo | | |
| 2 | E-Dönüşüm raporu | Özet ve liste | | |
| 3 | Excel aktarım | Dosya kaydedilir | | |
| 4 | Yazdırma | Önizleme açılır | | |

## Yedekleme

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Manuel yedek al | .sqlite dosyası oluşur | | |
| 2 | Veritabanı klasörünü aç | AppData yolu açılır | | |
| 3 | Bütünlük kontrolü / vacuum | Hata vermeden çalışır | | |

## Geri yükleme

| # | Test adımı | Beklenen sonuç | Geçti / Kaldı | Not |
|---|------------|----------------|---------------|-----|
| 1 | Yedekten geri yükle | Önce güvenlik yedeği alınır | | |
| 2 | Geri yükleme sonrası veriler | Müşteri/satış/stok görünür | | |

---

## Genel değerlendirme

| Soru | Cevap |
|------|-------|
| Kritik hata var mı? | |
| Barkod okuyucu test edildi mi? | |
| Etiket yazıcı test edildi mi? | |
| Saha testine devam edilebilir mi? | |

**İmza:** ______________________
