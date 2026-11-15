Zadání webové online hry Piškvorky
Verze 2 – doplněno a upraveno 14. 11. 2026. Programování zatím nezačalo.
Všechny body v tomto zadání jsou odsouhlasené, kromě těch uvedených v kapitole Zbývající rozhodnutí.
1. Platforma a publikování
• Hra bude dostupná ve webovém prohlížeči na počítači i telefonu.
• Zdrojový kód bude na GitHubu. Při zahájení programování provedeme založením nového repozitáře.
• Webové rozhraní se publikuje přes GitHub Pages (jen statický web).
• Pro účty, online partie, chat a žebříček je potřeba serverová služba s databází, která běží mimo GitHub Pages. Konkrétní řešení ještě vybereme (např. Node.js se WebSockety, případně Supabase/Firebase).
• Komunikace probíhá přes HTTPS/WSS, server povolí původ domény GitHub Pages (CORS).
2. Hráči a přihlášení
Hráč může používat:
• Registrovaný účet s přezdívkou, statistikami a bodovým hodnocením.
    ◦ Přihlášení e-mailem a heslem. Nový účet aktivuje jednorázový ověřovací odkaz odeslaný ihned při registraci. Sociální přihlášení se nepoužívá.
    ◦ Přezdívky registrovaných hráčů jsou unikátní.
    ◦ Součástí účtu je obnova hesla, změna přezdívky a smazání účtu (GDPR).
• Anonymní vstup jako host, bez registrace.
    ◦ Host dostane automatickou přezdívku (např. „Host 4821“), která nemůže napodobit přezdívku registrovaného hráče.
    ◦ Host dostane anonymní token uložený v prohlížeči, aby se mohl po výpadku vrátit do rozehrané partie.
Registrovaní hráči i hosté mohou hrát, sledovat otevřené partie a používat chat podle nastavení místnosti.
3. Hlavní rozhraní
Hlavní obrazovka nabídne:
• Založení nové hry.
• Připojení ke hře čekající na soupeře.
• Sledování probíhající otevřené partie.
• Trénink proti počítači.
• Zobrazení žebříčku.
• Rozbalovací seznam (roletku) přihlášených uživatelů, včetně hostů, odkud lze hráče pozvat ke hře. Uživatel může ignorovat pozvánky od konkrétního uživatele.
V přehledu místností (aktualizovaném v reálném čase) bude vidět:
• Označení stolu.
• Přezdívky obou hráčů, případně volné nebo rezervované místo.
• Stav místnosti.
• Zda je místnost otevřená, nebo uzavřená.
Příklady:
Obsazení
Stav
Jan × volné místo
Čeká na soupeře
Jan × Petr
Čeká na přijetí pozvánky
Jan × Petr
Čeká na připravenost hráčů
Jan × Petr
Probíhá partie
Jan × Petr
Partie skončila, možnost odvety
4. Místnosti a přístup
Místnost je buď otevřená, nebo uzavřená. Uzavřená a uzamčená místnost je totéž.
Otevřená místnost
• K volnému hráčskému místu se může připojit kdokoliv, pokud není rezervované pozvánkou.
• Další návštěvníci mohou sledovat partii a používat chat.
• Kterýkoliv z hrajících může zamknout psaní do chatu pro diváky. Ti pak mohou dál sledovat hru a číst zprávy, ale psát mohou pouze hrající. Zamčení lze zrušit.
Uzavřená místnost
• Je přístupná pouze hrajícím. Diváci do ní nemají přístup.
• Soupeř může vstoupit pouze prostřednictvím pozvánky.
• Kterýkoliv z obou hrajících může místnost uzavřít i znovu otevřít.
• Uzavření odpojí všechny diváky a zabrání vstupu dalších. Oba soupeři mohou pokračovat ve hře a chatu.
Životnost stolu
• Po skončení partie a odchodu jednoho hráče stůl zůstává a je otevřený pro novou partii (volné místo se zobrazí jako čekání na soupeře).
• Stůl zaniká, když odejdou oba hráči.
5. Pozvání ke hře
• Hráč může pozvat konkrétního přihlášeného uživatele ze seznamu, včetně hosta.
• Pozvaný uvidí přezdívku odesílatele a označení stolu.
• Pozvánku může přijmout nebo odmítnout, odesílatel ji může zrušit.
• Pozvánka platí 2 minuty. Během platnosti je hráčské místo rezervované pro pozvaného, po vypršení se rezervace uvolní.
• Je-li pozvaný zrovna v jiné partii, pozvánku nedostane a odesílatel uvidí „zaneprázdněn“.
• Bude možné zkopírovat odkaz s pozvánkou, také do uzavřené místnosti. Odkaz je jednorázový, vázaný na konkrétní stůl a platí 2 minuty.
• Z přehledu stolů musí být jasné, kdo proti komu bude hrát.
6. Vzhled a rozložení
Vycházíme z dodaného obrázku původní hry.
Na počítači:
• Velká herní plocha vlevo.
• Ovládání a chat vpravo, přibližně ve stejných proporcích jako na vzoru.
Na telefonu:
• Herní pole nahoře.
• Chat pod herním polem.
• Ovládání přizpůsobené dotykovému použití.
• Deska 19 × 19 se vejde na šířku obrazovky, bez přiblížení a posunu. Tah se nejdřív jen označí na poli a odešle se až potvrzením tlačítkem „Potvrdit tah“.
Společné prvky:
• V místnosti jsou jasně vidět oba soupeři, jejich symboly (× a ○), aktuální tah a stav partie.
• Čas na tah je vidět neustále.
• Zvýraznění posledního tahu a vítězné řady.
• Zvukové upozornění na tah.
Přesné grafické zpracování ještě není určené.
7. Herní pravidla
Prvek
Pravidlo
Velikost desky
19 × 19 polí
Symboly
× (křížek) a ○ (kolečko)
Střídání
Hráči se střídají, každý tah umístí jeden vlastní symbol na prázdné pole
Výhra
Nejméně 5 vlastních symbolů v souvislé řadě
Směry
Vodorovně, svisle nebo diagonálně
Delší řada
Také znamená výhru
Více vítězných řad jedním tahem
Povoleno, počítá se jako jedna výhra
Remíza stavem desky
Deska je zaplněná a nikdo nevyhrál
Zahájení první partie
Losem se určí, kdo hraje × a začíná
Zahájení odvety
Hráči se v zahajování střídají
Zahájení partie
• Partie začne až poté, co oba hráči potvrdí připravenost tlačítkem „Připraven“.
• Na potvrzení mají 60 sekund. Pokud ho někdo nepotvrdí, stůl se vrátí do stavu čekání.
• Odejde-li hráč před začátkem partie, jeho místo se uvolní.
8. Čas na tah
• Limit je 40 sekund na tah, platí i pro první tah.
• Po 30 sekundách bez tahu se zobrazí varování, posledních 10 sekund je zvýrazněno.
• Po 40 sekundách bez tahu hráč prohrává na čas.
• Každým platným tahem začíná běžet čas soupeři.
• Čas měří server, klient se s ním pouze synchronizuje.
• Odpočet je vidět neustále oběma hráčům i divákům.
• Čas běží dál i během nabídky remízy.
9. Ukončení partie
Partie může skončit:
• Výhrou vytvořením vítězné řady.
• Prohrou soupeře na čas.
• Vzdáním soupeře.
• Remízou dohodou.
• Remízou zaplněním desky bez vítěze.
• Kontumační prohrou po odpojení bez návratu.
• Anulováním při výpadku služby nebo při odpojení obou hráčů.
Vzdání
• Tlačítko „Vzdát hru“ vyžaduje potvrzení.
• Soupeř vyhrává.
• Vzdání se počítá jako běžná prohra, bez dodatečné penalizace.
• Tlačítko „Opustit místnost“ během probíhající partie je potvrzované a znamená okamžité vzdání.
Nabídka remízy
• Jeden hráč nabídne remízu, soupeř ji přijme nebo odmítne.
• Remíza platí až po přijetí soupeřem.
• Každý hráč může nabídnout remízu nejvýše 2× za jednu hru.
• Nabídka platí 30 sekund.
10. Odpojení a zánik stolu
• Zavřením stránky ani odchodem z místnosti nelze zrušit rozehranou partii a vyhnout se výsledku.
• Při náhlém odpojení (zavření stránky, ztráta spojení) má hráč 1 minutu na návrat.
• Během odpojení se pozastaví limit na tah odpojeného hráče, běží jen minuta na návrat. Při návratu dostane hráč zbývající čas tahu, nejméně však 10 sekund.
• Pokud se nevrátí, prohraje kontumačně.
• Odpojí-li se oba hráči současně, partie se anuluje bez změny bodů a bez započtení výhry či prohry. Pokud ale prvnímu odpojenému už minuta na návrat vypršela, prohrál kontumačně dříve.
• Od začátku partie nesmí místo odpojeného nebo odešlého hráče převzít jiný hráč.
• Při výpadku celé služby se rozehraná partie anuluje: bez změny bodů a bez započtení výhry či prohry.
Za opakované opouštění partií navrhujeme dočasný zákaz zahájení další hry. Přesná pravidla této penalizace ještě nejsou stanovená.
11. Odveta
• Po skončení partie se automaticky objeví tlačítko „Odveta“, pokud oba soupeři zůstávají v místnosti.
• Platí po výhře, prohře na čas, vzdání i remíze.
• Jeden hráč odvetu nabídne, druhý ji přijme nebo odmítne. Nabídka platí 30 sekund.
• Odejde-li soupeř, tlačítko zmizí.
• Nová partie začne až po souhlasu obou, ve stejné místnosti, s původním chatem.
• Hráči se v zahajování střídají.
12. Chat a hlášení nevhodného chování
• Každá místnost má vlastní společný chat.
• Psát mohou oba soupeři i diváci, včetně hostů, pokud jim psaní není uzamčené.
• Zprávy jsou viditelné všem v místnosti.
• Odesílání funguje tlačítkem i klávesou Enter.
• Délka zprávy je omezena na 300 znaků, frekvence na 1 zprávu za sekundu.
• Server ošetřuje vložený HTML kód a filtruje nevhodná slova.
• Chat se maže se zánikem stolu.
Hlášení administrátorovi
• Hráč může nahlásit nevhodné chování a doplnit krátký popis.
• Server při odeslání hlášení automaticky uloží posledních přibližně 50 zpráv chatu jako důkaz. Screenshoty se nepřikládají.
13. Administrátor
Minimální administrační rozhraní:
• Seznam hlášení se stavem (nové, vyřízené) a uloženými zprávami.
• Možnosti postihu: varování, dočasný zákaz chatu, dočasný nebo trvalý zákaz účtu. U hostů je postih omezený na blokaci tokenu nebo IP adresy.
14. Žebříček
• Každý registrovaný hráč má bodové hodnocení a umístění.
• Partie dvou registrovaných hráčů ovlivňují žebříček.
• Hry s hostem a trénink proti počítači žebříček neovlivňují.
• Slabší hráč za vítězství nad silnějším získá více bodů, silnější za vítězství nad slabším méně. Poražený odpovídající počet bodů ztratí.
• Remíza zohlední rozdíl síly soupeřů.
• Vzdání, prohra na čas a kontumace se hodnotí jako běžná prohra.
• Mechanismus: Elo, počáteční hodnocení 1 000 bodů, pevný koeficient 32 (bez zvláštního rozjezdu nových hráčů).
• Hráč se v žebříčku zobrazuje okamžitě po registraci, s počátečním hodnocením 1 000 bodů.
15. Trénink proti počítači
Typ hráče
Obtížnost
Anonymní host
Začíná na slabé obtížnosti, po každé výhře se síla počítače zvýší
Registrovaný hráč
Síla počítače odpovídá jeho hodnocení v žebříčku
• Trénink neovlivňuje bodové hodnocení a lze ho kdykoliv ukončit.
• Počítač běží přímo v prohlížeči, bez zátěže serveru.
• Obtížnost hosta se ukládá v prohlížeči (localStorage), zachová se tedy při příští návštěvě na stejném zařízení.
• Obtížnost registrovaných hráčů navázat na Elo v pásmech po 100 bodech, přibližně 6 až 8 úrovní.
• Začíná hráč a trénink nemá limit na tah.
16. Ukládané údaje
• Údaje potřebné pro fungování registrovaných účtů.
• Bodové hodnocení a souhrnné herní statistiky (počty her, výher, remíz a proher).
• Aktuální stav partie (pozice na desce, čas, stav hráčů) se drží pouze po dobu hry, aby šlo po výpadku pokračovat a aby se mohl divák připojit uprostřed partie. Po skončení partie se maže.
• Nebudeme ukládat historii tahů ani záznamy odehraných partií.
• Podaná hlášení administrátorovi včetně uložených zpráv chatu, po dobu 2 dnů, poté se mažou.
• Zásady ochrany osobních údajů a souhlas při registraci (GDPR).
17. Přehled ovládacích prvků
Oblast
Tlačítka / ovládání
Účet
Registrovat se, Přihlásit se (e-mail), Hrát jako host, Odhlásit se, Změnit přezdívku, Smazat účet
Hlavní rozhraní
Založit hru, Připojit se, Sledovat, Trénink, Žebříček, Seznam přihlášených uživatelů
Pozvánky
Pozvat hráče, Přijmout, Odmítnout, Zrušit pozvánku, Kopírovat odkaz, Ignorovat uživatele
Před partií
Připojit se jako hráč, Připraven
Partie
Vzdát hru, Nabídnout remízu, Přijmout / Odmítnout remízu
Místnost
Uzavřít / Otevřít místnost
Chat
Odeslat, Zamknout / Odemknout psaní diváků, Nahlásit nevhodné chování
Po partii
Odveta, Přijmout / Odmítnout odvetu
Navigace
Zpět do přehledu místností, Opustit místnost
Trénink
Spustit trénink, Ukončit trénink
18. Technické požadavky
• Tahy, časové limity, výsledky a změny bodů ověřuje server.
• Jeden výsledek se smí započítat pouze jednou.
• Hráč se po krátkém výpadku může vrátit do své rozehrané partie (registrovaný přes účet, host přes anonymní token).
• Server rozlišuje výpadek jednotlivého hráče, výpadek obou hráčů a výpadek služby.
• Přístup do uzavřených místností a hráčská místa se kontrolují na serveru.
• Omezení frekvence požadavků (chat, pozvánky, nabídky) proti zneužití.
• Prázdný stůl zaniká ihned po odchodu všech. Limity počtu stolů a diváků na stůl určíme později.
19. Zbývající rozhodnutí
• Opakované odchody: konkrétní podmínky dodatečné penalizace.
• Server a databáze: konečný výběr technologie.
• Přihlášení přes Facebook: zda a kdy přidat (vyžaduje schválení aplikace).
• Obtížnost počítače: přesné přiřazení úrovní k hodnocení a nastavení síly.
• Limity: počet stolů a diváků na stůl.
Správci: jhal a Lenka podle ID účtů. Hlášení chyb a tipů je dostupné i hostům. Hosting pouze Cloudflare; GitHub ukládá zdrojový kód a spouští kontroly.
