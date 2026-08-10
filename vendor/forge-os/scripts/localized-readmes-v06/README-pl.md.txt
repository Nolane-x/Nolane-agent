<p align="center">
  <img src="assets/forgeos-v06-hero.svg" alt="ForgeOS v0.6 — Deterministic Skill Intelligence OS" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT License"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/release-v0.6.1-a78bfa?style=for-the-badge" alt="ForgeOS v0.6.1"></a>
  <img src="https://img.shields.io/badge/kernel-128_techniques-63e6ff?style=for-the-badge" alt="128 kernel techniques">
  <img src="https://img.shields.io/badge/MCP-60_tools-f97316?style=for-the-badge" alt="60 MCP tools">
  <img src="https://img.shields.io/badge/tests-release--gated-22c55e?style=for-the-badge" alt="Release-gated verification">
</p>

<p align="center"><img src="assets/forgeos-mark.svg" alt="ForgeOS mark" width="92"></p>
<h1 align="center">ForgeOS</h1>
<p align="center"><strong>Skill Intelligence OS i płaszczyzna kontroli zaufania dla agentów AI.</strong></p>
<p align="center">ForgeOS decyduje <strong>która umiejętność może zostać uruchomiona</strong>, <strong>jaki kontekst może wejść</strong>, <strong>jakie kroki należy wykonać deterministyczny</strong> i <strong>który dowód jest wystarczająco mocny, aby zaakceptować ukończenie</strong>.</p>

---

## Dlaczego istnieje ForgeOS

Agent nie staje się niezawodny, ponieważ ma więcej podpowiedzi, więcej narzędzi lub dłuższe okno kontekstowe.

Staje się niezawodny, gdy system może odpowiedzieć na sześć pytań:

1. **Jaki dokładny wynik jest wymagany?**
2. **Która technika jest właściwa i które podobne techniki są tutaj błędne?**
3. **Jaki jest najmniejszy kontekst potrzebny dla tej jednostki pracy?**
4. **Które kroki muszą być deterministyczne, a nie delegowane do modelu?**
5. **Jakie niezależne dowody potwierdzają wynik?**
6. **Czy ten sam przepływ pracy może zostać odzyskany, wznowiony i poddany inspekcji po awarii?**

ForgeOS v0.6 zamienia te pytania w środowisko wykonawcze:

```text
potwierdzony zamiar
  → wynik + odzyskanie techniki
  → twarde zasady i filtry zapobiegające wyzwalaniu
  → minimalny RoutePlan DAG
  → izolowany pakiet ContextPack na jednostkę pracy
  → wykres wykonania deterministycznego / agenta / odbicia
  → zakotwiczone wyniki + księga pokrycia
  → zaufane paragony + bramki dowodowe
  → zwalnianie, przywracanie, odzyskiwanie i kwarantanna naukowa
```

Nie jest to zbiór natychmiastowy. Jest to płaszczyzna kontroli dotycząca umiejętności, zasad, haczyków, agentów, narzędzi, kontekstu, dowodów i uczenia się.

---

## Co jest prawdziwe w wersji 0.6.1

| Powierzchnia | Sprawdzona realizacja |
|---|---:|
| Starsze rusztowania wyników typu | **1024** |
| Techniki Deep Skill Contract v2 | **128** |
| Techniki orkiestracji/zaufania/kontekstu L0 | **32** |
| Techniki inżynierii międzydziedzinowej L1 | **96** |
| Niezależne powiązania oceniającego | **128** |
| Stabilni dostawcy procedur | **33** |
| Kandydaci na dostawców procedur | **242** |
| Wbudowane umiejętności + mapowania wiedzy | **1299** |
| Przypadki zgodności Code Review Intelligence | **12** |
| Sprawy kontradyktoryjne na powierzchni agenta | **20/20** |
| Stabilna materializacja dostawcy | **33/33** |
| Precyzja routera@1 / @3 | **93,75% / 100%** |
| Przywołanie routera@6 | **100%** |
| Aktywacja niebezpiecznej trasy | **0%** |

> [!WAŻNE]
> 1024 starsze węzły to **rusztowania wynikowe**, a nie 1024 umiejętności proceduralne klasy produkcyjnej. Wersja 0.6 zawiera 128 kontraktów na głębokie techniki. Trzydziestu trzech dostawców procedur pozostaje w zadeklarowanym stabilnym kanale routingu pod względem kompatybilności, ale końcowy audyt certyfikacyjny wykazał, że 0/128 dostawców procedur jest stabilnych i 0 posiada certyfikaty zgodnie z definicją wykonania w wersji 2. Pozostałe dowody wymagają wstrzymania, sparowania wielu modeli, ciśnienia, niezależnej oceny i potwierdzeń produkcji.

**Inwentarz jądra:** 32 techniki L0 + 96 technik L1 = 128 technik głębokiego jądra.

**Stanowiska routingu w katalogu:** 33 zadeklarowanych dostawców procedur w stabilnym kanale i 242 kandydatów. **Formalny dowód certyfikacji:** 0 z kwalifikacjami stabilnymi, 0 z certyfikatem. Zobacz [Końcowy audyt certyfikujący](docs/FINAL-CERTIFICATION-AUDIT.md).

Audyt wydania celowo utrzymuje, że te twierdzenia są fałszywe:

```text
1024 umiejętności proceduralne na poziomie produkcyjnym są fałszywe
pełny cykl życia PostgreSQL HA false
uniwersalna piaskownica microVM false
Test porównawczy recenzji 200-PR oznaczony przez eksperta jest fałszywy
10 000 sparowanych ocen kończy się niepowodzeniem
```

ForgeOS v0.6 nie zapewnia uniwersalnej kompletności produkcji ani 1024 umiejętności proceduralnych na poziomie produkcyjnym.

Zobacz [Granica roszczeń v0.6](docs/CLAIMS-BOUNDARY-V0.6.md).

---

## Ścieżka pięciominutowa

Użyj tej ścieżki, jeśli chcesz uzyskać wartość bez wcześniejszej nauki jądra zaufania.

### 1. Zainstaluj

```bash
npm install
npm test
node src/cli/forge.mjs init
```

Zainstalowany pakiet:

```bash
npx forgeos init
forge doctor
```

`forge init` tworzy bezpieczny lokalny profil SQLite-WAL. Jego klucz API jest zapisywany w pliku `0600` i nigdy nie jest drukowany.

### 2. Znajdź odpowiednią technikę

```bash
forge skills search "react rerender"
forge skills inspect reducing-react-render-thrashing
forge route --query "compile the minimum context for a large monorepo"
```

### 3. Sprawdź wersję 0.6

```bash
forge v06 status
forge profile plan coding --target codex
forge security scan --file agent-surface.json
```

### 4. Uruchom lokalną płaszczyznę sterowania

```bash
npm start
# Dashboard: http://127.0.0.1:8787/dashboard
# MCP:       http://127.0.0.1:8787/mcp
# A2A:       http://127.0.0.1:8787/a2a
```

---

## Głęboka ścieżka operatora

Użyj tej ścieżki podczas osadzania ForgeOS w Codex, Claude Code, ChatGPT, agencie open source, CI lub platformie wewnętrznej.

### Router inteligencji umiejętności

Zamiast dopasowywać nazwę umiejętności, router wykonuje pobieranie dwuetapowe:

```text
zamiar/nieudana brama
  → wyszukiwanie wyników
  → bezpośrednie odzyskiwanie techniki-spustu
  → wykluczenie anty-wyzwalania
  → zaufanie, najemca, dojrzałość, narzędzie, licencja, filtry świeżości
  → reranking mierzonej użyteczności
  → minimalna technika DAG
  → uchwała dostawcy
  → zamrożony Plan trasy
```

Każda wybrana i odrzucona technika ma swój powód. Twardi blokujący zawsze pobijają wynik.

### Jądro kontekstu globalnego v2

ForgeOS budżetuje całe żądanie:

```text
system · zadanie · wybrane sekcje umiejętności · symbole kodu · artefakty
· pamięć · wyjście narzędzia · referencje · leniwe schematy narzędzi
· rezerwa mocy · rezerwa bezpieczeństwa
```

Zapewnia:

- jeden interfejs rozliczeniowy tokenów współdzielony przez narzędzie do rozpoznawania nazw i materializator;
- ładowanie umiejętności na poziomie sekcji;
- izolowany kontekst na jednostkę pracy;
- leniwa materializacja schematu narzędzia;
- Semantyczne identyfikatory symboli ABI i odrzucanie przestarzałych skrótów;
- projekcja delta artefaktu;
- ograniczony, wygasający zastrzyk instynktu;
- surowe dzienniki adresowane pod względem treści z destylowanymi zakresami awarii;
- manifest pominięcia dla każdego nieuwzględnionego źródła.

### Deterministyczna struktura umiejętności

Technika v0.6 jest kompilowana w wykonywalny wykres:

```text
Węzły deterministyczne
  wybór zakresu · łączenie · rozstrzyganie zasad · zakotwiczenie · dowód

Węzły agenta
  badanie · hipoteza · osąd dziedzinowy

Węzły odbicia
  sprzeczność · filtr fałszywie pozytywny · możliwość działania

Węzły kontrolne
  połączenie równoległe · bramka zasięgu · ponowna próba · wycofanie
```

Księga pokrycia SQLite wykorzystuje dzierżawy, puls, ogrodzenia i zaufane rachunki. Odzyskany pracownik nie może oznaczyć jednostki pracy jako ukończonej.

### Pionowy wycinek analizy kodu

Pierwszy pełny pionowy przekrój pokazuje całą architekturę:

```text
pełny zakres
→ jednostki pracy świadome relacji
→ kontekstowy wybór reguł
→ analiza izolowanego agenta
→ kotwice liniowe/hashowe
→ przeniesienie po edycjach
→ niezależna refleksja
→ dowód ubezpieczenia
```

Dołączony korpus składający się z 12 przypadków jest deterministycznym punktem odniesienia dla zgodności. Nie jest** reklamowany jako test porównawczy 200-PR oznaczony przez ekspertów.

### Ciągłe uczenie się — bez automatycznego samootrucia

Zaobserwowane wzorce stają się ograniczonymi instynktami, a nie stabilnymi umiejętnościami:

```text
zaufane rachunki za przebieg
  → zaobserwowany instynkt
  → izolacja najemcy/projektu/wiązki przewodów + TTL
  → kompatybilny klaster instynktów
  → propozycja ewolucji kandydata
  → niezależna ocena
  → awans człowieka lub wycofanie się
```

Producent nie może promować własnego wyuczonego zachowania.

### Środowisko wykonawcze wiązki przewodów v2

ForgeOS wyróżnia cztery powierzchnie:

| Powierzchnia | Użyj go do |
|---|---|
| **Zasada** | Krótki niezmiennik, który musi zawsze obowiązywać |
| **Hak** | Deterministyczne działanie powiązane ze zdarzeniem |
| **Umiejętności** | Procedura warunkowa wymagająca orzeczenia |
| **Rola agenta** | Oddzielny kontekst, narzędzia, model lub autorytet |

Neutralne zdarzenia obejmują `before.tool.execute`, `after.file.write`, `verification.checkpoint`, `session.compact` i `session.ended`. Karty hosta muszą oznaczać nieobsługiwane funkcje zamiast zgłaszać fałszywą parzystość.

Profile:

```text
minimalny · kodowanie · kreatywny · badania · regulowany
lokalne-małe · przedsiębiorstwo
```

### Bezpieczeństwo powierzchni agenta

Silnik bezpieczeństwa skanuje sam system agenta:

- naruszenia granic nakazowych i natychmiastowych;
- hooki i skrypty cyklu życia pakietów;
- Opisy MCP, uprawnienia i dostępność narzędzi;
- listy dozwolonych poleceń;
- odniesienia do tajemnicy/środowiska;
- ścieżki uprawnień do tajnego wyjścia;
- możliwość podłączenia rury do powłoki i szerokie możliwości stosowania symboli wieloznacznych;
- różnice w uprawnieniach profilu przed instalacją.

Jej korpus kontradyktoryjny przechodzi obecnie **20/20** spraw.

### Pośrednictwo w wykonaniu lokalnym

Lokalny biegacz zapewnia prawdziwą granicę bezpieczeństwa dla normalnych poleceń:

- brak interpolacji powłoki;
- listy dozwolonych poleceń i środowisk;
- obszar roboczy i zawieranie dowiązań symbolicznych;
- przekroczenie limitu czasu i zakończenie grupy procesów;
- ograniczone stdout/stderr;
- adresowany merytorycznie dowód wykonania.

To **nie** jest uniwersalną piaskownicą microVM odmawiającą dostępu do sieci. Wykonywanie przez strony trzecie wysokiego ryzyka nadal wymaga zewnętrznego kontenera lub warstwy izolacji mikroVM.

---


# Jak działa ForgeOS

ForgeOS łączy dwa produkty w jednym środowisku wykonawczym:

1. **Warstwa analizy umiejętności**, która wyszukuje techniki, odrzuca niebezpieczne bliskie dopasowania, kompiluje tylko wymagane sekcje umiejętności i tworzy zamrożony plan wykonania.
2. **Płaszczyzna kontroli AI**, która zarządza projektami, artefaktami, dowodami, zatwierdzeniami, dzierżawami, odzyskiwaniem, federacją i bramkami do wydania.

```text
potwierdzony zamiar lub nieudana bramka
  → wyszukiwanie wyników i techniki bezpośredniej
  → filtry zapobiegające wyzwalaniu, najemca, zaufanie, narzędzie, licencja i świeżość
  → minimalna zamrożona trasa RoutePlan DAG
  → izolowany pakiet ContextPack na jednostkę pracy
  → deterministyczny / agent / odbicie Wykres wykonania
  → zakotwiczone wyjścia i ogrodzona księga pokrycia
  → zaufane rachunki i bramki świadome pewności
  → zwalnianie, odzyskiwanie, przywracanie lub nauka kwarantanny
```

## Dziesięć współpracujących systemów

| Systemu | Co kontroluje |
|---|---|
| **Router inteligencji umiejętności** | Pobieranie wyników, punktacja techniki, czynniki zapobiegające wyzwalaczom, twarda polityka, wybór dostawcy i zrozumiałe plany tras |
| **Jądro kontekstu globalnego v2** | Jeden całkowity budżet tokenów na politykę, zadania, sekcje umiejętności, symbole, artefakty, pamięć, dane wyjściowe narzędzi, referencje i rezerwę wyjściową |
| **Deterministyczna struktura umiejętności** | Wykresy hybrydowe zawierające węzły deterministyczne, węzły agentów, węzły odbicia, zatwierdzenia, kotwice i warunki zatrzymania |
| **Księga Ubezpieczeń** | Własność jednostek roboczych, dzierżawa, tokeny ogrodzenia, zakres ukończenia, odrzucenie nieaktualnego pracownika i możliwość wznowienia |
| **Zaufaj jądru** | Świeżość dowodów, pochodzenie artefaktów, organ zatwierdzający, poziomy pewności i decyzje o wydaniu |
| **Bezpieczeństwo powierzchni agenta** | Wzorce wstrzykiwania podpowiedzi, niebezpieczne skrypty pakietów, ścieżki tajnego wyjścia, uprawnienia i możliwości adaptera. Uczciwość |
| **Pośredniczona realizacja lokalna** | Tworzenie poleceń bez powłoki, listy dozwolonych, limity czasu, limity wyjściowe i ustrukturyzowane potwierdzenia |
| **Ciągła nauka** | Ograniczone instynkty, wygaśnięcie, pewność siebie, kwarantanna, propozycje kandydatów i kontrolowana promocja |
| **Federacja Umiejętności** | Podpisane źródła, poziomy zaufania, kwarantanna, obsługa konfliktów, unieważnianie i zsynchronizowane katalogi |
| **Środowisko wykonawcze wiązki przewodów v2** | Zasady, haki, umiejętności, role agentów, różnice w uprawnieniach i profile dla różnych uprzęży AI |

---

# Porównanie ekosystemów

> [!WAŻNE]
> To porównanie opisuje **natywne, pierwszorzędne skupienie każdego repozytorium podstawowego**. `◐` oznacza częściowe wsparcie, wsparcie oparte na rozszerzeniach lub wsparcie za pośrednictwem sąsiedniego produktu. `—` oznacza, że ​​nie jest to główny cel projektu, a nie, że nie da się go zbudować.

Gwiazdki GitHuba poniżej to przybliżone dane sprawdzone **26 lipca 2026 r.**. Wskazują widoczność społeczności, a nie samą jakość inżynierii.

## Mapa ekosystemu

| Projekt | Około. Gwiazdy GitHuba | Podstawowa rola |
|---|---:|---|
| [Supermoce](https://github.com/obra/superpowers) | **255 tys.** | Ramy umiejętności agentów i metodologia tworzenia oprogramowania |
| [Umiejętności agenta antropicznego](https://github.com/anthropics/skills) | **151 tys.** | Standard umiejętności i publiczna biblioteka umiejętności dla Claude'a |
| [LangChain](https://github.com/langchain-ai/langchain) | **139 tys.** | Platforma inżynierii agentów i duży ekosystem integracji |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) | **75 tys.+** | Kompleksowa aplikacja agenta do tworzenia oprogramowania |
| [CrewAI](https://github.com/crewAIInc/crewAI) | **56 tys.+** | Załogi wieloagentowe i przepływy sterowane zdarzeniami |
| [AutoGen](https://github.com/microsoft/autogen) | **50 tys.+** | Komunikacja wieloagentowa i środowisko badawcze |
| [LangGraph](https://github.com/langchain-ai/langgraph) | **37 tys.+** | Stanowe, długoterminowe wykresy agentów |
| [Jądro semantyczne](https://github.com/microsoft/semantic-kernel) | **28 tys.+** | Wielojęzyczny zestaw SDK do orkiestracji dla przedsiębiorstw |
| [Niesamowite umiejętności agenta](https://github.com/VoltAgent/awesome-agent-skills) | **28 tys.+** | Katalog społecznościowy obejmujący ponad tysiąc umiejętności |
| [SDK dla agentów OpenAI](https://github.com/openai/openai-agents-python) | **27 tys.+** | Agenci, przekazania, poręcze, sesje i śledzenie |
| [smolagenty](https://github.com/huggingface/smolagents) | **27 tys.+** | Minimalna biblioteka agentów z naciskiem na agenta kodu |
| [Letta](https://github.com/letta-ai/letta) | **23 tys.+** | Agenci stanowi i pamięć trwała |
| [Google ADK](https://github.com/google/adk-python) | **około 20 tys.** | Tworzenie, ocena i wdrażanie agentów w oparciu o kod |
| [PydanticAI](https://github.com/pydantic/pydantic-ai) | **około 19 tys.** | Struktura agenta Pythona z bezpiecznym typem |

## Macierz możliwości podstawowych

| Systemu | Pakiet umiejętności | Trasowanie + zabezpieczenie przed wyzwalaniem | Kontekst zarządzany | Wykres hybrydowy deterministyczny/agentowy | Dowody + pokwitowania zaufania | Bezpieczeństwo powierzchni agenta | Wrodzona siła |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **ForgeOS** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Inteligencja umiejętności i godne zaufania wykonanie |
| Umiejętności antropiczne | ✅ | ◐ | ◐ | — | — | ◐ | Prosty, przenośny standard umiejętności |
| Supermoce | ✅ | ✅ | ◐ | ◐ | ◐ | — | Wysoce jednoznaczna metodologia SDLC dla agentów kodujących |
| Niesamowite umiejętności agenta | ✅ | — | — | — | — | ◐ | Odkrywanie umiejętności z wielu źródeł |
| LangChain | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Bardzo duży ekosystem integracyjny |
| LangGraph | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Trwałe wykonanie i stanowe wykresy |
| Pakiet SDK agentów OpenAI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Lekka struktura, przekazywanie i śledzenie |
| ZałogaAI | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Agenci bazujący na rolach w połączeniu z przepływami |
| AutoGen | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Sterowane zdarzeniami wieloagentowe środowisko wykonawcze |
| Jądro semantyczne / MAF | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Orkiestracja korporacyjna w różnych środowiskach wykonawczych |
| ADK Google | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Twórz, oceniaj i wdrażaj w ekosystemie Google |
| PydanticAI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Bezpieczeństwo typów, walidacja i ergonomia Pythona |
| smolagety | ◐ | ◐ | ◐ | ◐ | — | ◐ | Minimalna, czytelna implementacja agenta |
| Letta | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | Pamięć trwała i agenci stanowi |
| OpenHands | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | Kompleksowe doświadczenie agenta kodującego |

## ForgeOS wybiera inne pole bitwy

Repozytorium umiejętności odpowiada na pytania: **„Jakich procedur może nauczyć się agent?”**

ForgeOS pyta również: **„Jaka technika jest teraz dozwolona, ​​które zbliżenie należy odrzucić, które sekcje mogą wejść w kontekst, jakie narzędzia są wymagane, jakie dowody należy przedstawić i która bramka może uznać pracę za ukończoną?”**

Struktura agentów pomaga tworzyć agentów, narzędzia, przekazania i przepływy pracy. ForgeOS skupia się na warstwie otaczającej środowisko wykonawcze: odzyskiwaniu możliwości, przeciwdziałaniu wyzwalaczom, budżetom kontekstu globalnego, wykresom deterministycznym/agentowym/odzwierciedlenia, bieżącym dowodom, organom zatwierdzającym, pochodzeniu artefaktów, odzyskiwaniu i kwarantannie uczenia się.

System pamięci koncentruje się na tym, co pamięta agent. ForgeOS dodatkowo kontroluje, do jakiego dzierżawcy, projektu, użytkownika, domeny zaufania, wygaśnięcia, zaufania i zasad promocji należy dana pamięć.

Kompleksowy agent kodujący zapewnia wygodę użytkownika. ForgeOS może działać **pod lub obok** tego agenta jako warstwa wyboru umiejętności, zarządzania kontekstem, dowodów, zaufania i cyklu życia projektu.

## Dokąd nadal prowadzą dojrzałe ekosystemy

Obecnie mają większe społeczności, więcej samouczków i integracji, bardziej dopracowane doświadczenia w chmurze zarządzanej, skuteczniejsze wdrażanie bez kodu i więcej publicznie udokumentowanych wdrożeń produkcyjnych. ForgeOS celowo koncentruje się na mniej ustandaryzowanym problemie: **kontrolowaniu wyboru umiejętności, kontekstu, dowodów, uprawnień i stanu ukończenia dla agentów AI**.

---

# Trzy ścieżki wejścia

## Dla codziennych użytkowników

Nie musisz rozumieć każdego podsystemu. Zacznij od czterech obserwowalnych testów:

```bash
node src/cli/forge.mjs doctor
node src/cli/forge.mjs skills search --query "review authentication changes"
node src/cli/forge.mjs route --query "review authentication changes without missing tests"
node src/cli/forge.mjs scan agent-surface --path .
```

Możesz sprawdzić, która technika została wybrana, dlaczego alternatywy zostały odrzucone, ile kontekstu skompilowano, jakie uprawnienia są wymagane i jakich dowodów nadal brakuje.

## Dla programistów

ForgeOS udostępnia to samo środowisko wykonawcze poprzez:

- CLI do obsługi lokalnej i CI;
- Interfejsy API HTTP i pulpit nawigacyjny Studio;
- **60 narzędzi MCP opartych na ścisłym schemacie**;
- Powierzchnie zadań i kart agentów A2A;
- bezpośredni import usług z drzewa źródłowego Node.js;
- **15 adapterów** dla ekosystemów agentowych i IDE;
- siedem profili uprzęży: `minimal`, `coding`, `creative`, `research`, `regulated`, `local-small` i `enterprise`.

Programiści mogą tworzyć projekty, rejestrować artefakty, wiązać dowody, żądać zatwierdzeń, kompilować plany tras i pakiety kontekstowe, wykonywać wykresy, odzyskiwać wersje, synchronizować umiejętności stowarzyszone lub dodawać nowy kontrakt umiejętności v2.

## Dla ekspertów i badaczy

ForgeOS został zaprojektowany tak, aby stawiać mu wyzwania, a nie akceptować go ze strony marketingowej. Eksperci mogą niezależnie testować:

- precyzja routera, przywołanie, zachowanie zapobiegające wyzwoleniu i niebezpieczna aktywacja;
- przepełnienie całego kontekstu i redukcja semantycznego ABI;
- pokrycie deterministyczne, kotwice, odbicie, dzierżawy i ogrodzenia;
- świeżość dowodów, pochodzenie artefaktów i bramki zapewniające pewność;
- szybkie wstrzykiwanie, skrypty pakietów, ścieżki tajnego wyjścia i uczciwość adaptera;
- konflikt federacji, kwarantanna, unieważnienie i zaufanie źródła;
- weryfikacja archiwum bez `.git`.

```bash
npm run validate
npm run v06:audit
npm run router:benchmark
npm run context:benchmark
npm run federation:eval
npm run federation:audit
npm run smoke
npm run adapter:tck
npm run release:verify
```

---

# Mapa repozytorium

```text
src/implementacja środowiska wykonawczego
  cli/forge interfejs wiersza poleceń
  rdzeń/projekt, artefakt, dowód, zatwierdzenie, odtworzenie
  inteligencja umiejętności/kontrakty, wyznaczanie trasy, ocena, materializacja
  kontekst/kontekst globalny Jądro i kompilacja jednostek roboczych
  wykonanie/kompilator grafów, węzły deterministyczne, pokrycie
  zaufanie/dowód, pewność, autorytet, bramki zwalniające
  skanowanie powierzchni agenta i broker poleceń
  federacja/źródła zdalne, zaufanie, kwarantanna, synchronizacja
  nauka/instynkt, kandydaci, wygaśnięcie, awans
  serwer mcp/MCP i 60 narzędzi publicznych
  Karty a2a/A2A, zadania, wiadomości i rachunki
  API serwera/HTTP, uwierzytelnianie, dashboard
  trwałość i migracje pamięci masowej/SQLite-WAL
adaptery/15 agentów i adapterów IDE
umiejętności-v2/ 128 technik głębokiego kontraktu umiejętności v2
możliwości-v2/ wyniki, techniki, dostawcy, relacje, wykres
schematy/publiczne kontrakty JSON Schema 2020-12
pakiety/pakiety możliwości pionowych i wzorce
ewaluacje/przypadki ewaluacyjne, rubryki i korpusy
testy/ 125 plików testowych i niezmienników wersji
dowody/wygenerowany audyt, benchmark, SBOM i dowody na panelu kontrolnym
dokumentacja/architektura, protokoły, bezpieczeństwo, testowanie, produkcja
narzędzia do tworzenia skryptów/generowania, walidacji, audytu, testów porównawczych i wydawania
```

# Odpowiednie przypadki użycia

- Zwiększenie dyscypliny i kontroli agentów kodujących.
- Budowa płaszczyzny kontrolnej dla kilku modeli, agentów i narzędzi.
- Obsługa wewnętrznej platformy umiejętności z kontrolą routingu i dojrzałości.
- Przeglądanie konfiguracji agentów, uprawnień, podpowiedzi i powierzchni łańcucha dostaw.
- Przepływy pracy o wysokim stopniu pewności lub regulowane, wymagające dowodów i bramek zatwierdzających.
- Ograniczanie marnowania kontekstu w dużych repozytoriach poprzez izolację jednostek roboczych i semantyczny ABI.

ForgeOS nie zastępuje automatyzacji przepływu pracy w biznesie w stylu n8n. n8n łączy aplikacje i wydarzenia biznesowe; ForgeOS kontroluje wybór techniki AI, kontekst, wykonanie, dowody i uprawnienia. Można ich używać razem.

---

## Architektura

```mermaid
graph TD
  U[User intent / failed gate] --> R[Unified Skill Intelligence Router]
  R --> RP[Frozen RoutePlan]
  RP --> CK[Global Context Kernel v2]
  CK --> CP[Isolated ContextPack per work unit]
  CP --> EG[Deterministic Execution Graph]
  EG --> D[Deterministic nodes]
  EG --> A[Agent nodes]
  EG --> RF[Independent reflection]
  D --> CL[Coverage Ledger]
  A --> AN[Anchored outputs]
  RF --> AN
  CL --> TK[Trust Kernel]
  AN --> TK
  TK --> G[Evidence-aware gates]
  G --> O[Artifacts / release / recovery]
  LR[Learning quarantine] --> R
  SF[Skill / Knowledge / MCP Federation] --> R
  HR[Harness Runtime + Security] --> EG
```

---

## Integracja MCP i agenta

ForgeOS obsługuje MCP `2025-11-25`, A2A `1.0`, pakiety kompatybilne z Agent Skills, HTTP i CLI.

Narzędzia publiczne wersji 0.6 obejmują:

```text
forge_v06_status
forge_execution_graph_compile
forge_review_scope_compile
forge_context_work_units_compile
forge_harness_profile_plan
forge_agent_surface_scan
```

Dołączają do istniejących projektów, artefaktów, zaufanych dowodów, odzyskiwania, federacji, Skill Intelligence i narzędzi brokerskich MCP. Stdio, HTTP MCP, CLI i Studio korzystają z tych samych usług i schematów JSON.

Obsługiwane pakiety adapterów obejmują ChatGPT, Codex, Claude Code, Cursor, OpenCode, Gemini CLI, Copilot CLI, Cline, Roo Code, Windsurf, Kontynuuj, NolaneNative, OpenClaw, Pi i ogólne MCP/A2A. Dowody odróżniają **przetestowane pod kątem protokołu** adaptery od **przewodników zawierających wyłącznie dokumentację**.

---

## Weryfikacja

```bash
npm run validate
npm run skills:v2:audit
npm run v06:audit
npm run router:benchmark
npm run context:benchmark
npm run federation:eval
npm run federation:audit
npm run smoke
npm run adapter:tck
npm run release:verify
```

Brama wydania sprawdza zachowanie i kontrakty, nie tylko zasięg linii:

- stan, ogrodzenie, niestałość i niezmienniki cyklu życia;
- pełny cykl życia MCP/A2A i schematy wyjściowe;
- głębokość umiejętności, szablon, skrót sekcji i materializacja;
- precyzja routera, przypominanie, determinizm i niebezpieczna aktywacja;
- rozliczanie przepełnienia i pominięcia kontekstu globalnego;
- deterministyczna księga wykonania i pokrycia;
- przegląd kotwic i refleksji;
- niezależna ocena i kwarantanna ciągłego uczenia się;
- sprawy kontradyktoryjne na płaszczyźnie agenta;
- instalacja archiwum i samoweryfikacja bez `.git`.

---

## Granica produkcji

**Integracja dzisiaj**

- Jednowęzłowy backend cyklu życia SQLite WAL;
- rewizja/CAS, dzierżawy, ogrodzenia, migawki, przywracanie, ACL, klucz OIDC/API;
- zaufane rachunki, skróty kopert artefaktów, bramki obsługujące pewność;
- federacja umiejętności/wiedzy/MCP ukierunkowana na najemców;
- pełen wdzięku drenaż, gotowość, metryki, podpisane pochodzenie wydania;
- profile wdrożeniowe inne niż root/tylko do odczytu.

**Nie ma jeszcze roszczenia do wersji 0.6**

- backend PostgreSQL o pełnym cyklu życia i przetestowane przełączanie awaryjne wielu węzłów;
- uniwersalna piaskownica microVM innej firmy;
- Administracja SCIM/organizacją delegowaną;
- zarządzana usługa przejrzystości i PKI;
- CV przesyłane strumieniowo/push i rozpowszechniane w formacie A2A;
- 1024 umiejętności proceduralnych na poziomie produkcyjnym;
- 10 000 sparowanych biegów ewaluacyjnych;
- oceniony przez ekspertów test porównawczy przeglądu kodu w wielu językach.

Przeczytaj [Produkcja](docs/PRODUCTION.md), [Model bezpieczeństwa](docs/SECURITY-MODEL.md) i [Self-Audit v0.6](docs/SELF-AUDIT-V0.6.md).

---

## Mapa dokumentacji

| Zacznij tutaj | Głębokie nurkowanie |
|---|---|
| [Szybki start](docs/QUICKSTART.md) | [Architektura](docs/ARCHITECTURE.md) |
| [Inteligencja umiejętności](docs/SKILL-INTELLIGENCE.md) | [Deterministyczna tkanina v0.6](docs/DETERMINISTIC-SKILL-FABRIC-V06.md) |
| [CLI i profile](docs/HARNESS-RUNTIME-V2.md) | [Jądro kontekstu globalnego](docs/GLOBAL-CONTEXT-KERNEL.md) |
| [Bezpieczeństwo](docs/AGENT-SURFACE-SECURITY.md) | [Ciągła nauka](docs/CONTINUOUS-LEARNING-V06.md) |
| [Testowanie](docs/TESTING.md) | [Granica roszczeń](docs/CLAIMS-BOUNDARY-V0.6.md) |
| [Wkład](CONTRIBUTING.md) | [Samokontrola](docs/SELF-AUDIT-V0.6.md) |

---

## Języki

[Universal Lanes](docs/UNIVERSAL-LANES.md) · [Remote MicroVM Sandbox](docs/REMOTE-MICROVM-SANDBOX.md) · [Tiếng Việt](README-vn.md) · [简体中文](README-cn.md) · [繁體中文](README-tw.md) · [日本語](README-ja.md) · [한국어](README-ko.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Português](README-pt-br.md) · [Русский](README-ru.md) · [العربية](README-ar.md) · [हिन्दी](README-hi.md) · [Bahasa Indonesia](README-id.md) · [ไทย](README-th.md) · [Türkçe](README-tr.md) · [Italiano](README-it.md) · [Polski](README-pl.md) · [Українська](README-uk.md) · [Nederlands](README-nl.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [Svenska](README-sv.md)

---

## Wkład

Nowa umiejętność nie jest akceptowana, ponieważ jej proza ​​brzmi fachowo. Potrzebuje:

1. linia bazowa RED, która zawodzi bez zastosowania techniki;
2. wyzwalacze precyzyjne i antywyzwalacze;
3. specyficzna dla dziedziny procedura i model awarii;
4. wpisane dane wejściowe, wyniki, narzędzia i dowody;
5. skróty sekcji i budżety tokenów;
6. niezależne powiązania oceniające;
7. Dowód porównawczy i decyzja dotycząca dojrzałości.

Zobacz [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) i [SECURITY.md](SECURITY.md).

## Licencja

MIT — zobacz [LICENCJA](LICENSE).


## Audyty wersji końcowej

- [Raport końcowy dotyczący wzmocnienia](docs/FINAL-HARDENING-REPORT.md)
- [Ostateczny audyt certyfikacji umiejętności](docs/FINAL-CERTIFICATION-AUDIT.md)
