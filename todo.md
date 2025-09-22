# Radio Adamowo – PWA Hub (MVP)

Cel: Nowoczesna, responsywna strona (PWA) – hub wiedzy, muzyki i dokumentów z nawigacją boczną i sekcjami:
- Strona Główna (hero z intro z `wstep na strone.txt`, motto z `akt darowizny.txt`, CTA)
- Kronika / Oś czasu (timeline z kluczowymi datami + linki do dokumentów)
- Analizy i Raporty (analiza psychologiczna, raport analityczny, kluczowe fakty – fact-check)
- Edukacja prawna (tabelka: służebność vs dożywocie, „Akt I — Darowizna”)
- Opowieści (polana kłamstw, kronika ósmego kręgu)
- 5 faktów (TL;DR)
- Radio (HLS, playlist.json, siatka utworów)
- (opcjonalnie) Społeczność (komentarze w localStorage)

Backend: localStorage (bez auth/realtime). Dane: pliki TXT i playlist.json z public/.

Pliki (<= 8 kodowych):
1) index.html – manifest, theme-color, fonty
2) src/main.tsx – rejestracja SW
3) public/manifest.json – PWA meta
4) public/sw.js – service worker (cache-first/SWR)
5) src/pages/Index.tsx – pełny hub (UI + logika)
6) public/content/*.txt – treści (dostarczone przez użytkownika; pliki danych)
7) public/data/playlist.json – playlista audio (już skopiowana wcześniej)

Po wdrożeniu:
- pnpm i && pnpm run lint && pnpm run build
- Test w App Viewer
- Opcjonalnie: dopracować ikonę aplikacji (192/512 px) do manifest.json