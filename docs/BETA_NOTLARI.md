# Woontegra Optik Desktop — Beta Notları

## Sürüm bilgisi

- **Ürün:** Woontegra Optik Desktop  
- **Sürüm:** 1.0.0  
- **Durum:** Beta / saha test sürümü  

Bu sürüm üretim ortamında kesintisiz kullanım için değil; gerçek optik işletme ortamında test ve geri bildirim toplamak amacıyla dağıtılır.

## Önemli kapsam sınırları

### Medula / SGK

- Program **gerçek Medula API bağlantısı yapmaz**.
- Reçete hazırlık, eksik alan kontrolü, Excel dışa aktarım ve durum takibi içindir.
- SGK fatura batch kayıtları hazırlık ve raporlama amaçlıdır.

### ÜTS / TİTUBB

- Program **otomatik ÜTS bildirimi göndermez**.
- Alma/verme/iade hazırlık listeleri, Excel export ve “ÜTS'de işlendi” işaretleme içindir.

### E-Dönüşüm

- Program **resmi e-fatura / e-arşiv / e-irsaliye gönderimi yapmaz**.
- Fatura/irsaliye taslakları, Excel/XML/HTML çıktı ve entegratörünüze manuel aktarım için hazırlanır.
- Ekranda bu sınırlama açıkça belirtilir.

## Donanım testi

Aşağıdaki cihazlar **gerçek ortamda** mutlaka test edilmelidir:

| Cihaz | Not |
|-------|-----|
| USB barkod okuyucu | Satış, mal kabul, sayım ekranları |
| 2D karekod okuyucu | ÜTS/UBB alanları varsa |
| Etiket yazıcı | Stok ve mal kabul etiketleri |
| Termal fiş yazıcı | Satış/tahsilat fişleri (varsa) |

Simüle ortamda sadece klavye ile barkod girişi test edilmiş olabilir; saha testinde okuyucu davranışı farklı olabilir.

## Hata bildirimi

Hata bulunduğunda lütfen şunları kaydedin:

1. **Ekran görüntüsü** (tam pencere mümkünse)  
2. **Yapılan işlem sırası** (hangi menü, hangi buton, hangi veriler)  
3. **Kullanıcı rolü** (Yönetici, Satış Personeli vb.)  
4. **Tarih/saat**  
5. Mümkünse `logs` klasöründeki ilgili log satırları (Yedekleme / Ayarlar üzerinden logs klasörü açılabilir)

## Bilinen sınırlamalar (beta)

- Uygulama ikonu: `build/icon.ico` projeye eklenene kadar installer varsayılan Electron ikonu kullanabilir.
- Kod imzalama yapılmamışsa Windows SmartScreen uyarısı görülebilir.
- Çok büyük stok listelerinde (5.000+ ürün) performans saha testinde doğrulanmalıdır.

## Veri güvenliği

- Düzenli yedek alın (`Yönetim → Yedekleme`).
- Geri yükleme öncesi programın oluşturduğu güvenlik yedeğini silmeyin.
- Test veritabanı ile canlı veritabanını karıştırmayın.

## İletişim

Beta geri bildirimleri için test sorumlusuna yukarıdaki formatta rapor iletin.
