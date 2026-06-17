# Build Assets

## Uygulama İkonu

Windows kurulumu ve uygulama penceresi için ikon dosyası:

```
build/icon.ico
```

`icon.ico` dosyasını bu klasöre koyun (önerilen: 256x256 çoklu boyutlu ICO).

`package.json` içindeki `electron-builder` yapılandırması bu dosyayı kullanır.

Dosya yoksa electron-builder varsayılan Electron ikonunu kullanır; kurulum yine oluşturulur.
