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
<p align="center"><strong>Skill Intelligence OS en Trust Control Plane voor AI-agents.</strong></p>
<p align="center">ForgeOS beslist <strong>welke vaardigheid mag worden uitgevoerd</strong>, <strong>welke context mag worden ingevoerd</strong>, <strong>welke stappen moeten worden uitgevoerd deterministisch</strong>, en <strong>welk bewijs sterk genoeg is om voltooiing te accepteren</strong>.</p>

---

## Waarom ForgeOS bestaat

Een agent wordt niet betrouwbaar omdat deze meer aanwijzingen, meer hulpmiddelen of een langer contextvenster heeft.

Het wordt betrouwbaar als het systeem zes vragen kan beantwoorden:

1. **Welke exacte uitkomst is vereist?**
2. **Welke techniek is geschikt en welke vergelijkbare technieken zijn hier fout?**
3. **Wat is de kleinste context die nodig is voor deze werkeenheid?**
4. **Welke stappen moeten deterministisch zijn in plaats van gedelegeerd aan een model?**
5. **Welk onafhankelijk bewijs bewijst de output?**
6. **Kan dezelfde workflow zichzelf herstellen, hervatten en controleren na een fout?**

ForgeOS v0.6 verandert deze vragen in een runtime:

```text
bevestigde bedoeling
  → resultaat + techniek ophalen
  → hard beleid en anti-triggerfilters
  → minimaal RoutePlan DAG
  → geïsoleerde ContextPack per werkeenheid
  → deterministische / agent / reflectie-uitvoeringsgrafiek
  → verankerde outputs + dekkingsgrootboek
  → vertrouwde ontvangstbewijzen + bewijspoorten
  → vrijgeven, terugdraaien, herstellen en leerquarantaine
```

Het is geen snelle verzameling. Het is het controlevlak rond vaardigheden, regels, haken, middelen, hulpmiddelen, context, bewijsmateriaal en leren.

---

## Wat is echt in v0.6.1

| Oppervlakte | Geverifieerde implementatie |
|---|---:|
| Legacy-getypeerde uitkomststeigers | **1.024** |
| Deep Skill Contract v2-technieken | **128** |
| L0 orkestratie/vertrouwen/contexttechnieken | **32** |
| L1 domeinoverschrijdende engineeringtechnieken | **96** |
| Onafhankelijke evaluatorbindingen | **128** |
| Stabiele procedurele aanbieders | **33** |
| Kandidaat-procesaanbieders | **242** |
| Ingebouwde vaardigheids- en kennistoewijzingen | **1.299** |
| Code Review Intelligence-conformiteitsgevallen | **12** |
| Tegenstrijdige zaken op het oppervlak van agenten | **20/20** |
| Stabiele providermaterialisatie | **33/33** |
| Routerprecisie@1 / @3 | **93,75% / 100%** |
| Routeroproep@6 | **100%** |
| Onveilige route-activering | **0%** |

> [!BELANGRIJK]
> De 1.024 oude knooppunten zijn **resultaatscaffolds**, en niet 1.024 procedurele vaardigheden op productieniveau. v0.6 bevat 128 diepgaande techniekcontracten. Drieëndertig procedurele aanbieders blijven in het verklaarde stabiele routeringskanaal voor compatibiliteit, maar uit de definitieve certificeringsaudit blijkt dat 0/128 bewijsgekwalificeerd stabiel is en 0 gecertificeerd onder de Revisie 2 Definition of Done. Het resterende bewijsmateriaal vereist uitstel, gekoppelde multi-modellen, druk, onafhankelijke beoordeling en productiebonnen.

**Kernelinventaris:** 32 L0-technieken + 96 L1-technieken = 128 diepe kerneltechnieken.

**Catalogusrouting vermeldt:** 33 verklaarde procedurele aanbieders van stabiele kanalen en 242 kandidaten. **Formeel certificeringsbewijs:** 0 stalgekwalificeerd, 0 gecertificeerd. Zie [Definitieve certificeringsaudit](docs/FINAL-CERTIFICATION-AUDIT.md).

De release-audit houdt deze beweringen opzettelijk vals:

```text
1.024 procedurele vaardigheden op productieniveau zijn onjuist
volledige PostgreSQL-levenscyclus HA false
universele microVM-sandbox false
Door experts gelabelde 200-PR-beoordelingsbenchmark onwaar
10.000 gepaarde evaluatieruns zijn false
```

ForgeOS v0.6 claimt geen universele volledigheid van de productie of 1.024 procedurele vaardigheden op productieniveau.

Zie [Claimsgrens v0.6](docs/CLAIMS-BOUNDARY-V0.6.md).

---

## Vijf minuten pad

Gebruik dit pad als u waarde wilt zonder eerst de Trust Kernel te leren.

### 1. Installeren

```bash
npm install
npm test
node src/cli/forge.mjs init
```

Geïnstalleerd pakket:

```bash
npx forgeos init
forge doctor
```

`forge init` creëert een veilig lokaal SQLite-WAL-profiel. De API-sleutel wordt naar een `0600` bestand geschreven en wordt nooit afgedrukt.

### 2. Vind de juiste techniek

```bash
forge skills search "react rerender"
forge skills inspect reducing-react-render-thrashing
forge route --query "compile the minimum context for a large monorepo"
```

### 3. Inspecteer v0.6

```bash
forge v06 status
forge profile plan coding --target codex
forge security scan --file agent-surface.json
```

### 4. Start het lokale besturingsvlak

```bash
npm start
# Dashboard: http://127.0.0.1:8787/dashboard
# MCP:       http://127.0.0.1:8787/mcp
# A2A:       http://127.0.0.1:8787/a2a
```

---

## Diep operatorpad

Gebruik dit pad bij het insluiten van ForgeOS in Codex, Claude Code, ChatGPT, een open-source agent, CI of een intern platform.

### Vaardigheidsintelligentierouter

De router voert het ophalen in twee fasen uit in plaats van het matchen van een vaardigheidsnaam:

```text
opzet/mislukte poort
  → uitkomst ophalen
  → direct ophalen van techniek-trigger
  → anti-trigger-uitsluiting
  → vertrouwen, huurder, volwassenheid, tool, licentie, versheidsfilters
  → herrangschikking van het gemeten nut
  → minimale techniek DAG
  → providerresolutie
  → bevroren RoutePlan
```

Elke geselecteerde en afgewezen techniek heeft een reden. Harde blokkers verslaan altijd de score.

### Globale Context Kernel v2

ForgeOS budgetteert het volledige verzoek:

```text
systeem · taak · geselecteerde vaardigheidssecties · codesymbolen · artefacten
· geheugen · tooluitvoer · referenties · luie toolschema's
· uitgangsreserve · veiligheidsreserve
```

Het biedt:

- één token-accountinginterface gedeeld door de oplosser en materializer;
- Vaardigheden laden op sectieniveau;
- geïsoleerde context per werkeenheid;
- luie materialisatie van tool-schema's;
- Semantische ABI-symbool-ID's en afwijzing van verouderde hash;
- artefact-deltaprojectie;
- scoped, aflopende instinctinjectie;
- op inhoud geadresseerde onbewerkte logboeken met gedestilleerde foutbereiken;
- een omissiemanifest voor elke niet inbegrepen bron.

### Deterministische vaardigheidsstof

Een v0.6-techniek wordt gecompileerd in een uitvoerbare grafiek:

```text
Deterministische knooppunten
  scope-selectie · bundeling · regelresolutie · verankering · bewijs

Agent-knooppunten
  onderzoek · hypothese · domeinoordeel

Reflectie knooppunten
  tegenstrijdigheid · vals-positief filter · uitvoerbaarheid

Controleknooppunten
  parallelle verbinding · dekkingspoort · nieuwe poging · terugdraaien
```

Het SQLite-dekkingsgrootboek maakt gebruik van leases, hartslag, hekwerken en vertrouwde ontvangstbewijzen. Een teruggewonnen werknemer kan een werkeenheid niet als voltooid markeren.

### Code Review Intelligentie verticaal segment

Het eerste volledige verticale segment bewijst de architectuur van begin tot eind:

```text
volledige reikwijdte
→ relatiebewuste werkunits
→ contextuele regelselectie
→ analyse van geïsoleerde agenten
→ lijn-/hash-ankers
→ verhuizing na bewerkingen
→ onafhankelijke reflectie
→ dekkingsbewijs
```

Het gebundelde corpus van 12 gevallen is een deterministische conformiteitsbenchmark. Het wordt **niet** geadverteerd als een door experts gelabelde 200-PR-benchmark.

### Continu leren – zonder automatische zelfvergiftiging

Waargenomen patronen worden gerichte instincten, geen stabiele vaardigheden:

```text
betrouwbare runbonnen
  → waargenomen instinct
  → huurder/project/harnasisolatie + TTL
  → compatibel instinctcluster
  → kandidaat-evolutievoorstel
  → onafhankelijke evaluatie
  → menselijke promotie of terugdraaiing
```

De producent kan zijn eigen aangeleerde gedrag niet bevorderen.

### Harnas Runtime v2

ForgeOS onderscheidt vier oppervlakken:

| Oppervlakte | Gebruik het voor |
|---|---|
| **Regel** | Korte invariant die altijd moet gelden |
| **Haak** | Deterministische actie gebonden aan een gebeurtenis |
| **Vaardigheid** | Voorwaardelijke procedure waarbij een vonnis vereist is |
| **Agentrol** | Afzonderlijke context, tools, model of autoriteit |

Neutrale gebeurtenissen zijn onder meer `before.tool.execute`, `after.file.write`, `verification.checkpoint`, `session.compact` en `session.ended`. Hostadapters moeten niet-ondersteunde functies markeren in plaats van valse pariteit te claimen.

Profielen:

```text
minimaal · codering · creatief · onderzoek · gereguleerd
lokaal-klein · bedrijf
```

### Agent Surface-beveiliging

De beveiligingsengine scant het agentsysteem zelf:

- instructie en prompte grensoverschrijdingen;
- hooks en pakketlevenscyclusscripts;
- MCP-beschrijvingen, machtigingen en bereikbaarheid van tools;
- opdracht toelatingslijsten;
- geheime/omgevingsreferenties;
- geheim-naar-uitgaand toestemmingspaden;
- pipe-to-shell- en brede wildcard-mogelijkheden;
- profielrechten verschillen vóór installatie.

Het vijandige corpus passeert momenteel **20/20** gevallen.

### Bemiddelde lokale uitvoering

De lokale loper biedt een echte veiligheidsgrens voor normale commando's:

- geen shell-interpolatie;
- toelatingslijsten voor commando's en omgevingen;
- werkruimte en symlink-insluiting;
- time-out en beëindiging van procesgroepen;
- begrensd stdout/stderr;
- inhoudelijk geadresseerde uitvoeringsbon.

Het is **niet** een universele microVM-sandbox die het netwerk ontkent. Bij uitvoering door derden met een hoog risico is nog steeds een externe container- of microVM-isolatielaag vereist.

---


# Hoe ForgeOS werkt

ForgeOS combineert twee producten in één runtime:

1. **Een Skill Intelligence-laag** die technieken ophaalt, onveilige bijna-matches afwijst, alleen de vereiste vaardigheidssecties samenstelt en een bevroren uitvoeringsplan samenstelt.
2. **Een AI-controlevlak** dat projecten, artefacten, bewijsmateriaal, goedkeuringen, leases, herstel, federatie en vrijgavepoorten beheert.

```text
bevestigde intentie of mislukte poort
  → uitkomst en directe techniek ophalen
  → anti-trigger-, huurder-, vertrouwens-, tool-, licentie- en versheidsfilters
  → minimaal bevroren RoutePlan DAG
  → geïsoleerde ContextPack per werkeenheid
  → deterministisch / agent / reflectie Uitvoeringsgrafiek
  → verankerde uitgangen en omheind dekkingsgrootboek
  → vertrouwde ontvangstbewijzen en zekerheidsbewuste poorten
  → vrijgeven, herstellen, terugdraaien of leerquarantaine
```

## Tien samenwerkende systemen

| Systeem | Wat het controleert |
|---|---|
| **Skill Intelligence-router** | Resultaten ophalen, technieken scoren, anti-triggers, hard beleid, providerselectie en verklaarbare routeplannen |
| **Global Context Kernel v2** | Eén totaal tokenbudget voor beleid, taken, vaardigheidssecties, symbolen, artefacten, geheugen, gereedschapsuitvoer, referenties en uitvoerreserve |
| **Deterministische vaardigheidsstof** | Hybride grafieken met deterministische knooppunten, agentknooppunten, reflectieknooppunten, goedkeuringen, ankers en stopvoorwaarden |
| **Dekkingsgrootboek** | Eigendom van werkeenheden, leases, hektokens, voltooiingsdekking, afwijzing van oude werknemers en hervatbaarheid |
| **Vertrouwenkernel** | Bewijsversheid, afstamming van artefacten, goedkeuringsautoriteit, zekerheidsniveaus en vrijgavebeslissingen |
| **Agent Surface-beveiliging** | Patronen voor promptinjectie, gevaarlijke pakketscripts, paden voor geheim naar uitgaand verkeer, machtigingen en eerlijkheid van adaptermogelijkheden |
| **Bemiddelde lokale uitvoering** | Shell-vrije opdrachtspawning, toelatingslijsten, time-outs, uitvoerlimieten en gestructureerde ontvangstbewijzen |
| **Continu leren** | Scoped instincten, verval, vertrouwen, quarantaine, kandidaatvoorstellen en gecontroleerde promotie |
| **Vaardigheidsfederatie** | Ondertekende bronnen, vertrouwensniveaus, quarantaine, conflicthantering, intrekking en gesynchroniseerde catalogi |
| **Harness Runtime v2** | Regels, haken, vaardigheden, agentrollen, machtigingsverschillen en profielen voor verschillende AI-harnassen |

---

# Ecosysteemvergelijking

> [!BELANGRIJK]
> Deze vergelijking beschrijft de **native, eersteklas focus van elke kernrepository**. `◐` betekent gedeeltelijke ondersteuning, op extensies gebaseerde ondersteuning of ondersteuning via een aangrenzend product. `—` betekent dat dit niet de primaire focus van het project is, niet dat het onmogelijk is om te bouwen.

GitHub-sterren hieronder zijn geschatte cijfers gecontroleerd op **26 juli 2026**. Ze duiden op de zichtbaarheid van de gemeenschap, en niet op de technische kwaliteit op zichzelf.

## Ecosysteemkaart

| Project | Ongeveer. GitHub-sterren | Primaire rol |
|---|---:|---|
| [Superkrachten](https://github.com/obra/superpowers) | **255k** | Vaardigheidskader voor agenten en methodologie voor softwareontwikkeling |
| [Antropische agentvaardigheden](https://github.com/anthropics/skills) | **151k** | Vaardigheidsstandaard en openbare vaardighedenbibliotheek voor Claude |
| [LangChain](https://github.com/langchain-ai/langchain) | **139k** | Agent-engineeringplatform en groot integratie-ecosysteem |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) | **75k+** | End-to-end software-ontwikkelingsagent-applicatie |
| [CrewAI](https://github.com/crewAIInc/crewAI) | **56k+** | Multi-agentploegen en gebeurtenisgestuurde stromen |
| [AutoGen](https://github.com/microsoft/autogen) | **50k+** | Multi-agent messaging en onderzoeksruntime |
| [LangGraph](https://github.com/langchain-ai/langgraph) | **37k+** | Stateful, langlopende agentgrafieken |
| [Semantische kernel](https://github.com/microsoft/semantic-kernel) | **28k+** | Meertalige SDK voor ondernemingsorkestratie |
| [Geweldige agentvaardigheden](https://github.com/VoltAgent/awesome-agent-skills) | **28k+** | Gemeenschapscatalogus met meer dan duizend vaardigheden |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | **27k+** | Agenten, overdrachten, vangrails, sessies en tracering |
| [smolagenten](https://github.com/huggingface/smolagents) | **27k+** | Minimale agentbibliotheek met nadruk op codeagent |
| [Letta](https://github.com/letta-ai/letta) | **23k+** | Stateful agenten en persistent geheugen |
| [Google ADK](https://github.com/google/adk-python) | **ongeveer 20k** | Code-first agent bouwen, evalueren en inzetten |
| [PydanticAI](https://github.com/pydantic/pydantic-ai) | **ongeveer 19k** | Typeveilig Python-agentframework |

## Kerncapaciteitsmatrix

| Systeem | Verpakte vaardigheden | Routering + anti-trigger | Bestuurde context | Deterministische/agent hybride grafiek | Bewijs + vertrouwensbewijzen | Agent-oppervlaktebeveiliging | Inheemse kracht |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **ForgeOS** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Vaardigheidsintelligentie en betrouwbare uitvoering |
| Antropische vaardigheden | ✅ | ◐ | ◐ | — | — | ◐ | Eenvoudige, draagbare vaardigheidsstandaard |
| Supermachten | ✅ | ✅ | ◐ | ◐ | ◐ | — | Zeer expliciete SDLC-methodologie voor codeermiddelen |
| Geweldige agentvaardigheden | ✅ | — | — | — | — | ◐ | Ontdekking van vaardigheden uit vele bronnen |
| LangChain | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Zeer groot integratie-ecosysteem |
| LangGraf | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Duurzame uitvoering en stateful grafieken |
| OpenAI Agents-SDK | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Lichtgewicht raamwerk, overdracht en tracering |
| BemanningAI | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Rolgebaseerde agenten gecombineerd met Flows |
| AutoGen | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Gebeurtenisgestuurde runtime met meerdere agenten |
| Semantische kernel / MAF | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Enterprise-orkestratie gedurende runtimes |
| Google ADK | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Bouwen, evalueren en implementeren in het ecosysteem van Google |
| PydanticAI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Typeveiligheid, validatie en Python-ergonomie |
| smolmiddelen | ◐ | ◐ | ◐ | ◐ | — | ◐ | Minimale, leesbare agentimplementatie |
| Letta | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | Persistent geheugen en stateful agents |
| OpenHanden | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | End-to-end codeerervaring |

## ForgeOS kiest een ander slagveld

Een vaardighedenopslagplaats antwoordt: **“Welke procedures kan de agent leren?”**

ForgeOS vraagt ​​ook: **“Welke techniek is nu toegestaan, welke bijna-match moet worden afgewezen, welke secties mogen in de context komen, welke tools zijn vereist, welk bewijs moet worden geleverd en welke poort kan het werk voltooid verklaren?”**

Een agentframework helpt bij het creëren van agenten, tools, overdrachten en workflows. ForgeOS richt zich op de laag rond die runtime: het ophalen van mogelijkheden, anti-triggers, globale contextbudgetten, deterministische/agent/reflectiegrafieken, huidig ​​bewijsmateriaal, goedkeuringsautoriteit, artefactafstamming, herstel en leerquarantaine.

Een geheugensysteem richt zich op wat een agent zich herinnert. ForgeOS controleert bovendien tot welk tenant-, project-, gebruiker-, vertrouwensdomein, verloop-, vertrouwens- en promotiebeleid het geheugen behoort.

Een end-to-end coderingsagent zorgt voor de gebruikerservaring. ForgeOS kan **onder of naast** die agent draaien als laag voor vaardighedenselectie, contextbeheer, bewijsmateriaal, vertrouwen en projectlevenscyclus.

## Waar volwassen ecosystemen nog steeds leiden

Ze hebben momenteel grotere communities, meer tutorials en integraties, meer gepolijste beheerde cloud-ervaringen, sterkere onboarding zonder code en meer publiekelijk gedocumenteerde productie-implementaties. ForgeOS concentreert zich bewust op een minder gestandaardiseerd probleem: **het beheersen van de keuze van vaardigheden, context, bewijsmateriaal, autoriteit en voltooiingsstatus voor AI-agenten**.

---

# Drie toegangspaden

## Voor dagelijkse gebruikers

U hoeft niet elk subsysteem te begrijpen. Begin met vier waarneembare tests:

```bash
node src/cli/forge.mjs doctor
node src/cli/forge.mjs skills search --query "review authentication changes"
node src/cli/forge.mjs route --query "review authentication changes without missing tests"
node src/cli/forge.mjs scan agent-surface --path .
```

Je kunt nagaan welke techniek is gekozen, waarom alternatieven zijn afgewezen, hoeveel context er is verzameld, welke toestemmingen worden gevraagd en welk bewijsmateriaal nog ontbreekt.

## Voor ontwikkelaars

ForgeOS stelt dezelfde runtime bloot via:

- CLI voor lokale bediening en CI;
- HTTP API's en Studio-dashboard;
- **60 schema-strikte MCP-tools**;
- A2A-taak- en agentkaartoppervlakken;
- directe service-import uit de bronboom van Node.js;
- **15 adapters** voor agent- en IDE-ecosystemen;
- zeven harnasprofielen: `minimal`, `coding`, `creative`, `research`, `regulated`, `local-small` en `enterprise`.

Ontwikkelaars kunnen projecten maken, artefacten registreren, bewijsmateriaal binden, goedkeuringen aanvragen, RoutePlans en ContextPacks samenstellen, grafieken uitvoeren, revisies herstellen, federatieve vaardigheden synchroniseren of een nieuw Skill Contract v2 toevoegen.

## Voor experts en onderzoekers

ForgeOS is ontworpen om te worden uitgedaagd in plaats van geaccepteerd te worden vanaf een marketingpagina. Deskundigen kunnen onafhankelijk testen:

- routerprecisie, terugroepactie, anti-triggergedrag en onveilige activering;
- totale context-overflow en semantische ABI-reductie;
- deterministische dekking, ankers, reflectie, huurovereenkomsten en hekwerken;
- bewijs van versheid, artefactafstamming en zekerheidsbewuste poorten;
- snelle injectie, pakketscripts, paden voor geheime toegang en eerlijkheid van adapters;
- federatieconflicten, quarantaine, intrekking en bronvertrouwen;
- archiefverificatie zonder `.git`.

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

# Repository-kaart

```text
src/runtime-implementatie
  cli/forge opdrachtregelinterface
  kern/project, artefact, bewijs, goedkeuring, herstel
  vaardigheidsintelligentie/contracten, routing, evaluatie, materialisatie
  context/ Global Context Kernel- en werkeenheidcompilatie
  uitvoering/grafiekcompiler, deterministische knooppunten, dekking
  vertrouwen/bewijs, zekerheid, autoriteit, vrijgavepoorten
  beveiliging/agent-oppervlak scannen en opdrachtmakelaar
  federatie/ externe bronnen, vertrouwen, quarantaine, synchronisatie
  leren/instincten, kandidaten, vervaldatum, promotie
  mcp/MCP-server en 60 openbare tools
  a2a/A2A-kaarten, taken, berichten en ontvangstbewijzen
  server/HTTP API's, authenticatie, dashboard
  opslag/ SQLite-WAL persistentie en migraties
adapters/15 agent- en IDE-adapters
skills-v2/ 128 diepgaande Skill Contract v2-technieken
mogelijkheden-v2/ uitkomsten, technieken, aanbieders, relaties, grafiek
schema's/ openbare JSON Schema 2020-12-contracten
packs/ verticale capaciteitspakketten en benchmarks
evaluaties/evaluatiegevallen, rubrieken en corpora
tests/ 125 testbestanden en release-invarianten
bewijs/gegenereerd audit-, benchmark-, SBOM- en dashboardbewijs
docs/architectuur, protocollen, beveiliging, testen, productie
tools voor het genereren, valideren, auditen, benchmarken en vrijgeven van scripts
```

# Geschikte gebruiksscenario's

- Codeeragenten gedisciplineerder en controleerbaarder maken.
- Het bouwen van een besturingsvlak voor verschillende modellen, agenten en tools.
- Het exploiteren van een intern vaardigheidsplatform met routing- en volwassenheidscontroles.
- Agentconfiguraties, machtigingen, aanwijzingen en supply chain-oppervlakken beoordelen.
- Hoge zekerheid of gereguleerde workflows die bewijs- en goedkeuringspoorten vereisen.
- Het verminderen van contextverspilling in grote opslagplaatsen door isolatie van werkeenheden en semantische ABI.

ForgeOS is geen vervanging voor zakelijke workflowautomatisering in n8n-stijl. n8n verbindt applicaties en zakelijke evenementen; ForgeOS controleert de selectie, context, uitvoering, bewijsmateriaal en autoriteit van AI-technieken. Ze kunnen samen worden gebruikt.

---

## Architectuur

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

## MCP- en agentintegratie

ForgeOS spreekt MCP `2025-11-25`, A2A `1.0`, Agent Skills-compatibele pakketten, HTTP en CLI.

v0.6 openbare tools omvatten:

```text
forge_v06_status
forge_execution_graph_compile
forge_review_scope_compile
forge_context_work_units_compile
forge_harness_profile_plan
forge_agent_surface_scan
```

Ze sluiten zich aan bij de bestaande tools voor project-, artefact-, vertrouwd bewijs-, herstel-, federatie-, Skill Intelligence- en MCP-makelaars. Stdio, HTTP MCP, CLI en Studio delen dezelfde services en JSON-schema's.

Ondersteunde adapterpakketten zijn onder meer ChatGPT, Codex, Claude Code, Cursor, OpenCode, Gemini CLI, Copilot CLI, Cline, Roo Code, Windsurf, Continue, NolaneNative, OpenClaw, Pi en generieke MCP/A2A. Bewijsmateriaal onderscheidt **op protocol geteste** adapters van **alleen documentatie** handleidingen.

---

## Verificatie

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

De release gate controleert gedrag en contracten, niet alleen lijndekking:

- staats-, hekwerk-, stale-proof- en levenscyclusinvarianten;
- volledige MCP/A2A-levenscyclus en uitvoerschema's;
- vaardigheidsdiepte, boilerplate, sectie-hash en materialisatie;
- routerprecisie, terugroepen, determinisme en onveilige activering;
- mondiale contextoverloop en weglatingsboekhouding;
- deterministische uitvoering en dekkingsgrootboek;
- ankers en reflectie doornemen;
- onafhankelijke evaluatie en quarantaine voor continu leren;
- gevallen van vijandschap op het oppervlak van agenten;
- archiefinstallatie en zelfverificatie zonder `.git`.

---

## Productiegrens

**Vandaag geïntegreerd**

- SQLite WAL levenscyclus-backend met één knooppunt;
- revisie/CAS, huurovereenkomsten, hekwerken, snapshots, herstel, ACL, OIDC/API-sleutel;
- vertrouwde ontvangstbewijzen, artefact-envelop-hashes, zekerheidsbewuste poorten;
- op huurder gerichte vaardigheden/kennis/MCP-federatie;
- sierlijke afvoer, gereedheid, statistieken, herkomst van ondertekende release;
- niet-root/alleen-lezen implementatieprofielen.

**Nog geen v0.6-claim**

- PostgreSQL drop-in backend over de volledige levenscyclus en geteste failover met meerdere knooppunten;
- universele microVM-sandbox van derden;
- SCIM/gedelegeerd organisatiebeheer;
- beheerde transparantiedienst en PKI;
- A2A streaming/push en gedistribueerd cv;
- 1.024 procedurele vaardigheden op productieniveau;
- 10.000 gepaarde evaluatieruns;
- Door deskundigen beoordeelde benchmark voor codebeoordeling in meerdere talen.

Lees [Productie](docs/PRODUCTION.md), [Beveiligingsmodel](docs/SECURITY-MODEL.md) en [Self-Audit v0.6](docs/SELF-AUDIT-V0.6.md).

---

## Documentatiekaart

| Begin hier | Diepe duik |
|---|---|
| [Snelle start](docs/QUICKSTART.md) | [Architectuur](docs/ARCHITECTURE.md) |
| [Vaardigheidsintelligentie](docs/SKILL-INTELLIGENCE.md) | [Deterministische Fabric v0.6](docs/DETERMINISTIC-SKILL-FABRIC-V06.md) |
| [CLI en profielen](docs/HARNESS-RUNTIME-V2.md) | [Global Context Kernel](docs/GLOBAL-CONTEXT-KERNEL.md) |
| [Beveiliging](docs/AGENT-SURFACE-SECURITY.md) | [Continu leren](docs/CONTINUOUS-LEARNING-V06.md) |
| [Testen](docs/TESTING.md) | [Claimgrens](docs/CLAIMS-BOUNDARY-V0.6.md) |
| [Bijdragen](CONTRIBUTING.md) | [Zelfcontrole](docs/SELF-AUDIT-V0.6.md) |

---

## Talen

[Universal Lanes](docs/UNIVERSAL-LANES.md) · [Remote MicroVM Sandbox](docs/REMOTE-MICROVM-SANDBOX.md) · [Tiếng Việt](README-vn.md) · [简体中文](README-cn.md) · [繁體中文](README-tw.md) · [日本語](README-ja.md) · [한국어](README-ko.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Português](README-pt-br.md) · [Русский](README-ru.md) · [العربية](README-ar.md) · [हिन्दी](README-hi.md) · [Bahasa Indonesia](README-id.md) · [ไทย](README-th.md) · [Türkçe](README-tr.md) · [Italiano](README-it.md) · [Polski](README-pl.md) · [Українська](README-uk.md) · [Nederlands](README-nl.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [Svenska](README-sv.md)

---

## Bijdragen

Een nieuwe vaardigheid wordt niet geaccepteerd omdat het proza ​​ervan deskundig klinkt. Het heeft nodig:

1. een RED-basislijn die zonder de techniek faalt;
2. nauwkeurige triggers en anti-triggers;
3. een domeinspecifiek procedure- en faalmodel;
4. getypte input, output, tools en bewijsmateriaal;
5. sectie-hashes en tokenbudgetten;
6. onafhankelijke beoordelaarsbindingen;
7. benchmarkbewijs en een volwassenheidsbeslissing.

Zie [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) en [SECURITY.md](SECURITY.md).

## Licentie

MIT — zie [LICENTIE](LICENSE).


## Finale release-audits

- [Eindrapport over verharding](docs/FINAL-HARDENING-REPORT.md)
- [Eindelijke audit van vaardigheidscertificering](docs/FINAL-CERTIFICATION-AUDIT.md)
