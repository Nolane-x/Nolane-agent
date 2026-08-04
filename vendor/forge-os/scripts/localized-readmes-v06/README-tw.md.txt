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
<h1 align="center">ForgeOS </h1>
<p align="center"><strong>人工智慧代理的技能智慧型作業系統和信任控制平面。 </strong></p>
<p align="center">ForgeOS 決定 <strong> 可以運行哪些技能 </strong>、<strong> 可以進入哪些上下文 https://forgeos-<strong> 可以進入哪些上下文 https://forgeos-token.incoid/13、必須執行哪些步驟/valin. </strong> 和 <strong> 證據足夠強大以接受完成 </strong>.</p>

---

## 為什麼 ForgeOS 存在

代理不會因為有更多的提示、更多的工具或更長的上下文視窗而變得可靠。

當系統能夠回答六個問題時，它就變得可靠：

1. **需要什麼具體結果？ **
2. **哪一種技術是適當的，哪些類似的技術是錯誤的？ **
3. **此工作單元所需的最小上下文是什麼？ **
4. **哪些步驟必須是確定性的而不是委託給模型？ **
5. **什麼獨立證據證明了產出？ **
6. **同一工作流程在故障後能否自行恢復、復原和審核？ **

ForgeOS v0.6 將這些問題轉換為執行時間：

```text
確認意圖
  → 結果+技術檢索
  → 硬策略和反觸發過濾器
  → 最小 RoutePlan DAG
  → 每個工作單元隔離 ContextPack
  → 確定性/代理/反射執行圖
  → 錨定輸出+覆蓋分類賬
  → 可信收據+證據門
  → 發布、回滾、復原和學習隔離
```

它不是一個即時集合。它是圍繞著技能、規則、鉤子、代理、工具、背景、證據和學習的控制平面。

---

## v0.6.1 中的真實內容是什麼

|表面|驗證實施 |
|---|---:|
|傳統類型的結果支架 | **1,024** |
|深度技能合約 v2 技術 | **128** |
| L0 編排/信任/情境技術 | **32** |
| L1跨域工程技術| **96** |
|獨立評估者綁定 | **128** |
|穩定的程式提供者| **33** |
|候選程式提供者| **242** |
|內建技能+知識圖譜| **1,299** |
|代碼審查情報一致性案例| **12** |
|代理表面對抗案例 | **20/20** |
|穩定的提供者物化| **33/33** |
|路由器精度@1 / @3 | **93.75% / 100%** |
|路由器召回@6 | **100%** |
|不安全路由啟動| **0%** |

> [!重要]
> 1,024 個遺留節點是**結果支架**，而不是 1,024 個生產級程式技能。 v0.6包含128個深度技術合約。出於相容性考慮，33 個程式提供者仍保留在已聲明的穩定路由通道中，但最終認證審核發現 0/128 個證據合格的穩定供應商，以及 0 個根據修訂版 2 完成定義進行認證的提供者。剩下的證據需要堅持、配對多模型、壓力、獨立審查和生產收據。

**核心清單：** 32 個 L0 技術 + 96 個 L1 技術 = 128 個深度核心技術。

**目錄路由狀態：** 33 個已聲明的穩定頻道程式提供者和 242 個候選提供者。 **正式認證證據：** 0 個穩定合格，0 個已認證。請參閱[最終認證審核](docs/FINAL-CERTIFICATION-AUDIT.md)。

發布審核故意使這些聲明不真實：

```text
1,024 生產級程序技能錯誤
完整 PostgreSQL 生命週期 HA false
通用 microVM 沙箱 false
專家標記的 200-PR 審查基準錯誤
10,000 次配對評估結果為假
```

ForgeOS v0.6 並未聲稱具有通用生產完整性或 1,024 個生產級程序技能。

請參閱[聲明邊界 v0.6](docs/CLAIMS-BOUNDARY-V0.6.md)。

---

## 五分鐘路徑

當您想要價值而不先學習信任核心時，請使用此路徑。

### 1.安裝

```bash
npm install
npm test
node src/cli/forge.mjs init
```

安裝的套件：

```bash
npx forgeos init
forge doctor
```

`forge init` 建立安全的本機 SQLite-WAL 設定檔。其 API 金鑰寫入 `0600` 檔案並且永遠不會列印。

### 2.找到正確的技術

```bash
forge skills search "react rerender"
forge skills inspect reducing-react-render-thrashing
forge route --query "compile the minimum context for a large monorepo"
```

### 3. 檢查 v0.6

```bash
forge v06 status
forge profile plan coding --target codex
forge security scan --file agent-surface.json
```

### 4.啟動本機控制平面

```bash
npm start
# Dashboard: http://127.0.0.1:8787/dashboard
# MCP:       http://127.0.0.1:8787/mcp
# A2A:       http://127.0.0.1:8787/a2a
```

---

## 深度算子路徑

將 ForgeOS 嵌入 Codex、Claude Code、ChatGPT、開源代理、CI 或內部平台時，請使用此路徑。

###技能智慧路由器

路由器執行兩階段檢索而不是匹配技能名稱：

```text
意圖/失敗的門
  → 結果檢索
  → 直接技術觸發檢索
  → 反觸發排除
  → 信任、租戶、成熟度、工具、許可證、新鮮度過濾器
  → 測量效用重新排序
  → 最小技術 DAG
  → 提供者解析
  → 凍結路線計劃
```

每一種被選擇和被拒絕的技術都有一個原因。硬阻擋者總是能擊敗得分。

### 全域上下文核心 v2

ForgeOS 為完整的請求制定預算：

```text
系統·任務·選定的技能部分·代碼符號·工件
· 記憶體 · 工具輸出 · 參考資料 · 惰性工具模式
· 輸出儲備 · 安全儲備
```

它提供：

- 解析器和物化器共用一個代幣記帳介面；
- 章節級技能載入；
- 每個工作單元的獨立脈絡；
- 惰性工具模式物化；
- 語意 ABI 符號 ID 和過時雜湊拒絕；
- 偽影增量投影；
- 有範圍的、過期的本能注射；
- 內容尋址的原始日誌，包含經過提煉的故障範圍；
- 未包含的每個來源的遺漏清單。

### 確定性技能結構

v0.6 技術被編譯成可執行圖：

```text
確定性節點
  範圍選擇·捆綁·規則解析·錨定·證據

代理節點
  調查·假設·領域判斷

反射節點
  矛盾 · 誤報過濾 · 可操作性

控制節點
  並行連接·覆蓋門·重試·回滾
```

SQLite 覆蓋分類帳使用租約、心跳、隔離和可信任收據。回收的工作人員無法將工作單元標記為完成。

### 程式碼審查智慧垂直切片

第一個完整的垂直切片端到端地證明了這個架構：

```text
完整範圍
→ 關係意識工作單位
→ 上下文規則選擇
→ 孤立代理分析
→ 行/散列錨點
→ 編輯後搬遷
→ 獨立反思
→ 承保收據
```

捆綁的 12 個案例語料庫是一個確定性的一致性基準。它**不**被宣傳為專家標記的 200-PR 基準。

### 持續學習－不會自動自我中毒

觀察到的模式變成了有範圍的本能，而不是穩定的技能：

```text
可信運行收據
  → 觀察本能
  → 租戶/專案/線束隔離 + TTL
  → 相容本能簇
  → 候選進化提案
  → 獨立評估
  → 人為提升或回滾
```

生產者無法促進自己習得的行為。

### Harness Runtime v2

ForgeOS 區分四個表面：

|表面|用它來 |
|---|---|
| **規則** |必須永遠適用的短不變量 |
| **掛鉤** |與事件綁定的確定性操作 |
| **技能** |需要判斷的條件程序|
| **代理角色** |單獨的脈絡、工具、模型或權威 |

中立事件包括 `before.tool.execute`、`after.file.write`、`verification.checkpoint`、`session.compact` 與 `session.ended`。主機適配器必須標記不支援的功能，而不是聲明錯誤的奇偶校驗。

簡介：

```text
極簡 · 編碼 · 創意 · 研究 · 監管
地方小型·企業
```

### 特工表面安全

安全引擎掃描代理系統本身：

- 指示和提示邊界違規；
- 掛鉤和包生命週期腳本；
- MCP 描述、權限和工具可及性；
- 命令白名單；
- 秘密/環境參考；
- 秘密到出口的權限路徑；
- 管道到外殼和廣泛的通配符功能；
- 安裝前的設定檔權限差異。

其對抗性語料庫目前通過了 **20/20** 案例。

### 代理本地執行

本地運行器為正常命令提供了真正的安全邊界：

- 無外殼內插；
- 命令與環境白名單；
- 工作區和符號連結遏制；
- 超時和進程組終止；
- 有界的標準輸出/標準錯誤；
- 內容尋址的執行收據。

它**不是**通用的網路拒絕 microVM 沙箱。高風險的第三方執行仍然需要外部容器或microVM隔離層。

---


# ForgeOS 的工作原理

ForgeOS 在一個運行時中結合了兩種產品：

1. **技能智慧層**，用於檢索技術、拒絕不安全的近似匹配、僅編譯所需的技能部分並建立凍結的執行計劃。
2. **人工智慧控制平面**，用於管理專案、工件、證據、批准、租賃、恢復、聯合和發布門。

```text
已確認意圖或失敗的門
  → 結果和直接技術檢索
  → 反觸發、租戶、信任、工具、許可證和新鮮度過濾器
  → 最小凍結 RoutePlan DAG
  → 每個工作單元隔離 ContextPack
  → 確定性/代理/反射執行圖
  → 錨定輸出和圍籬覆蓋分類賬
  → 可信收據和保證感知門
  → 發布、復原、回滾或學習隔離
```

## 十大合作系統

|系統|它控制什麼 |
|---|---|
| **技能智慧路由器** |結果檢索、技術評分、反觸發、硬策略、提供者選擇和可解釋的路線計劃 |
| **全域情境核心 v2** |涵蓋政策、任務、技能部分、符號、工件、記憶體、工具輸出、參考和輸出儲備的一份總代幣預算 |
| **確定性技能結構** |包含確定性節點、代理節點、反射節點、批准、錨點和停止條件的混合圖 |
| **覆蓋分類帳** |工作單元所有權、租賃、隔離令牌、完成範圍、陳舊工作人員拒絕和可恢復性 |
| **信任核心** |證據新鮮度、工件譜系、批准權限、保證等級和發布決策 |
| **地面安全特工** |提示注入模式、危險的包腳本、秘密到出口路徑、權限和適配器能力誠實 |
| **代理本地執行** |無 shell 命令產生、許可名單、逾時、輸出限制和結構化收據 |
| **持續學習** |範圍本能、到期、信心、隔離、候選人提案和受控晉升 |
| **技能聯盟** |簽署來源、信任層、隔離、衝突處理、撤銷與同步目錄 |
| **利用運行時 v2** |不同人工智慧工具的規則、掛鉤、技能、代理角色、權限差異和設定檔 |

---

# 生態係比較

> [!重要]
> 此比較描述了**每個核心儲存庫的本機、一流焦點**。 `◐` 表示部分支援、基於擴充的支援或透過鄰近產品的支援。 `—` 意味著它不是該專案的主要焦點，並不是說它不可能建置。

下面的 GitHub 星數是在 **2026 年 7 月 26 日**檢查的大概數字。它們表明了社區的可見性，而不是其本身的工程品質。

## 生態系地圖

|項目|大約。 GitHub 星星 |主要角色 |
|---|---:|---|
| [超能力](https://github.com/obra/superpowers) | **255k** |代理技能框架和软件开发方法|
| [人择代理技能](https://github.com/anthropics/skills) | **151k** |克劳德的技能标准和公共技能库|
| [LangChain](https://github.com/langchain-ai/langchain) | **139k** |代理工程平台及大整合生態系|
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) | **75k+** |端到端软件开发代理应用程序|
| [CrewAI](https://github.com/crewAIInc/crewAI) | **56k+** |多代理人员和事件驱动的流程 |
| [AutoGen](https://github.com/microsoft/autogen) | **5万+** |多代理消息传递和研究运行时 |
| [LangGraph](https://github.com/langchain-ai/langgraph) | **37k+** |有状态、长期运行的代理图 |
| [语义内核](https://github.com/microsoft/semantic-kernel) | **28k+** |多语言企业编排SDK |
| [超棒特工技能](https://github.com/VoltAgent/awesome-agent-skills) | **28k+** |千余种技能的社区目录|
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | **27k+** |代理、切换、护栏、会话和跟踪 |
| [smolagents](https://github.com/huggingface/smolagents) | **27k+** |强调代码代理的最小代理库 |
| [莱塔](https://github.com/letta-ai/letta) | **23k+** |有状态代理和持久内存|
| [Google ADK](https://github.com/google/adk-python) | **约20k** |代码优先代理构建、评估和部署 |
| [PydanticAI](https://github.com/pydantic/pydantic-ai) | **约19k** |类型安全的Python代理框架|

## 核心能力矩陣

|系統|打包技能|路由+反觸發|受控環境 |確定性/代理混合圖 |證據+信託收據|代理面安全|原生實力|
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **ForgeOS** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |技能情報和值得信賴的執行力 |
|人類技能 | ✅ | ◐ | ◐ | — | — | ◐ |簡單、便攜的技能標準|
|超能力| ✅ | ✅ | ◐ | ◐ | ◐ | — |編碼代理的高度明確的 SDLC 方法 |
|令人敬畏的代理技能| ✅ | — | — | — | — | ◐ |跨多種來源的技能發現 |
|浪鏈 | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |超龐大的整合生態系|
|郎圖| ◐ | ◐ | ◐ | ✅ | ◐ | ◐ |持久執行與有狀態圖 |
| OpenAI 代理 SDK | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |輕量級框架、切換與追蹤 |
|船員人工智慧 | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ |基於角色的代理與 Flows 結合 |
| AutoGen | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ |事件驅動的多代理執行時間 |
|語意核心/MAF | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ |跨運行時的企業編排|
|Google ADK | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ |在 Google 生態系統中建置、評估與部署 |
| PydanticAI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | 類型安全、驗證與 Python 人體工學 |
|煙熏劑| ◐ | ◐ | ◐ | ◐ | — | ◐ |最小的、可讀的代理實現 |
|萊塔| ◐ | ◐ | ✅ | ◐ | ◐ | ◐ |持久記憶體與有狀態代理|
|張開雙手 | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ |端對端編碼代理體驗 |

## ForgeOS 選擇不同的戰場

技能庫回答：**「代理可以學習哪些程式？」**

ForgeOS 也詢問：**「現在允許使用哪種技術，必須拒絕哪些近似匹配，哪些部分可以進入上下文，需要哪些工具，必須提供哪些證據，以及什麼門可以宣布工作完成？」**

代理框架有助於建立代理、工具、切換和工作流程。 ForgeOS 專注於運行時周圍的層：能力檢索、反觸發、全局上下文預算、確定性/代理/反射圖、當前證據、批准權限、工件沿襲、恢復和學習隔離。

記憶系統專注於智能體記住的內容。 ForgeOS 也控制記憶體所屬的租用戶、項目、使用者、信任域、到期時間、置信度和升級策略。

端到端編碼代理提供使用者體驗。 ForgeOS 可以在該代理的**下方或旁邊**運行，作為技能選擇、上下文治理、證據、信任和專案生命週期層。

## 成熟的生態系仍處於領先地位

他們目前擁有更大的社群、更多的教學和整合、更完善的託管雲端體驗、更強大的無程式碼入門以及更公開記錄的生產部署。 ForgeOS 故意專注於一個不太標準化的問題：**控制 AI 代理的技能選擇、上下文、證據、權威和完成狀態**。

---

# 三個入口路徑

## 對於日常用戶

您不需要了解每個子系統。從四個可觀察的測試開始：

```bash
node src/cli/forge.mjs doctor
node src/cli/forge.mjs skills search --query "review authentication changes"
node src/cli/forge.mjs route --query "review authentication changes without missing tests"
node src/cli/forge.mjs scan agent-surface --path .
```

您可以檢查選擇了哪種技術、為什麼拒絕替代方案、編譯了多少上下文、請求了哪些權限以及仍然缺少哪些證據。

## 對於開發者

ForgeOS 透過以下方式公開相同的執行階段：

- 用於本地操作和 CI 的 CLI；
- HTTP API 和 Studio 儀表板；
- **60 個模式嚴格的 MCP 工具**；
- A2A 任務和代理卡介面；
- 從 Node.js 來源樹直接導入服務；
- **15 個適配器**，用於代理和 IDE 生態系統；
- 七個線束設定檔：`minimal`、`coding`、`creative`、`research`、`regulated`、https://forgeken-token/3、`regulated`、https://forgeken-tokenin.

開發人員可以建立專案、註冊工件、綁定證據、請求批准、編譯 RoutePlan 和 ContextPack、執行圖表、恢復修訂、同步聯合技能或新增新的技能合約 v2。

## 對於專家和研究人員

ForgeOS 的設計宗旨是接受挑戰，而不是從行銷頁面接受。專家可以獨立測試：

- 路由器精確度、召回率、反觸發行為和不安全啟動；
- 總上下文溢出和語義 ABI 減少；
- 確定性覆蓋、錨定、反射、租賃和隔離；
- 證據新鮮度、工件譜系和保證感知門；
- 提示注入、打包腳本、秘密到出口路徑和適配器誠實；
- 聯盟衝突、隔離、撤銷和來源信任；
- 沒有 `.git` 的檔案驗證。

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

# 儲存庫映射

```text
src/運行時實現
  cli/ forge 命令列介面
  核心/專案、工件、證據、批准、恢復
  技能情報/合約、路線、評估、物化
  context/ 全域上下文 核心與工作單元編譯
  執行/圖形編譯器、確定性節點、覆蓋率
  信任/證據、保證、權威、釋放門
  安全/代理表面掃描和命令代理
  聯合/遠端來源、信任、隔離、同步
  學習/直覺、候選人、到期、晉升
  mcp/MCP伺服器和58個公共工具
  a2a/ A2A 卡片、任務、訊息和收據
  伺服器/ HTTP API、驗證、儀表板
  儲存/ SQLite-WAL 持久化和遷移
適配器/ 15 個代理程式和 IDE 適配器
Skills-v2/ 128 種深度技能合約 v2 技術
能力-v2/結果、技術、提供者、關係、圖表
schemas/公用 JSON Schema 2020-12 合約
包/垂直功能包和基準
評估/評估案例、量規和語料庫
測試/ 125 個測試檔案和發布不變量
證據/產生的稽核、基準、SBOM 和儀表板證據
文件/架構、協定、安全性、測試、生產
腳本/產生、驗證、稽核、基準測試和發布工具
```

# 合適的用例

- 使編碼代理更加規範和可審計。
- 為多個模型、代理和工具建立控制平面。
- 經營具有路由和成熟度控制的內部技能平台。
- 檢查代理程式配置、權限、提示和供應鏈介面。
- 需要證據和批准門的高保證或受監管的工作流程。
- 透過工作單元隔離和語義 ABI 減少大型儲存庫中的上下文浪費。

ForgeOS 並不是 n8n 式業務工作流程自動化的替代品。 n8n 連接應用程式和業務事件； ForgeOS 控制 AI 技術的選擇、上下文、執行、證據和權限。它們可以一起使用。

---

＃＃ 建築學

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

## MCP 和代理集成

ForgeOS 支援 MCP `2025-11-25`、A2A `1.0`、代理技能相容套件、HTTP 和 CLI。

v0.6 公共工具包括：

```text
forge_v06_status
forge_execution_graph_compile
forge_review_scope_compile
forge_context_work_units_compile
forge_harness_profile_plan
forge_agent_surface_scan
```

它們加入了現有的專案、工件、可信證據、恢復、聯合、技能智慧和 MCP 代理工具。 Stdio、HTTP MCP、CLI 和 Studio 共享相同的服務和 JSON 架構。

支援的適配器包包括 ChatGPT、Codex、Claude Code、Cursor、OpenCode、Gemini CLI、Copilot CLI、Cline、Roo Code、Windsurf、Continue、NolaneNative、OpenClaw、Pi 和通用 MCP/A2A。證據將**經過協議測試的**適配器與**僅文檔**指南區分開來。

---

＃＃ 確認

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

發布門檢查行為和契約，而不僅僅是線路覆蓋範圍：

- 狀態、隔離、防過時和生命週期不變量；
- 完整的 MCP/A2A 生命週期和輸出模式；
- 技能深度、樣板、部分哈希和具體化；
- 路由器精確度、召回率、確定性和不安全啟動；
- 全域上下文溢位和遺漏核算；
- 確定性執行和覆蓋分類帳；
- 回顧錨點和反思；
- 獨立評估和持續學習隔離；
- 代理表面對抗案例；
- 檔案安裝和自我驗證，無需 `.git`。

---

## 生產邊界

**今天整合**

- SQLite WAL單節點生命週期後端；
- 修訂/CAS、租約、防護、快照、復原、ACL、OIDC/API 金鑰；
- 可信賴收據、工件信封雜湊、保證感知門；
- 租戶範圍的技能/知識/MCP 聯盟；
- 優雅的流失、準備、指標、簽名的發布來源；
- 非根/唯讀部署設定檔。

**尚未 v0.6 聲明**

- 全生命週期 PostgreSQL 嵌入式後端和經過測試的多節點故障轉移；
- 通用第三方microVM沙箱；
- SCIM/委託組織管理；
- 託管透明度服務和 PKI；
- A2A串流媒體/推播和分散式履歷；
- 1,024 種生產級程序技能；
- 10,000 次配對評估運行；
- 專家裁定的跨語言代碼審查基準。

閱讀[生產](docs/PRODUCTION.md)、[安全模型](docs/SECURITY-MODEL.md)和[Self-Audit v0.6](docs/SELF-AUDIT-V0.6.md)。

---

## 文檔圖

|從這裡開始 |深潛|
|---|---|
| [快速入門](docs/QUICKSTART.md) | [架構](docs/ARCHITECTURE.md) |
| [技能情報](docs/SKILL-INTELLIGENCE.md) | [確定性結構 v0.6](docs/DETERMINISTIC-SKILL-FABRIC-V06.md) |
| [CLI 與設定檔](docs/HARNESS-RUNTIME-V2.md) | [全域上下文核心](docs/GLOBAL-CONTEXT-KERNEL.md) |
| [安全](docs/AGENT-SURFACE-SECURITY.md) | 【持續學習】(docs/CONTINUOUS-LEARNING-V06.md) |
| [測試](docs/TESTING.md) | [索賠邊界](docs/CLAIMS-BOUNDARY-V0.6.md) |
| [貢獻](CONTRIBUTING.md) | [自我審核](docs/SELF-AUDIT-V0.6.md) |

---

## 語言

[Universal Lanes](docs/UNIVERSAL-LANES.md) · [Remote MicroVM Sandbox](docs/REMOTE-MICROVM-SANDBOX.md) · [Tiếng Việt](README-vn.md) · [简体中文](README-cn.md) · [繁體中文](README-tw.md) · [日本語](README-ja.md) · [한국어](README-ko.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Português](README-pt-br.md) · [Русский](README-ru.md) · [العربية](README-ar.md) · [हिन्दी](README-hi.md) · [Bahasa Indonesia](README-id.md) · [ไทย](README-th.md) · [Türkçe](README-tr.md) · [Italiano](README-it.md) · [Polski](README-pl.md) · [Українська](README-uk.md) · [Nederlands](README-nl.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [Svenska](README-sv.md)

---

## 貢獻

一項新技能不被接受，因為它的散文聽起來很專業。它需要：

1. 沒有該技術就失敗的 RED 基線；
2.精確的觸發和反觸發；
3. 特定領域的程序和故障模型；
4. 輸入、輸出、工具和證據；
5. 部分哈希值和代幣預算；
6. 獨立評估者綁定；
7. 基準證據和成熟度決策。

請參閱 [CONTRIBUTING.md](CONTRIBUTING.md)、[GOVERNANCE.md](GOVERNANCE.md) 和 [SECURITY.md](SECURITY.md)。

＃＃ 執照

麻省理工學院 — 請參閱[許可證](LICENSE)。


## 最終發布審核

- [最終強化報告](docs/FINAL-HARDENING-REPORT.md)
- [最終技能認證審核](docs/FINAL-CERTIFICATION-AUDIT.md)
