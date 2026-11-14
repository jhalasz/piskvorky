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

- `public/`: samostatný statický web pro GitHub Pages i Cloudflare, bez sestavení. Na počítači se tah odešle ihned kliknutím. Na mobilu (dotykové ovládání bez myši) nejdříve vyberete pole a pak potvrdíte tah.
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

### GitHub Pages

Workflow `.github/workflows/pages.yml` publikuje adresář `public` po změně `main`. V nastavení repozitáře **Settings → Pages → Source** musí být vybráno **GitHub Actions**. API používá `public/config.js`, kde je adresa produkčního Workeru. GitHub Pages URL je https://jhalasz.github.io/piskvorky/ po aktivaci Pages.

Workflow Checks provádí kontrolu syntaxe, sestavení Workeru a všechny testy. Nasazení backendu z GitHubu není automatické, takže se do repozitáře neukládají přístupové tokeny.

## Co funguje

- Host s obnovitelným tokenem; účty e-mail/heslo, unikátní přezdívky, změna jména a smazání účtu. Hesla PBKDF2-SHA256 s náhodnou solí, relace na 30 dnů, v úložišti jen otisky tokenů.
- Otevřené a uzavřené místnosti, pozorovatelé, zamykání jejich chatu, živý přehled a pozvánky uživatelům, odmítnutí, ignorování a jednorázové odkazy.
- Losem určený první hráč, připravenost, časomíra, vzdání, remízy s limitem dvou nabídek, odvety se střídáním zahajujícího, návrat po výpadku.
- Chat s Enterem, limitem 300 znaků a 1 zpráva/s, základní filtr slov, bezpečné textové vykreslení; hlášení s posledními 50 zprávami a automatickým odstraněním po 2 dnech.
- Elo (1 000, K=32), okamžité zobrazení aktuálních bodů a jejich změny po partii; hosté a trénink nemění Elo.
- Historické souhrnné skóre dvojice (výhry obou stran a remízy) se uchovává nezávisle na stolu. Rozpoznání je podle ID účtu nebo identity hosta, nikoli přezdívky; při smazání účtu se související skóre smaže. Začíná se počítat od zavedení této funkce, protože starší výsledky se k dvojicím neukládaly.
- AI v prohlížeči: osm úrovní, host začíná na 1 a po výhře postupuje, registrovaný hráč podle Elo (700–799 úroveň 1, 800–899 úroveň 2, …, od 1 400 úroveň 8). AI vždy bere okamžitou výhru a kryje bezprostřední prohru.
- Administrační seznam hlášení, varování, dočasné umlčení, dočasný i trvalý zákaz účtu nebo identity hosta.

## Nastavení provozovatele, které chybí

Tyto integrace mají implementovaný kód, ale bez vlastních údajů provozovatele jsou v UI výslovně nedostupné:

1. **Google:** vytvořit webový OAuth klient v Google Cloud, povolit domény webu, nastavit `GOOGLE_CLIENT_ID`. Server ověřuje audience, issuer, expiraci a ověřený e-mail tokenu. Existující e-mailový účet se automaticky nespojuje s novou identitou Google.
2. **Obnova hesla e-mailem:** nastavit tajný `RESEND_API_KEY`, ověřenou odesílací adresu `MAIL_FROM` a `PUBLIC_URL`. Resetovací odkazy platí 30 minut a zneplatní všechny relace. Žádný resetovací token se nevrací z API.
3. **Administrátor:** po založení vlastního účtu zkopírovat jeho ID z nastavení účtu a přidat jej jako `ADMIN_USER_ID` do Cloudflare. Administrátora neurčuje neověřený e-mail. Během prvního nasazení není určen žádný admin.
4. **Ochrana osobních údajů:** doplnit identifikaci a kontakt provozovatele v `public/app.js` (funkce `privacy`). Současný text vysvětluje technické zpracování, ale neobsahuje úplnou identifikaci provozovatele.

Nejsou zavedeny neschválené dodatečné tresty za opakované opouštění partií ani přihlášení Facebookem. Přesné síly AI a provozní limity jsou výše zdokumentované výchozí hodnoty určené ke kalibraci. Základní filtr slov nenahrazuje lidské vyřizování hlášení.

## Bezpečnost a provoz

API neakceptuje klientský výsledek, symbol ani hodnocení. Identita se odvozuje z relace, hráčské role kontroluje místnost. WebSocket se otevírá jednorázovým krátkodobým lístkem; dlouhodobý token není v URL. Cross-origin přístup je povolen pouze nakonfigurovaným doménám. Textové vstupy jsou omezeny, kód se nevkládá jako HTML. Ochrana proti zneužití zahrnuje limity autentizace, zakládání stolů, ovládání, hlášení a chatu. Hostův zákaz se váže na jeho identitu; vymazáním tokenu lze získat nového hosta, jak připouští zadání.

V případě výpadku celé služby není z jedné klientské chyby možné dokonale odlišit globální výpadek od síťové chyby; implementace používá souběžné odpojení obou hráčů a opoždění alarmu. Před větší veřejnou propagací je vhodný zátěžový test, kalibrace AI a nastavení monitoringu.
