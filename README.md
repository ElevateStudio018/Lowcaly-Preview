# Lowcaly – 3D preview

Ombyggnad av [lowcaly.com/sv](https://www.lowcaly.com/sv/) med en scrollstyrd 3D-produktberättelse:
förpackningarna snurrar in en i taget när man scrollar, omgivna av flytande, fysiskt renderade frukter
som man kan hovra över och dra lite i.

## Kör lokalt

Ingen byggsteg behövs – det är statisk HTML + ES-moduler (Three.js och Lenis laddas från jsDelivr).

```bash
python3 -m http.server 8000
# öppna http://localhost:8000
```

- `?still` stänger av scroll-easing (för skärmdumpar).
- `dev/fruit-lab.html` visar alla procedurella frukter sida vid sida för att finjustera material.

## Struktur

| Fil | Innehåll |
| --- | --- |
| `index.html` | Sidans markup (texter från lowcaly.com/sv) |
| `css/style.css` | Brand tokens (färger/typografi från lowcaly.com) och layout |
| `js/data.js` | Produktdata: beskrivningar, näringsvärden, ingredienser |
| `js/carton.js` | 3D-förpackning byggd av de riktiga förpackningsbilderna + genererad bak-/sidopanel |
| `js/fruits.js` | Procedurella frukter (körsbär, jordgubbe, hallon, blåbär, päron, persika, mango, blad) |
| `js/scene.js` | Three.js-scen, scrollanimation, hover/drag-fysik |
| `js/sugar.js` | Sockerkalkylatorn: glasburk i 3D som fylls med sockerbitar |
| `js/main.js` | Overlay-texter, färgövergångar, meny, filter, reveal-animationer |

## Hero-video

`assets/video/` innehåller Lowcalys egen hero-film (hämtad från deras Cloudflare Stream, max 720p desktop / 1080p mobil),
uppskalad till 4K med Topaz via Higgsfield och omkodad till H.264 för webben:

- `hero-4k.mp4` – 3840×2160, visas på stora/retina-skärmar
- `hero-1080.mp4` – 1920×1080, övriga datorer
- `hero-mobile.mp4` – 1440×2560 stående, mobil

Postern (`assets/img/hero.webp`) är första bildrutan, så videon tonar in utan hopp.

## Typsnitt

Originalsajten använder de licensierade typsnitten **Heron Sans Cond** och **Kepler Std**. De ligger inte i
repot; sidan använder dem om de finns installerade, annars Google Fonts-ersättarna Barlow Condensed och Crimson Pro.
