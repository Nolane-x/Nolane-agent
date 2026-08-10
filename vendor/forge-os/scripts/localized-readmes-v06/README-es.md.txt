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
<p align="center"><strong>Skill Intelligence OS y Trust Control Plane para agentes de IA.</strong></p>
<p align="center">ForgeOS decide <strong>qué habilidad puede ejecutarse</strong>, <strong>qué contexto puede ingresar</strong>, <strong>qué pasos deben seguirse determinista</strong> y <strong>cuya evidencia es lo suficientemente sólida como para aceptar su finalización</strong>.</p>

---

## Por qué existe ForgeOS

Un agente no se vuelve confiable porque tenga más indicaciones, más herramientas o una ventana de contexto más larga.

Se vuelve confiable cuando el sistema puede responder seis preguntas:

1. **¿Qué resultado exacto se requiere?**
2. **¿Qué técnica es apropiada y qué técnicas similares son incorrectas en este caso?**
3. **¿Cuál es el contexto más pequeño necesario para esta unidad de trabajo?**
4. **¿Qué pasos deben ser deterministas en lugar de delegarse a un modelo?**
5. **¿Qué evidencia independiente prueba el resultado?**
6. **¿Puede el mismo flujo de trabajo recuperarse, reanudarse y auditarse a sí mismo después de una falla?**

ForgeOS v0.6 convierte esas preguntas en un tiempo de ejecución:

```text
intención confirmada
  → resultado + recuperación de la técnica
  → política dura y filtros anti-activación
  → mínimo RoutePlan DAG
  → ContextPack aislado por unidad de trabajo
  → gráfico de ejecución determinista / agente / reflexión
  → salidas ancladas + libro de cobertura
  → recibos confiables + puertas de evidencia
  → liberación, reversión, recuperación y cuarentena de aprendizaje
```

No es una recogida inmediata. Es el plano de control en torno a habilidades, reglas, ganchos, agentes, herramientas, contexto, evidencia y aprendizaje.

---

## ¿Qué es real en v0.6.1?

| Superficie | Implementación verificada |
|---|---:|
| Andamios de resultados mecanografiados heredados | **1.024** |
| Técnicas de Contrato de Habilidad Profunda v2 | **128** |
| Técnicas de orquestación/confianza/contexto L0 | **32** |
| Técnicas de ingeniería entre dominios L1 | **96** |
| Vinculaciones de evaluadores independientes | **128** |
| Proveedores procesales estables | **33** |
| Proveedores de procedimientos candidatos | **242** |
| Mapeos integrados de habilidades y conocimientos | **1.299** |
| Casos de conformidad de inteligencia de revisión de código | **12** |
| Casos contradictorios en la superficie del agente | **20/20** |
| Materialización estable del proveedor | **33/33** |
| Precisión del enrutador @1 / @3 | **93,75% / 100%** |
| Retirada del enrutador@6 | **100%** |
| Activación de ruta insegura | **0%** |

> [!IMPORTANTE]
> Los 1.024 nodos heredados son **andamios de resultados**, no 1.024 habilidades procedimentales de nivel de producción. v0.6 contiene 128 contratos de técnica profunda. Treinta y tres proveedores de procedimientos permanecen en el canal de enrutamiento estable declarado por compatibilidad, pero la auditoría de certificación final encuentra que 0/128 son estables con evidencia calificada y 0 están certificados según la Definición de Hecho de la Revisión 2. La evidencia restante requiere resistencia, modelos múltiples emparejados, presión, revisión independiente y recibos de producción.

**Inventario de kernel:** 32 técnicas L0 + 96 técnicas L1 = 128 técnicas de kernel profundo.

**Estados de enrutamiento del catálogo:** 33 proveedores de procedimientos de canal estable declarados y 242 candidatos. **Evidencia de certificación formal:** 0 calificados en establo, 0 certificados. Consulte [Auditoría de certificación final](docs/FINAL-CERTIFICATION-AUDIT.md).

La auditoría de publicación mantiene intencionalmente que estas afirmaciones son falsas:

```text
1.024 habilidades procesales de nivel de producción falsas
ciclo de vida completo de PostgreSQL HA falso
entorno limitado de microVM universal falso
punto de referencia de revisión de 200 PR etiquetado por expertos falso
10.000 evaluaciones emparejadas son falsas
```

ForgeOS v0.6 no pretende tener una producción universal completa ni 1.024 habilidades de procedimiento de grado de producción.

Consulte [Límite de reclamaciones v0.6](docs/CLAIMS-BOUNDARY-V0.6.md).

---

## Camino de cinco minutos

Utilice esta ruta cuando desee obtener valor sin conocer primero el Trust Kernel.

### 1. Instalar

```bash
npm install
npm test
node src/cli/forge.mjs init
```

Paquete instalado:

```bash
npx forgeos init
forge doctor
```

`forge init` crea un perfil SQLite-WAL local seguro. Su clave API se escribe en un archivo `0600` y nunca se imprime.

### 2. Encuentra la técnica adecuada

```bash
forge skills search "react rerender"
forge skills inspect reducing-react-render-thrashing
forge route --query "compile the minimum context for a large monorepo"
```

### 3. Inspeccionar v0.6

```bash
forge v06 status
forge profile plan coding --target codex
forge security scan --file agent-surface.json
```

### 4. Inicie el plano de control local.

```bash
npm start
# Dashboard: http://127.0.0.1:8787/dashboard
# MCP:       http://127.0.0.1:8787/mcp
# A2A:       http://127.0.0.1:8787/a2a
```

---

## Ruta del operador profunda

Utilice esta ruta al incorporar ForgeOS en Codex, Claude Code, ChatGPT, un agente de código abierto, CI o una plataforma interna.

### Enrutador de inteligencia de habilidades

El enrutador realiza una recuperación en dos etapas en lugar de hacer coincidir el nombre de una habilidad:

```text
intención/puerta fallida
  → recuperación de resultados
  → recuperación directa del disparador de técnica
  → exclusión anti-disparador
  → filtros de confianza, inquilino, madurez, herramienta, licencia, frescura
  → reclasificación de la utilidad medida
  → técnica mínima DAG
  → resolución del proveedor
  → Plan de ruta congelado
```

Cada técnica seleccionada y rechazada tiene un por qué. Los bloqueadores duros siempre ganan en puntuación.

### Núcleo de contexto global v2

ForgeOS presupuesta el pedido completo:

```text
sistema · tarea · secciones de habilidades seleccionadas · símbolos de código · artefactos
· memoria · salida de herramientas · referencias · esquemas de herramientas diferidas
· reserva de salida · reserva de seguridad
```

Proporciona:

- una interfaz de contabilidad de tokens compartida por el solucionador y el materializador;
- carga de habilidades a nivel de sección;
- contexto aislado por unidad de trabajo;
- materialización perezosa del esquema de herramientas;
- ID de símbolos ABI semánticos y rechazo de hash obsoleto;
- proyección delta de artefactos;
- inyección instintiva con alcance y expiración;
- registros sin procesar dirigidos al contenido con rangos de falla destilados;
- un manifiesto de omisión para cada fuente no incluida.

### Tejido de habilidades determinista

Una técnica v0.6 se compila en un gráfico ejecutable:

```text
Nodos deterministas
  selección de alcance · agrupación · resolución de reglas · anclaje · evidencia

Nodos de agente
  investigación · hipótesis · juicio de dominio

Nodos de reflexión
  contradicción · filtro de falsos positivos · accionabilidad

Nodos de control
  unión paralela · puerta de cobertura · reintento · reversión
```

El libro de cobertura de SQLite utiliza arrendamientos, latidos, vallas y recibos confiables. Un trabajador reclamado no puede marcar una unidad de trabajo como completa.

### Corte vertical de inteligencia de revisión de código

El primer corte vertical completo demuestra la arquitectura de principio a fin:

```text
alcance completo
→ unidades de trabajo conscientes de las relaciones
→ selección de reglas contextuales
→ análisis de agentes aislados
→ anclajes de línea/hash
→ reubicación después de las ediciones
→ reflexión independiente
→ recibo de cobertura
```

El corpus incluido de 12 casos es un punto de referencia de conformidad determinista. **No** se anuncia como un punto de referencia de 200 PR etiquetado por expertos.

### Aprendizaje continuo: sin autoenvenenamiento automático

Los patrones observados se convierten en instintos específicos, no en habilidades estables:

```text
recibos de ejecución confiable
  → instinto observado
  → inquilino/proyecto/aislamiento de arnés + TTL
  → grupo de instintos compatibles
  → propuesta de evolución del candidato
  → evaluación independiente
  → promoción humana o retroceso
```

El productor no puede promover su propia conducta aprendida.

### Tiempo de ejecución del arnés v2

ForgeOS distingue cuatro superficies:

| Superficie | Úselo para |
|---|---|
| **Regla** | Invariante corta que siempre debe aplicarse |
| **Gancho** | Acción determinista ligada a un evento |
| **Habilidad** | Procedimiento condicional que requiere sentencia |
| **Rol de agente** | Contexto, herramientas, modelo o autoridad separados |

Los eventos neutrales incluyen `before.tool.execute`, `after.file.write`, `verification.checkpoint`, `session.compact` y `session.ended`. Los adaptadores de host deben marcar funciones no compatibles en lugar de afirmar una paridad falsa.

Perfiles:

```text
mínimo · codificación · creativo · investigación · regulado
local-pequeña · empresa
```

### Seguridad de superficie del agente

El motor de seguridad escanea el propio sistema del agente:

- instrucción y violaciones de límites rápidos;
- ganchos y secuencias de comandos del ciclo de vida del paquete;
- Descripciones de MCP, permisos y accesibilidad de herramientas;
- listas de comandos permitidos;
- referencias secretas/ambientales;
- rutas de permisos secretos de salida;
- capacidad de comodín amplia y de tubería a carcasa;
- Diferencias de permisos de perfil antes de la instalación.

Su corpus adversarial actualmente supera **20/20** casos.

### Ejecución local negociada

El corredor local proporciona un límite de seguridad real para los comandos normales:

- sin interpolación de shell;
- listas permitidas de comando y entorno;
- espacio de trabajo y contención de enlaces simbólicos;
- tiempo de espera y terminación del grupo de procesos;
- salida estándar/stderr acotada;
- recibo de ejecución dirigido al contenido.

**No** es un entorno limitado de microVM que niega la red universal. La ejecución de alto riesgo por parte de terceros aún requiere un contenedor externo o una capa de aislamiento de microVM.

---


# Cómo funciona ForgeOS

ForgeOS combina dos productos en un tiempo de ejecución:

1. **Una capa de inteligencia de habilidades** que recupera técnicas, rechaza coincidencias inseguras, compila solo las secciones de habilidades requeridas y crea un plan de ejecución congelado.
2. **Un plano de control de IA** que gestiona proyectos, artefactos, evidencia, aprobaciones, arrendamientos, recuperación, federación y puertas de lanzamiento.

```text
intención confirmada o puerta fallida
  → resultado y recuperación de técnica directa
  → filtros anti-activador, inquilino, fideicomiso, herramienta, licencia y actualización
  → RoutePlan DAG mínimo congelado
  → ContextPack aislado por unidad de trabajo
  → determinista / agente / reflexión Gráfico de ejecución
  → salidas ancladas y libro mayor de cobertura vallado
  → recibos confiables y puertas conscientes de la seguridad
  → liberación, recuperación, reversión o cuarentena de aprendizaje
```

## Diez sistemas cooperativos

| Sistema | Qué controla |
|---|---|
| **Enrutador de inteligencia de habilidades** | Recuperación de resultados, puntuación de técnicas, antidisparadores, políticas estrictas, selección de proveedores y planes de ruta explicables |
| **Núcleo de contexto global v2** | Un presupuesto total de tokens para políticas, tareas, secciones de habilidades, símbolos, artefactos, memoria, resultados de herramientas, referencias y reserva de resultados |
| **Tejido de habilidades determinista** | Gráficos híbridos que contienen nodos deterministas, nodos de agentes, nodos de reflexión, aprobaciones, anclajes y condiciones de parada |
| **Libro mayor de cobertura** | Propiedad de unidades de trabajo, arrendamientos, tokens de cercado, cobertura de finalización, rechazo de trabajadores obsoletos y reanudabilidad |
| **Núcleo de confianza** | Actualización de la evidencia, linaje de artefactos, autoridad de aprobación, niveles de garantía y decisiones de publicación |
| **Seguridad de superficie del agente** | Patrones de inyección rápida, secuencias de comandos de paquetes peligrosos, rutas secretas de salida, permisos y capacidad del adaptador. Honestidad |
| **Ejecución local negociada** | Generación de comandos sin shell, listas permitidas, tiempos de espera, límites de salida y recibos estructurados |
| **Aprendizaje continuo** | Instintos con alcance, caducidad, confianza, cuarentena, propuestas de candidatos y promoción controlada |
| **Federación de habilidades** | Fuentes firmadas, niveles de confianza, cuarentena, manejo de conflictos, revocación y catálogos sincronizados |
| **Tiempo de ejecución de arnés v2** | Reglas, ganchos, habilidades, roles de agentes, diferencias de permisos y perfiles para diferentes arneses de IA |

---

# Comparación de ecosistemas

> [!IMPORTANTE]
> Esta comparación describe el **enfoque nativo de primera clase de cada repositorio principal**. `◐` significa soporte parcial, soporte basado en extensiones o soporte a través de un producto adyacente. `—` significa que no es el enfoque principal del proyecto, ni que sea imposible de construir.

Las estrellas de GitHub a continuación son cifras aproximadas verificadas el **26 de julio de 2026**. Indican visibilidad de la comunidad, no calidad de ingeniería en sí mismas.

## Mapa del ecosistema

| Proyecto | Aprox. Estrellas de GitHub | Rol principal |
|---|---:|---|
| [Superpoderes](https://github.com/obra/superpowers) | **255k** | Marco de habilidades del agente y metodología de desarrollo de software |
| [Habilidades del agente antrópico](https://github.com/anthropics/skills) | **151k** | Estándar de habilidades y biblioteca de habilidades públicas para Claude |
| [LangChain](https://github.com/langchain-ai/langchain) | **139k** | Plataforma de ingeniería de agentes y gran ecosistema de integración |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) | **75k+** | Aplicación de agente de desarrollo de software de extremo a extremo |
| [TripulaciónAI](https://github.com/crewAIInc/crewAI) | **56k+** | Equipos de múltiples agentes y flujos impulsados ​​por eventos |
| [AutoGen](https://github.com/microsoft/autogen) | **50k+** | Tiempo de ejecución de investigación y mensajería multiagente |
| [LangGraph](https://github.com/langchain-ai/langgraph) | **37k+** | Gráficos de agentes con estado y de larga duración |
| [Núcleo semántico](https://github.com/microsoft/semantic-kernel) | **28k+** | SDK de orquestación empresarial multilingüe |
| [Habilidades impresionantes del agente](https://github.com/VoltAgent/awesome-agent-skills) | **28k+** | Catálogo comunitario de más de mil habilidades |
| [SDK de agentes OpenAI](https://github.com/openai/openai-agents-python) | **27k+** | Agentes, traspasos, barreras de seguridad, sesiones y rastreo |
| [esmolagente](https://github.com/huggingface/smolagents) | **27k+** | Biblioteca de agentes mínima con énfasis en código-agente |
| [Letta](https://github.com/letta-ai/letta) | **23k+** | Agentes con estado y memoria persistente |
| [Google ADK](https://github.com/google/adk-python) | **alrededor de 20k** | Creación, evaluación e implementación de agentes basados ​​en el código |
| [PydanticAI](https://github.com/pydantic/pydantic-ai) | **alrededor de 19k** | Marco de agente Python con seguridad de tipos |

## Matriz de capacidades centrales

| Sistema | Habilidades empaquetadas | Enrutamiento + antidisparo | Contexto gobernado | Gráfico híbrido determinista/agente | Pruebas + recibos fiduciarios | Seguridad de la superficie del agente | Fuerza nativa |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **ForgeOS** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Inteligencia de habilidades y ejecución confiable |
| Habilidades Antrópicas | ✅ | ◐ | ◐ | — | — | ◐ | Estándar de habilidades simple y portátil |
| Superpoderes | ✅ | ✅ | ◐ | ◐ | ◐ | — | Metodología SDLC altamente explícita para agentes de codificación |
| Impresionantes habilidades de agente | ✅ | — | — | — | — | ◐ | Descubrimiento de habilidades a través de muchas fuentes |
| Cadena Lang | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Ecosistema de integración muy grande |
| LangGraph | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Ejecución duradera y gráficos con estado |
| SDK de agentes OpenAI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Marco ligero, traspasos y rastreo |
| TripulaciónAI | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Agentes basados ​​en roles combinados con Flujos |
| Autogeneración | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Tiempo de ejecución multiagente controlado por eventos |
| Núcleo semántico / MAF | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Orquestación empresarial en tiempos de ejecución |
| ADK de Google | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | Construya, evalúe e implemente en el ecosistema de Google |
| PydanticAI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Seguridad de tipos, validación y ergonomía de Python |
| esmolagente | ◐ | ◐ | ◐ | ◐ | — | ◐ | Implementación de agente mínima y legible |
| Letta | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | Memoria persistente y agentes con estado |
| Manos Abiertas | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | Experiencia de agente de codificación de un extremo a otro |

## ForgeOS elige un campo de batalla diferente

Un repositorio de habilidades responde: **“¿Qué procedimientos puede aprender el agente?”**

ForgeOS también pregunta: **“¿Qué técnica está permitida ahora, qué casi coincidencia debe rechazarse, qué secciones pueden entrar en contexto, qué herramientas se requieren, qué evidencia se debe producir y qué puerta puede declarar que el trabajo está completo?”**

Un marco de agentes ayuda a crear agentes, herramientas, transferencias y flujos de trabajo. ForgeOS se centra en la capa que rodea ese tiempo de ejecución: recuperación de capacidades, antidisparadores, presupuestos de contexto global, gráficos deterministas/agente/reflexión, evidencia actual, autoridad de aprobación, linaje de artefactos, recuperación y cuarentena de aprendizaje.

Un sistema de memoria se centra en lo que recuerda un agente. ForgeOS controla además a qué inquilino, proyecto, usuario, dominio de confianza, caducidad, confianza y política de promoción pertenece esa memoria.

Un agente de codificación de un extremo a otro proporciona la experiencia del usuario. ForgeOS puede ejecutarse **bajo o al lado** de ese agente como capa de selección de habilidades, gobernanza de contexto, evidencia, confianza y ciclo de vida del proyecto.

## Adónde conducen los ecosistemas maduros

Actualmente tienen comunidades más grandes, más tutoriales e integraciones, experiencias de nube administrada más pulidas, una incorporación sin código más sólida e implementaciones de producción más documentadas públicamente. ForgeOS se concentra deliberadamente en un problema menos estandarizado: **controlar la elección de habilidades, el contexto, la evidencia, la autoridad y el estado de finalización de los agentes de IA**.

---

# Tres caminos de entrada

## Para usuarios cotidianos

No es necesario comprender todos los subsistemas. Comience con cuatro pruebas observables:

```bash
node src/cli/forge.mjs doctor
node src/cli/forge.mjs skills search --query "review authentication changes"
node src/cli/forge.mjs route --query "review authentication changes without missing tests"
node src/cli/forge.mjs scan agent-surface --path .
```

Puede inspeccionar qué técnica se seleccionó, por qué se rechazaron las alternativas, cuánto contexto se compiló, qué permisos se solicitaron y qué evidencia aún falta.

## Para desarrolladores

ForgeOS expone el mismo tiempo de ejecución a través de:

- CLI para operación local y CI;
- API HTTP y panel de Studio;
- **60 herramientas MCP estrictas con el esquema**;
- Superficies de tareas y tarjetas de agente A2A;
- importaciones directas de servicios desde el árbol fuente de Node.js;
- **15 adaptadores** para ecosistemas de agente y IDE;
- siete perfiles de arnés: `minimal`, `coding`, `creative`, `research`, `regulated`, `local-small` y `enterprise`.

Los desarrolladores pueden crear proyectos, registrar artefactos, vincular pruebas, solicitar aprobaciones, compilar RoutePlans y ContextPacks, ejecutar gráficos, recuperar revisiones, sincronizar habilidades federadas o agregar un nuevo contrato de habilidades v2.

## Para expertos e investigadores

ForgeOS está diseñado para ser cuestionado en lugar de aceptado desde una página de marketing. Los expertos pueden probar de forma independiente:

- precisión del enrutador, recuperación, comportamiento antidisparo y activación insegura;
- desbordamiento del contexto total y reducción del ABI semántico;
- cobertura determinista, anclajes, reflexión, arrendamientos y cercas;
- frescura de la evidencia, linaje de artefactos y puertas conscientes de la seguridad;
- inyección rápida, secuencias de comandos de paquetes, rutas secretas de salida y honestidad del adaptador;
- conflicto de federación, cuarentena, revocación y confianza en la fuente;
- verificación de archivo sin `.git`.

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

# Mapa del repositorio

```text
src/implementación en tiempo de ejecución
  interfaz de línea de comandos cli/forge
  núcleo/proyecto, artefacto, evidencia, aprobación, recuperación
  inteligencia-habilidades/contratos, enrutamiento, evaluación, materialización
  contexto/Contexto global Kernel y compilación de unidades de trabajo
  ejecución/compilador de gráficos, nodos deterministas, cobertura
  confianza/evidencia, seguridad, autoridad, puertas de liberación
  agente de comando y escaneo de superficie de agente/seguridad
  federación/fuentes remotas, confianza, cuarentena, sincronización
  aprendizaje/instintos, candidatos, caducidad, promoción
  Servidor mcp/MCP y 60 herramientas públicas
  Tarjetas, tareas, mensajes y recibos a2a/A2A
  servidor/API HTTP, autenticación, panel de control
  almacenamiento/persistencia SQLite-WAL y migraciones
adaptadores/ 15 agentes y adaptadores IDE
skills-v2/ 128 técnicas profundas de contrato de habilidad v2
capacidades-v2/ resultados, técnicas, proveedores, relaciones, gráfico
esquemas/contratos públicos de esquema JSON 2020-12
paquetes/paquetes de capacidad vertical y puntos de referencia
evals/casos de evaluación, rúbricas y corpus
pruebas/ 125 archivos de prueba e invariantes de lanzamiento
Evidencia/auditoría generada, punto de referencia, SBOM y evidencia de tablero
documentos/arquitectura, protocolos, seguridad, pruebas, producción
scripts/herramientas de generación, validación, auditoría, evaluación comparativa y lanzamiento
```

# Casos de uso adecuados

- Hacer que los agentes codificadores sean más disciplinados y auditables.
- Construcción de un plano de control para varios modelos, agentes y herramientas.
- Operar una plataforma interna de habilidades con controles de enrutamiento y madurez.
- Revisión de configuraciones de agentes, permisos, indicaciones y superficies de la cadena de suministro.
- Flujos de trabajo regulados o de alta seguridad que requieren pruebas y puertas de aprobación.
- Reducir el desperdicio de contexto en grandes repositorios mediante el aislamiento de unidades de trabajo y ABI semántica.

ForgeOS no reemplaza la automatización del flujo de trabajo empresarial estilo n8n. n8n conecta aplicaciones y eventos empresariales; ForgeOS controla la selección, el contexto, la ejecución, la evidencia y la autoridad de las técnicas de IA. Se pueden utilizar juntos.

---

## Arquitectura

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

## Integración de agentes y MCP

ForgeOS habla MCP `2025-11-25`, A2A `1.0`, paquetes compatibles con Agent Skills, HTTP y CLI.

Las herramientas públicas v0.6 incluyen:

```text
forge_v06_status
forge_execution_graph_compile
forge_review_scope_compile
forge_context_work_units_compile
forge_harness_profile_plan
forge_agent_surface_scan
```

Se unen a las herramientas existentes de proyecto, artefacto, evidencia confiable, recuperación, federación, inteligencia de habilidades y corredor de MCP. Stdio, HTTP MCP, CLI y Studio comparten los mismos servicios y esquemas JSON.

Los paquetes de adaptadores compatibles incluyen ChatGPT, Codex, Claude Code, Cursor, OpenCode, Gemini CLI, Copilot CLI, Cline, Roo Code, Windsurf, Continuar, NolaneNative, OpenClaw, Pi y MCP/A2A genérico. La evidencia distingue los adaptadores **probados por protocolo** de las guías **solo con documentación**.

---

## Verificación

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

La puerta de liberación verifica el comportamiento y los contratos, no solo la cobertura de línea:

- invariantes de estado, vallado, a prueba de obsolescencia y ciclo de vida;
- ciclo de vida completo de MCP/A2A y esquemas de salida;
- profundidad de habilidad, texto estándar, hash de sección y materialización;
- precisión, recuperación, determinismo y activación insegura del enrutador;
- contabilidad de desbordes y omisiones del contexto global;
- libro mayor determinista de ejecución y cobertura;
- revisar anclajes y reflexiones;
- evaluación independiente y cuarentena de aprendizaje continuo;
- casos contradictorios en la superficie del agente;
- instalación de archivos y autoverificación sin `.git`.

---

## Límite de producción

**Integrado hoy**

- Backend de ciclo de vida de un solo nodo SQLite WAL;
- revisión/CAS, arrendamientos, vallas, instantáneas, restauración, ACL, clave OIDC/API;
- recibos confiables, hashes de sobres de artefactos, puertas de seguridad;
- federación de habilidades/conocimientos/MCP con ámbito de inquilino;
- drenaje elegante, preparación, métricas, procedencia de la versión firmada;
- perfiles de implementación no raíz/de solo lectura.

**Aún no es un reclamo v0.6**

- backend directo de PostgreSQL de ciclo de vida completo y conmutación por error de múltiples nodos probada;
- entorno de pruebas universal microVM de terceros;
- SCIM/administración de la organización delegada;
- servicio de transparencia gestionado y PKI;
- Transmisión/push A2A y currículum distribuido;
- 1.024 habilidades procesales de nivel de producción;
- 10.000 ejecuciones de evaluación pareadas;
- Punto de referencia de revisión de código en varios idiomas adjudicado por expertos.

Lea [Producción](docs/PRODUCTION.md), [Modelo de seguridad](docs/SECURITY-MODEL.md) y [Autoauditoría v0.6](docs/SELF-AUDIT-V0.6.md).

---

## Mapa de documentación

| Comience aquí | Buceo profundo |
|---|---|
| [Inicio rápido](docs/QUICKSTART.md) | [Arquitectura](docs/ARCHITECTURE.md) |
| [Inteligencia de habilidades](docs/SKILL-INTELLIGENCE.md) | [Tejido determinista v0.6](docs/DETERMINISTIC-SKILL-FABRIC-V06.md) |
| [CLI y perfiles](docs/HARNESS-RUNTIME-V2.md) | [Núcleo de contexto global](docs/GLOBAL-CONTEXT-KERNEL.md) |
| [Seguridad](docs/AGENT-SURFACE-SECURITY.md) | [Aprendizaje continuo](docs/CONTINUOUS-LEARNING-V06.md) |
| [Pruebas](docs/TESTING.md) | [Límite de reclamaciones](docs/CLAIMS-BOUNDARY-V0.6.md) |
| [Contribuyendo](CONTRIBUTING.md) | [Autoauditoría](docs/SELF-AUDIT-V0.6.md) |

---

## Idiomas

[Universal Lanes](docs/UNIVERSAL-LANES.md) · [Remote MicroVM Sandbox](docs/REMOTE-MICROVM-SANDBOX.md) · [Tiếng Việt](README-vn.md) · [简体中文](README-cn.md) · [繁體中文](README-tw.md) · [日本語](README-ja.md) · [한국어](README-ko.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Português](README-pt-br.md) · [Русский](README-ru.md) · [العربية](README-ar.md) · [हिन्दी](README-hi.md) · [Bahasa Indonesia](README-id.md) · [ไทย](README-th.md) · [Türkçe](README-tr.md) · [Italiano](README-it.md) · [Polski](README-pl.md) · [Українська](README-uk.md) · [Nederlands](README-nl.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [Svenska](README-sv.md)

---

## Contribuyendo

No se acepta una nueva habilidad porque su prosa parezca experta. Necesita:

1. una línea de base ROJA que falla sin la técnica;
2. disparadores y antidisparadores precisos;
3. un procedimiento de dominio específico y un modelo de falla;
4. entradas, salidas, herramientas y pruebas mecanografiadas;
5. hashes de sección y presupuestos de tokens;
6. vinculaciones de evaluador independiente;
7. evidencia de referencia y una decisión de vencimiento.

Consulte [CONTRIBUCIÓN.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) y [SECURIDAD.md](SECURITY.md).

## Licencia

MIT: consulte [LICENCIA](LICENSE).


## Auditorías de lanzamiento final

- [Informe de endurecimiento final](docs/FINAL-HARDENING-REPORT.md)
- [Auditoría de certificación de habilidades finales](docs/FINAL-CERTIFICATION-AUDIT.md)
