# Piškvorky

Vzpomínka na piškvorky na Atlase.

Česká online hra na desce 19 × 19: nejméně pět symbolů v řadě, serverová pravidla a časomíra, společný chat a lokální trénink.

**Hra:** https://piskvorky-api.jan-halasz.workers.dev

## Spuštění a kontrola

Node.js 24:

```sh
npm ci
npm run check
npx wrangler deploy --dry-run --outdir build
npm test
npm run dev
```

Testy ověřují pravidla, hranice desky, Elo, přerušení spojení a chování AI. Integrační test používá skutečný runtime Workers (Miniflare): registraci a přihlášení, jednorázovou pozvánku do zavřeného stolu, dva hráče a diváka, práva, chat, výhru a okamžité smazání desky ze serveru, Elo, odvetu, hlášení a smazání účtu. Lokální test používá datum kompatibility 2026-08-06, protože přibalený workerd zatím novější datum nepodporuje; produkční Worker používá 2026-11-14.

## Architektura

- `public/`: samostatný statický web pro Cloudflare, bez sestavení. Na počítači se tah odešle ihned kliknutím. Na mobilu (dotykové ovládání bez myši) nejdříve vyberete pole a pak potvrdíte tah.
- `src/game.js`: společná pravidla. `public/game.js` je identická kopie pro prohlížeč.
- `src/worker.js`: HTTPS API. Každý stůl má vlastní SQLite Durable Object `Room`, hibernující WebSockety a alarmy. `Directory` koordinuje přehled místností, přítomnost, identity a transakční Elo.
- SQL úložiště obsahuje vždy aktuální desku, nikoli historii tahů. Při ukončení partie je deska na serveru smazána; aktuálně připojené prohlížeče si finální pozici ponechají pro zvýraznění výhry. Nový divák již ukončenou desku nezíská.
- Výsledek má jedinečné ID a je započítán jednou v transakci. Odolná schránka v místnosti opakuje neúspěšné předání výsledku; uchovává se pouze technické ID potvrzení, nikoli záznam partie.
- Čas 40 s, varování posledních 10 s, připravenost 60 s, návrat 60 s, pozvánka 120 s, nabídka remízy a odvety 30 s.
- Odpojí-li se hráč, pozastaví se pouze jeho čas na tah. Pokud je na tahu připojený soupeř, může pokračovat. Po návratu zůstane nejméně 10 s. Odpojení obou hráčů anuluje partii. Výrazně opožděný alarm (o více než 90 s) se považuje za výpadek služby a také anuluje výsledek.
- Omezení: 102 současných připojení na stůl. Celkový počet stolů omezuje jeden aktivní stůl na hráče a limit zakládání; další provozní limity lze doplnit dle skutečné návštěvnosti.

## Nasazení

### Cloudflare

```sh
npx wrangler deploy
```

Konfigurace je v `wrangler.jsonc`; obě třídy používají SQLite. Native static assets se nasadí s Workerem. Alternativně lze po dry-run spustit `node scripts/package-worker.mjs` a nahrát `build/deploy.js` přes Workers API: obsahuje i veřejné statické soubory. První nasazení vyžaduje migraci `v1` pro `Directory` a `Room`.

GitHub slouží pouze k uchování zdrojového kódu a kontrolám. Publikování přes GitHub Pages bylo odstraněno.

Workflow Checks provádí kontrolu syntaxe, sestavení Workeru a všechny testy. Nasazení backendu z GitHubu není automatické, takže se do repozitáře neukládají přístupové tokeny.

## Co funguje

- Host s obnovitelným tokenem; účty e-mail/heslo, unikátní přezdívky, změna jména a smazání účtu. Hesla PBKDF2-SHA256 s náhodnou solí, relace na 30 dnů, v úložišti jen otisky tokenů.
- Otevřené a uzavřené místnosti, pozorovatelé, zamykání jejich chatu, živý přehled a pozvánky uživatelům, odmítnutí, ignorování a jednorázové odkazy.
- Vlastní zoom a posouvání desky (100–300 %), na dotykovém zařízení i přiblížení dvěma prsty. Mobilní potvrzování tahu plave ve viditelné oblasti obrazovky včetně změn velikosti a přiblížení.
- Zvuk a pulzování v posledních 10 sekundách vlastního tahu, důraznější poslední 3 sekundy; samostatný alarm po prohře na čas a výhra/prohra uprostřed desky. Respektuje přepínač zvuku a nastavení omezeného pohybu.
- Losem určený první hráč, připravenost, časomíra, vzdání, remízy s limitem dvou nabídek, odvety se střídáním zahajujícího, návrat po výpadku.
- Chat s Enterem, limitem 300 znaků a 1 zpráva/s, základní filtr slov, bezpečné textové vykreslení; hlášení s posledními 50 zprávami a automatickým odstraněním po 2 dnech.
- Elo (1 000, K=32), okamžité zobrazení aktuálních bodů a jejich změny po partii; hosté a trénink nemění Elo.
- Historické souhrnné skóre dvojice (výhry obou stran a remízy) se uchovává nezávisle na stolu. Rozpoznání je podle ID účtu nebo identity hosta, nikoli přezdívky; při smazání účtu se související skóre smaže. Začíná se počítat od zavedení této funkce, protože starší výsledky se k dvojicím neukládaly.
- AI v prohlížeči: osm úrovní, host začíná na 1 a po výhře postupuje, registrovaný hráč podle Elo (700–799 úroveň 1, 800–899 úroveň 2, …, od 1 400 úroveň 8). AI vždy bere okamžitou výhru a kryje bezprostřední prohru.
- Administrační seznam hlášení, varování, dočasné umlčení, dočasný i trvalý zákaz účtu nebo identity hosta.

## Administrace, podněty a aktivace účtů

Správci jsou účty jhal a Lenka. `ADMIN_USER_IDS` obsahuje jejich neměnná ID oddělená čárkou; server ověřuje oprávnění při každém požadavku. V patičce správce vidí Správu. Hráči i hosté mohou odeslat chybu nebo tip; podněty vidí pouze správci, mohou je vyřídit a znovu otevřít. Vyřízené podněty se mažou po 30 dnech, vlastní podněty také při smazání účtu.

Nové účty jsou do ověření e-mailu neaktivní a nedostanou přihlašovací relaci ani místo v žebříčku. Registrace čeká na přijetí e-mailu odesílací službou; při chybě odeslání se nová registrace vrátí zpět. Odkaz je náhodný, jednorázový, platí 24 hodin a v úložišti je jen jeho otisk. Token je ve fragmentu odkazu, aby se neposílal do přístupových logů. Aktivace vyžaduje potvrzení na stránce, aby odkaz nespotřeboval e-mailový skener. Nový odkaz lze vyžádat z přihlášení; předchozí zneplatní až úspěšné odeslání nového. Starší existující účty zůstávají aktivní.

Odesílání vyžaduje `PUBLIC_URL`, ověřenou odesílací adresu `MAIL_FROM` a buď binding `EMAIL` pro Cloudflare Email Sending, nebo tajný `RESEND_API_KEY`. Bez konfigurace registrace vrací jasnou chybu a netvrdí, že e-mail odeslala. Aktuální připojení Cloudflare nemá oprávnění k nastavení Email Sending; produkční odesílání je zatím blokováno. Obnova hesla je volitelná přes Resend, odkazy platí 30 minut a zneplatní relace. Přihlášení Google ani Facebook není součástí hry.

## Bezpečnost a provoz

API neakceptuje klientský výsledek, symbol ani hodnocení. Identita se odvozuje z relace, hráčské role kontroluje místnost. WebSocket se otevírá jednorázovým krátkodobým lístkem; dlouhodobý token není v URL. Cross-origin přístup je povolen pouze nakonfigurovaným doménám. Textové vstupy jsou omezeny, kód se nevkládá jako HTML. Ochrana proti zneužití zahrnuje limity autentizace, zakládání stolů, ovládání, hlášení a chatu. Hostův zákaz se váže na jeho identitu; vymazáním tokenu lze získat nového hosta, jak připouští zadání.

V případě výpadku celé služby není z jedné klientské chyby možné dokonale odlišit globální výpadek od síťové chyby; implementace používá souběžné odpojení obou hráčů a opoždění alarmu. Před větší veřejnou propagací je vhodný zátěžový test, kalibrace AI a nastavení monitoringu.
