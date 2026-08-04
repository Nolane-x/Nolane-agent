# ForgeStudio 3.0.0 — UI/UX Master Architecture & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tái kiến trúc toàn bộ giao diện ForgeStudio 3.0.0 thành một sản phẩm AI-agent cao cấp, trang trọng, dễ dùng ở tầng ngoài, cực sâu ở tầng quản trị, nhưng nhẹ và phản hồi nhanh hơn đáng kể so với các desktop agent nặng.

**Architecture:** ForgeStudio 3.0.0 dùng kiến trúc hai tầng rõ ràng. **Tầng 1 — Forge Workspace** là mặt làm việc hằng ngày, chỉ hiển thị nhiệm vụ, hội thoại, hoạt động, sản phẩm đầu ra, review và workroom khi cần. **Tầng 2 — Forge Control Plane** chứa toàn bộ runtime, context, memory, evidence, repository intelligence, trust, governance, agent modes, local operations và nghiên cứu; nó được tải lười, truy cập có chủ đích và không làm nặng shell chính.

**Tech Stack:** Electron hiện có; HTML semantic; CSS cascade layers + design tokens; JavaScript ESM thuần; `esbuild` hoặc `rollup` chỉ ở bước build để bundle/code-split, không thêm framework runtime; Monaco và xterm tải lười; Web Worker cho diff/graph/search nặng; Node.js test suite hiện có; Chromium DevTools Performance/Memory; Playwright chỉ dùng cho kiểm thử ảnh và luồng nếu runtime dự án đã cung cấp.

## Global Constraints

- Không viết lại ForgeStudio bằng React, Vue hoặc framework UI có virtual DOM trong đợt 3.0.0.
- Không xóa bất kỳ năng lực kỹ thuật nào đang tồn tại ở 2.22.0; chỉ đổi vị trí, phân cấp và cách trình bày.
- Tầng 1 phải dùng được mà người dùng không cần hiểu `lease`, `receipt`, `context packet`, `instruction precedence`, `runtime fabric` hay `evidence graph`.
- Tầng 2 phải giữ đủ dữ liệu, bằng chứng, trạng thái và quyền kiểm soát cho nhà nghiên cứu, quản trị viên và người phát triển ForgeStudio.
- Không có animation thiết yếu nào phụ thuộc vào `filter`, `backdrop-filter`, thay đổi `width/height/top/left`, hoặc shadow lớn theo từng frame.
- Mọi chuyển động phải có chế độ `prefers-reduced-motion` và không được làm chậm thao tác.
- Không dùng asset, font hoặc script mạng trong renderer; mọi tài nguyên phải nằm trong gói cài đặt.
- Không hiển thị phần trăm tiến độ giả. Chỉ hiển thị phần trăm khi backend có tổng công việc đo được.
- Không để một lỗi của Control Plane làm hỏng Forge Workspace.
- Tất cả thay đổi UI phải qua kiểm thử keyboard, contrast, responsive, memory, idle CPU, long task và visual regression.
- Giao diện 3.0.0 chỉ bắt đầu triển khai sau khi capability inventory của nhánh tính năng gần hoàn tất; trước đó chỉ duy trì tài liệu này và sổ đăng ký UI contract.

---

## 0. Quyết định sản phẩm

### 0.1. Định vị mới

ForgeStudio không nên tự định vị là “một IDE có thêm AI” và cũng không nên biến thành “một dashboard quản trị agent”. Định vị đúng là:

> **ForgeStudio là một command workspace cho AI engineering: đơn giản để giao việc, rõ ràng để giám sát, nghiêm ngặt để kiểm chứng và đủ sâu để quản trị toàn bộ hệ thống agent local.**

Giá trị triệu đô không đến từ nhiều gradient, glassmorphism hay animation. Nó đến từ bốn cảm giác nhất quán:

1. **Quiet authority — uy quyền tĩnh:** mọi thứ điềm tĩnh, chắc chắn, không phô diễn công nghệ vô ích.
2. **Legible intelligence — trí tuệ có thể đọc được:** người dùng luôn hiểu agent đang ở đâu, vừa làm gì, cần gì và tạo ra kết quả nào.
3. **Controlled depth — chiều sâu có kiểm soát:** hệ thống rất sâu nhưng không đổ toàn bộ độ phức tạp lên người dùng bình thường.
4. **Mechanical confidence — cảm giác cơ khí chính xác:** nút, panel, diff, permission và trạng thái phản hồi tức thì, không mơ hồ, không nhảy layout.

### 0.2. Kiến trúc hai tầng là quyết định bắt buộc

#### Tầng 1 — Forge Workspace

Dành cho:

- Người bình thường muốn yêu cầu AI xây/sửa/nghiên cứu một thứ.
- Lập trình viên muốn chạy nhiều nhiệm vụ, theo dõi agent, review diff và ship.
- Người dùng local muốn một trải nghiệm gần Codex, Claude Code Desktop, Cursor Agents, Copilot App, Qoder Quest hoặc CodeBuddy Agents.

Chỉ có bảy khu vực chính:

1. Home / New Mission.
2. Tasks / Sessions.
3. Mission Workspace.
4. Review & Ship.
5. Workroom.
6. Search / Command Palette.
7. Settings cơ bản.

#### Tầng 2 — Forge Control Plane

Dành cho:

- Người phát triển ForgeStudio.
- Người nghiên cứu agent.
- Người quản trị runtime, quyền, evidence và chính sách.
- Người cần điều tra tại sao agent ra quyết định, dùng context nào hoặc vi phạm guardrail nào.

Bao gồm:

1. System Overview.
2. Agent Operations.
3. Runtime & Sandboxes.
4. Context & Memory.
5. Evidence & Trace.
6. Repository Intelligence.
7. Codebase Knowledge.
8. Trust, Secrets & Permissions.
9. Git & Instruction Governance.
10. Models, Providers, Skills & Plugins.
11. Local Operations & Human Control.
12. Autonomy, Agent Modes & Mission State.
13. Benchmarks, Experiments & Diagnostics.
14. Release, Update & Recovery.

Tầng 2 **không phải drawer chứa mọi thứ**. Nó là một ứng dụng quản trị nằm trong cùng shell, có navigation riêng, route riêng, lazy chunk riêng và khả năng quay lại nhiệm vụ chỉ bằng một thao tác.

### 0.3. Điều không được làm

- Không đặt 16 biểu tượng kỹ thuật lên icon rail chính.
- Không biến Home thành dashboard KPI.
- Không để terminal/editor luôn được khởi tạo dù người dùng không mở.
- Không dùng hình cầu AI, hạt sáng, quỹ đạo, grid sci-fi chạy liên tục trên màn hình làm việc.
- Không đưa toàn bộ tool call thô vào hội thoại mặc định.
- Không dùng nhiều tab ngang trong mọi center; Control Plane cần navigation phân cấp.
- Không cho mỗi center một style riêng như một sản phẩm khác nhau.
- Không “làm đẹp” bằng blur dày, shadow khổng lồ hoặc gradient tím/xanh ở mọi card.
- Không tạo cảm giác agent đang làm việc bằng animation giả khi backend im lặng.
- Không ép người dùng chọn giữa hàng chục agent mode trước khi gửi nhiệm vụ.

---

# Phần I — Nghiên cứu và kiểm toán

## 1. Phương pháp nghiên cứu nhiều vòng

Tài liệu này được xây theo năm vòng, mỗi vòng bổ sung một lớp quyết định khác nhau:

### Vòng A — Đọc mã nguồn ForgeStudio 2.22.0

Đã kiểm tra trực tiếp:

- `package.json` và script chạy/build/test.
- `ui/index.html` để lập bản đồ shell, dialog, task view, inspector và advanced drawer.
- `ui/app.js` để hiểu state, route, lazy import, SSE refresh và render pipeline.
- Toàn bộ `ui/*-center.js` và `ui/*-center.css` để phân loại 16 trung tâm kỹ thuật.
- `ui/workroom.js`, `ui/goal-os.js`, `ui/diff-review-center.js` và provider UI.
- Test suite về lazy loading, accessibility, reduced motion, UI wiring và performance.
- Electron shell để xác nhận renderer local, sandbox và lifecycle cửa sổ.

### Vòng B — So sánh sản phẩm agent toàn cầu

Đã nghiên cứu tài liệu chính thức của:

- OpenAI Codex App.
- Claude Code Desktop và IDE integration.
- Cursor Agents Window.
- GitHub Copilot App / agent sessions.
- Windsurf Cascade và Agent Command Center.
- Kiro Specs.
- Zed Agent Panel.
- Replit Agent checkpoints/preview.

### Vòng C — So sánh sản phẩm Trung Quốc

Đã nghiên cứu tài liệu chính thức của:

- Qoder Quest.
- Tencent CodeBuddy Agents.
- Alibaba Lingma IDE.
- TRAE SOLO.

Mục tiêu không phải sao chép hình thức, mà tìm các mẫu đã hội tụ ở nhiều thị trường độc lập.

### Vòng D — Thiết kế hệ thống và HCI

Đã tham khảo:

- `ui-ux-pro-max-skill`, đặc biệt kiến trúc token ba tầng và checklist anti-pattern.
- Microsoft Guidelines for Human-AI Interaction.
- Progressive disclosure cho hệ thống phức tạp.
- Nghiên cứu oversight, transparency và trust trong multi-agent systems.
- WCAG 2.2 và reduced-motion practices.

### Vòng E — Hiệu năng Electron và motion

Đã đối chiếu:

- Khuyến nghị hiệu năng chính thức của Electron.
- Composite-only animations với `transform` và `opacity`.
- List virtualization, DOM containment, idle scheduling và worker offload.
- Tình trạng hiện tại của ForgeStudio: lazy center imports đã tốt, nhưng render theo snapshot và style riêng từng center có nguy cơ gây chi phí lớn khi quy mô tiếp tục tăng.

---

## 2. Kiểm toán ForgeStudio 2.22.0 từ source

### 2.1. Nền tảng hiện tại

ForgeStudio 2.22.0 là Electron app với UI HTML/CSS/JavaScript ESM thuần. Mô tả package là “Obsidian-inspired chat-first autonomous coding agent governed by ForgeOS”. Đây là nền tảng phù hợp để làm giao diện nhẹ: không có framework runtime lớn, các center đã dùng dynamic import và Monaco/xterm được đặt trong workroom kỹ thuật.

Các điểm mạnh cần giữ:

- Shell desktop rõ ràng.
- Chat-first và mission-first.
- Project switcher và lịch sử nhiệm vụ.
- SSE/refresh coalescer.
- Lazy-loading các trung tâm kỹ thuật.
- Inspector đã có Preview, Goal OS, Plan, Changes, Tests.
- Diff review đã hỗ trợ quyết định theo hunk.
- Runtime profile `lite`, giới hạn agent/terminal/editor model.
- Test suite lớn, trong đó có nhiều UI release gate.
- `prefers-reduced-motion` đã được kiểm tra ở nhiều module.
- Electron sandbox và runtime utility process là nền tốt cho độ ổn định.

### 2.2. Bản đồ UI hiện tại

Shell chính dùng ba cột:

```text
52 px icon rail | 272 px history/project sidebar | main stage
```

Task view tiếp tục chia thành:

```text
conversation/activity | contextual inspector
```

Các surface chính hiện có:

- Home composer: “Bạn muốn Forge xây gì?”.
- Recent runs.
- Project/provider/settings/command/plugin dialogs.
- Task status, message list, failure card.
- Live operation grid.
- Activity timeline.
- Follow-up composer.
- Inspector: Preview / Goal OS / Plan / Changes / Tests.
- Advanced drawer: Files / Editor / Terminal / Credential Vault / Signed Update / Project Rules / Browser Agent / Plugin Center.
- 16 technical centers được đăng ký trong `CENTER_SPECS`.

### 2.3. Vấn đề cấu trúc lớn nhất

`CENTER_SPECS` cho thấy ForgeStudio hiện có các center:

- Integrated Browser.
- Secrets.
- Runtime.
- Sandbox.
- Workspace Trust.
- Agent Operations.
- Context & Memory.
- Trace & Evidence.
- Repository Intelligence.
- Codebase Knowledge.
- Local Operations.
- Evidence Runtime.
- Git Governance.
- Instruction Governance.
- Agent Modes.
- Mission State.

Tất cả đều là chức năng có giá trị. Vấn đề không nằm ở số lượng chức năng, mà ở việc chúng đang được mô hình hóa như các đích điều hướng ngang hàng với Home/Task. Điều này làm người dùng cảm thấy sản phẩm là một bộ console kỹ thuật thay vì một agent workspace.

**Quyết định 3.0.0:** giữ nguyên capability, thay đổi information architecture. Chỉ một biểu tượng “Control Plane” xuất hiện ở rail tầng 1; 16 center được gom thành 8–14 route có cấu trúc bên trong tầng 2.

### 2.4. Vấn đề advanced drawer

Advanced drawer hiện chứa đồng thời:

- File tree.
- Editor.
- Terminal.
- Credential vault.
- Update manager.
- Project instructions.
- Browser agent.
- Plugin center.

Đây là bốn loại công việc khác nhau:

1. **Workroom:** file/editor/terminal.
2. **Trust & secrets:** credential.
3. **System maintenance:** update.
4. **Tools & extensibility:** browser/plugin.

Đặt chúng trong cùng drawer làm tăng DOM, tải nhận thức và khó quản lý responsive. 3.0.0 phải tách:

- Workroom thành surface tầng 1 có thể mở/đóng.
- Browser xuất hiện như artifact/tool pane của nhiệm vụ.
- Vault, update, rules và plugins vào Control Plane.

### 2.5. Vấn đề render và mở rộng

`app.js` hiện render snapshot theo nhiều vùng: messages, failure, live operation, activities, review, inspector và header. Cách này đủ cho 2.22.0, nhưng khi activity, subagent, evidence và diff tăng, việc thay toàn bộ `innerHTML` của các vùng lớn sẽ gây:

- Mất selection/focus nếu cập nhật không cẩn thận.
- Tạo nhiều node rác và garbage collection.
- Khó giữ scroll ổn định.
- Khó animation theo item.
- Khó virtualize timeline.
- Khó cập nhật 1 Hz hoặc nhanh hơn mà vẫn giữ input mượt.

3.0.0 không cần virtual DOM; chỉ cần chuyển sang **state slices + keyed incremental DOM**:

- Header chỉ cập nhật text/status thay đổi.
- Activity append/patch theo `activity.id`.
- Message append/stream theo `message.id`.
- Inspector route không rerender nếu snapshot không thay đổi phần đó.
- Dữ liệu lớn dùng virtual list hoặc pagination.

### 2.6. Vấn đề style fragmentation

Một số center dùng ngôn ngữ “futuristic” riêng với:

- Radial gradient nhiều lớp.
- Grid nền.
- Orbit animation.
- Backdrop blur.
- Shadow sâu.
- Card hover translate.

Trong khi shell chính lại tối giản kiểu Obsidian. Kết quả là mỗi center có thể đẹp riêng nhưng tổng thể thiếu một hệ thống cao cấp duy nhất.

3.0.0 dùng một design language chung. Các center chỉ khác **mật độ dữ liệu và loại visualization**, không khác thương hiệu.

### 2.7. Tài sản kỹ thuật đáng bảo vệ

Không được phá các điểm hiện đã tốt:

- Lazy dynamic imports.
- Test release gates cho từng center.
- Runtime performance profiles.
- Reduced effects.
- Security boundaries của Electron.
- Local-only asset strategy.
- Diff review theo hunk và evidence.
- Mission/Goal OS durable state.
- Resource Fabric, receipts và governance.

Tái thiết kế phải là **re-composition**, không phải rewrite tùy hứng.

---

## 3. Benchmark UI agent toàn cầu và Trung Quốc

### 3.1. Mẫu hội tụ số 1: nhiều session/agent, nhưng mỗi session vẫn đơn giản

Codex App, Cursor Agents Window, Copilot App, Claude Code Desktop, Qoder Quest, CodeBuddy và Windsurf đều đang tiến về mô hình:

- Danh sách nhiệm vụ/session ở bên trái.
- Không gian cộng tác chính ở giữa.
- Artifacts, changes, preview hoặc context ở bên phải.
- Mỗi nhiệm vụ có workspace/worktree/sandbox riêng.
- Người dùng có thể chuyển nhiệm vụ mà không mất context.

**Bài học cho ForgeStudio:** Home không phải nơi để đặt mọi dashboard. Sidebar nhiệm vụ và task workspace mới là xương sống.

### 3.2. Mẫu hội tụ số 2: agent-first, IDE-depth on demand

Cursor 3.0 mô tả Agents Window là giao diện “centered around agents” nhưng vẫn giữ chiều sâu môi trường phát triển và cho phép chuyển lại IDE. TRAE SOLO cũng hợp nhất editor/browser/terminal/docs nhưng có mode code tối giản. Claude Code Desktop cho kéo thả pane, terminal/editor tích hợp và side chat, nhưng người dùng không bị buộc nhìn chúng mọi lúc.

**Bài học:** ForgeStudio không nên chọn giữa “chat app” và “IDE”. Nó cần một workspace agent-first, với Workroom mở ra khi nhiệm vụ thật sự cần code-level control.

### 3.3. Mẫu hội tụ số 3: right context panel là nơi chứa kết quả, không phải nơi chứa menu hệ thống

Qoder Quest dùng ba cột; vùng phải là summary, review, files, terminal, browser, spec. CodeBuddy cũng mô tả context area chứa artifacts, all files, changes và preview. Đây là một quy luật mạnh:

> Vùng phải phải trả lời “nhiệm vụ này tạo ra gì?” chứ không trả lời “sản phẩm có bao nhiêu hệ thống?”.

Inspector hiện tại của ForgeStudio đã gần đúng. 3.0.0 cần nâng nó thành **Artifact Dock** với route theo context, tab ít hơn và summary tốt hơn.

### 3.4. Mẫu hội tụ số 4: review là trung tâm của niềm tin

Codex cho review diff trong thread và comment trên diff. Claude Code Desktop có visual diff và inline comments. Copilot tập trung session output/review/PR. Qoder cho review/reject file và commit/push/PR. Lingma làm rõ scope khi revert. Replit dùng checkpoint và rollback.

**Bài học:** Review & Ship phải là giai đoạn chính thức, không chỉ là một tab phụ. Người dùng phải thấy:

- Tổng quan thay đổi.
- File/hunk diff.
- Test evidence.
- Risk summary.
- Preview/screenshot.
- Accept/reject/request-change.
- Commit/branch/PR hoặc apply local.
- Rollback scope trước khi xác nhận.

### 3.5. Mẫu hội tụ số 5: plan có artifact bền vững

Windsurf Plan Mode tạo Markdown plan có nút Implement. Kiro Specs tạo requirements/design/tasks artifacts. ForgeStudio đã có Goal OS và plan history, mạnh hơn về chiều sâu nhưng presentation còn kỹ thuật.

**Bài học:** Tầng 1 chỉ hiển thị một `Plan Card` rõ ràng:

- Mục tiêu.
- Phạm vi.
- Các bước.
- Rủi ro.
- File dự kiến.
- Nút Approve / Revise / Start.

Lịch sử plan, discovery evidence và mission graph nằm trong phần chi tiết hoặc Control Plane.

### 3.6. Mẫu hội tụ số 6: trạng thái “Action Required” nổi bật hơn log

Qoder dùng trạng thái Running / Action Required / Ready / Error và board toàn cục. Copilot có live logs và khả năng steer. Claude Code hiển thị permission pending/finished. Trong một agent app, tín hiệu quan trọng nhất không phải “bao nhiêu token”, mà là:

- Tôi có cần làm gì ngay không?
- Agent có bị chặn không?
- Kết quả đã sẵn sàng để review chưa?

**Bài học:** ForgeStudio cần task status taxonomy chuẩn, thống nhất toàn sản phẩm:

```text
Draft → Planning → Awaiting Approval → Running → Needs Input
→ Reviewing → Ready to Ship → Completed
                         ↘ Paused / Failed / Cancelled
```

### 3.7. Mẫu hội tụ số 7: multi-agent được nén, không được phô diễn

Windsurf dùng Kanban command center. Codex, Cursor và Copilot cho nhiều agent/session song song. GitHub gần đây còn thu gọn hoạt động subagent thành một HUD có thể mở rộng.

**Bài học:** ForgeStudio không nên vẽ swarm animation. Tầng 1 chỉ cần:

- Task list theo trạng thái.
- Nhãn “3 agents active”.
- Mini-progress cho subagent.
- Một dòng output quan trọng gần nhất.
- Expand để xem hierarchy.

Mission graph chi tiết thuộc tầng 2.

### 3.8. Mẫu hội tụ số 8: rollback và isolation là feature UX, không chỉ feature backend

Worktree/sandbox/session isolation xuất hiện ở Codex, Claude Code, Cursor và Copilot. Replit làm checkpoint/rollback thành thao tác trực quan. Lingma nhấn mạnh hiểu rõ phạm vi revert.

**Bài học:** ForgeStudio đã có nền governance tốt; UI phải chuyển nó thành lời hứa dễ hiểu:

- “Đang làm trong worktree riêng — mã chính chưa bị ảnh hưởng.”
- “Thay đổi này có thể hoàn tác.”
- “Lệnh này cần quyền ghi ngoài workspace.”
- “Rollback sẽ khôi phục 7 file về checkpoint 14:32.”

### 3.9. Bảng rút kinh nghiệm theo sản phẩm

| Sản phẩm | Mẫu nên học | Điều không nên sao chép nguyên trạng |
|---|---|---|
| Codex App | Project/thread model, parallel agents, worktree isolation, review diff trong thread | UI nặng, bề mặt session dài và hiệu ứng/renderer cost nếu không đo trên máy yếu |
| Claude Code Desktop | Pane linh hoạt, terminal/editor tích hợp, visual diff, side chat, app preview | Quá nhiều capability đặt cùng một tab nếu không có progressive disclosure |
| Cursor Agents Window | Agent-first window tách khỏi IDE nhưng chuyển qua lại dễ | Không biến mọi tác vụ thành IDE chrome; người thường cần ngôn ngữ đơn giản hơn |
| GitHub Copilot App | Isolated sessions, mode/model/tool selector, quick chat, live logs | Không đặt quá nhiều dropdown dưới composer mặc định |
| Windsurf | Plan/Code/Ask rõ, preview thuận tiện, command center | Tránh Kanban thành màn hình mặc định cho người chỉ chạy một nhiệm vụ |
| Qoder Quest | Ba cột rất rõ, status board, review/terminal/browser theo nhiệm vụ | Không sao chép thuật ngữ Quest/Experts; ForgeStudio có hệ thống Goal OS riêng |
| CodeBuddy | Sidebar + conversation + context, multi-task dễ hiểu, Programming/Work mode | Không trộn quá nhiều tác vụ office vào IA coding chính nếu ForgeStudio chưa ưu tiên |
| Lingma | Revert rõ phạm vi, browser/code-review agent, session riêng | Không đưa mọi capability mới thành một icon/menu mới |
| TRAE SOLO | Hợp nhất editor/browser/terminal/docs; code mode tối giản | Tránh black/white minimalism quá lạnh làm mất bản sắc Forge |
| Kiro | Artifact requirements/design/tasks và flow Implement | Không bắt mọi task nhỏ phải đi qua spec đầy đủ |
| Zed | Agent profiles gọn, tool permissions, native-speed feel | Không hy sinh khả năng quản trị sâu chỉ để tối giản |
| Replit | Checkpoint, rollback, app preview dễ dùng | Không dùng preview/browser đầy đủ khi task không tạo UI/runtime |

### 3.10. Kết luận nghiên cứu

Không sản phẩm nào sở hữu riêng một “giao diện đúng”. Nhưng các sản phẩm tốt nhất hội tụ vào sáu nguyên tắc:

1. Agent/session là đơn vị điều hướng chính.
2. Kết quả và review đi cùng nhiệm vụ.
3. Chiều sâu IDE mở theo nhu cầu.
4. Trạng thái chờ người dùng phải nổi bật.
5. Isolation/rollback phải được giải thích bằng ngôn ngữ con người.
6. Hệ thống kỹ thuật sâu phải progressive disclosure.

ForgeStudio có đủ backend và center để đi xa hơn họ về trust, evidence và governance. Việc còn thiếu là một lớp trải nghiệm làm những năng lực đó trở nên yên tĩnh, rõ ràng và có thứ bậc.

---
# Phần II — Kiến trúc trải nghiệm ForgeStudio 3.0.0

## 4. Mô hình tinh thần duy nhất

Người dùng tầng 1 chỉ cần hiểu năm danh từ:

- **Project:** repository/workspace đang làm việc.
- **Mission:** một mục tiêu được giao cho Forge.
- **Agent:** thực thể đang thực hiện một phần nhiệm vụ.
- **Artifact:** đầu ra có thể đọc, chạy, review hoặc tải về.
- **Checkpoint:** điểm an toàn có thể quay lại.

Những khái niệm sâu hơn vẫn tồn tại nhưng chỉ lộ ra ở đúng chỗ:

| Khái niệm kỹ thuật | Cách nói ở tầng 1 | Nơi xem đầy đủ |
|---|---|---|
| Lease | Quyền tạm thời | Control Plane → Trust & Permissions |
| Receipt | Bằng chứng thao tác | “Chi tiết bằng chứng” / Evidence |
| Context packet | Nguồn Forge đang dùng | Context drawer / Control Plane |
| Instruction precedence | Quy tắc đang áp dụng | Control Plane → Governance |
| Mission graph | Nhóm agent và nhánh việc | Subagent summary / Control Plane |
| Runtime fabric | Môi trường thực thi | “Đang chạy local/worktree/sandbox” |
| Evidence runtime | Mức kiểm chứng | Review summary / Control Plane |
| Recovery lease | Forge đang tự phục hồi | “Đang thử cách an toàn khác” |

Không đổi tên dữ liệu backend nếu việc đó gây rủi ro. Chỉ đổi presentation copy tại tầng 1.

---

## 5. Information architecture tổng thể

### 5.1. Global shell tầng 1

```text
┌────────┬────────────────────┬───────────────────────────────────────────────┐
│ Rail   │ Session Sidebar    │ Active Workspace                              │
│ 48 px  │ 268–304 px         │                                               │
│        │                    │  Mission / Review / Workroom                  │
│        │                    │                                               │
└────────┴────────────────────┴───────────────────────────────────────────────┘
```

Rail chỉ có:

1. Forge/Home.
2. Missions.
3. Projects.
4. Review Queue.
5. Workroom.
6. Control Plane.
7. Search/Command.
8. Settings ở đáy.
9. Connection/status beacon ở đáy.

Không thêm icon cho từng module mới. Mọi capability mới phải đi vào một route hoặc command hiện có.

### 5.2. Session sidebar

Sidebar không chỉ là “recent runs”. Nó là task navigator có cấu trúc:

```text
[ + New mission ]
[ Project switcher ]

NEEDS YOU (2)
  ! Approve migration plan
  ! Permission: browser login

RUNNING (3)
  ● Build benchmark harness       42%
  ● Repair auth regression        Testing
  ● Research context engine       2 agents

READY TO REVIEW (1)
  ✓ Refactor provider fallback

RECENT
  … completed missions
```

Quy tắc:

- `Needs You` luôn ở trên cùng.
- Không animation pulse liên tục cho mọi running item; chỉ một status dot tĩnh hoặc pulse rất nhẹ cho task hiện tại.
- Nhóm tự thu gọn khi rỗng.
- Search/filter mở bằng `Ctrl/Cmd+K` hoặc ô search khi danh sách dài.
- Task row tối đa hai dòng, không nhồi token/model/time vào sidebar.
- Right-click hoặc `…` cho Pin, Rename, Fork, Archive, Open worktree.

### 5.3. Active Workspace

Active Workspace có ba cấu hình, không phải ba ứng dụng:

#### A. Focus

```text
conversation/activity | artifact dock
```

Dùng mặc định cho hầu hết nhiệm vụ.

#### B. Review

```text
file/change navigator | diff/preview | review summary
```

Dùng khi kết quả đã sẵn sàng.

#### C. Workroom

```text
files | editor/preview | terminal/agent context
```

Dùng khi người dùng muốn can thiệp kỹ thuật.

Việc chuyển cấu hình phải giữ nguyên session, scroll và selection. Không reload route toàn bộ.

### 5.4. Control Plane shell

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Mission   Forge Control Plane   Project: X   Runtime: Local       │
├──────────────────┬──────────────────────────────────────────────────────────┤
│ Overview         │ Route content                                            │
│ Operations       │                                                          │
│ Runtime          │ Persistent filters / time range / evidence context       │
│ Intelligence     │                                                          │
│ Context & Memory │                                                          │
│ Evidence         │                                                          │
│ Trust & Security │                                                          │
│ Governance       │                                                          │
│ Extensions       │                                                          │
│ Labs             │                                                          │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

Control Plane có navigation chữ, không dùng một cột icon bí ẩn. Mỗi domain có route con. URL/hash route hoặc state route phải deep-link được để report/error có thể mở đúng view.

### 5.5. Ánh xạ center 2.22.0 sang 3.0.0

| Center hiện tại | Vị trí 3.0.0 |
|---|---|
| Integrated Browser | Tầng 1: Artifact Dock khi mission dùng browser; Tầng 2: Runtime → Browser Sessions |
| Secrets Manager | Control Plane → Trust & Security → Secrets |
| Runtime Control Center | Control Plane → Runtime → Processes |
| Sandbox Manager | Control Plane → Runtime → Sandboxes |
| Workspace Trust | Control Plane → Trust & Security → Workspace Trust |
| Agent Operations | Control Plane → Operations → Agents |
| Context & Memory | Control Plane → Context & Memory |
| Trace & Evidence | Control Plane → Evidence → Trace Explorer |
| Repository Intelligence | Control Plane → Intelligence → Repository |
| Codebase Knowledge | Control Plane → Intelligence → Knowledge |
| Local Operations | Control Plane → Operations → Human Control |
| Evidence Runtime | Control Plane → Evidence → Verification Runtime |
| Git Governance | Control Plane → Governance → Git |
| Instruction Governance | Control Plane → Governance → Instructions |
| Agent Modes | Control Plane → Autonomy → Modes; tầng 1 chỉ có 4 intent presets |
| Mission State | Tầng 1: mission summary; Tầng 2: Operations → Mission State |

---

## 6. Tầng 1 — đặc tả từng màn hình

## 6.1. First Run / Onboarding

### Mục tiêu

Đưa người dùng từ lần mở đầu tiên tới một mission chạy được trong dưới ba phút mà không cần hiểu provider architecture.

### Bố cục

Một flow ba bước nằm trong cửa sổ, không dùng carousel marketing:

1. **Choose workspace** — chọn folder/repository hoặc mở project gần đây.
2. **Connect intelligence** — Local model / API provider / Configure later.
3. **Choose safety** — Safe, Balanced, Autonomous với mô tả tác động thực tế.

### Copy

Không nói:

- “Configure runtime fabric”.
- “Select capability lease profile”.

Nói:

- “Forge sẽ làm việc ở đâu?”
- “Forge sẽ dùng model nào?”
- “Forge được phép tự làm đến mức nào?”

### Trạng thái provider

Mỗi provider card chỉ hiển thị:

- Logo/icon local.
- Tên.
- `Connected`, `Needs key`, `Unavailable`.
- Model mặc định.
- Test connection.

Chi tiết endpoint, token, fallback chain và quota ở Settings/Control Plane.

### Chuyển động

- Step change: 180 ms opacity + 8 px translate.
- Không có illustration 3D.
- Không chạy animation nền.
- Sau khi hoàn tất, chuyển vào Home bằng shared transition của workspace title, nhưng tự tắt khi reduced motion.

---

## 6.2. Home / New Mission

### Mục tiêu

Tạo cảm giác trống vừa đủ, tự tin và trực tiếp. Người dùng phải hiểu trong ba giây rằng họ có thể mô tả mục tiêu bằng ngôn ngữ tự nhiên.

### Bố cục đề xuất

```text
                         FORGE STUDIO
                  What should Forge build?

        ┌─────────────────────────────────────────────┐
        │ Describe the outcome, attach files, or      │
        │ paste an issue…                             │
        │                                             │
        │ [ + ] [Project] [Mode] [Model: Auto]   [→] │
        └─────────────────────────────────────────────┘

          Suggested from this project
          [Fix failing tests] [Explain architecture] [Review security]
```

### Các control mặc định

- Attach.
- Project.
- Intent preset.
- Model: Auto.
- Send.

Không hiển thị token budget, routing policy, provider fallback, agent count, evidence mode. Chúng nằm trong popover `Mission options`.

### Intent presets tầng 1

Chỉ bốn lựa chọn:

1. **Ask** — đọc, giải thích, nghiên cứu; không sửa file.
2. **Plan** — lập kế hoạch; chưa triển khai.
3. **Build** — sửa code và chạy kiểm thử trong workspace/worktree.
4. **Verify** — review, test, security/evidence; không tự mở rộng scope.

Các Agent Modes chi tiết vẫn có thể được map tự động ở backend và xem trong Control Plane.

### Suggested actions

Gợi ý phải dựa trên repository snapshot thật, không dùng generic cards cố định. Tối đa ba gợi ý, ví dụ:

- “Sửa 3 test đang thất bại”.
- “Giải thích luồng provider fallback”.
- “Kiểm tra thay đổi chưa commit”.

Nếu chưa index xong, không giả vờ biết repository; hiển thị “Forge đang đọc project…” và cho nhập task bình thường.

---

## 6.3. Mission Workspace — trạng thái đang chạy

### Header

Header cao 52–56 px:

```text
[←] Build provider fallback tests        Running · Worktree isolated
                                  [Pause] [Stop] […]
```

Bên dưới title có một dòng metadata ngắn:

- Project.
- Branch/worktree.
- Mode.
- Model nếu người dùng đã chọn thủ công.

Token/time không nằm ở header mặc định; chúng ở mission details popover.

### Conversation/Activity pane

Không biến mọi tool call thành message bubble. Timeline có ba loại item:

1. **Narrative update:** “Tôi đã tìm thấy fallback logic ở `provider-router.mjs`.”
2. **Action group:** “Đọc 12 file”, “Chạy 24 test”, “Sửa 3 file”.
3. **Decision/attention:** approval, error, ambiguity, plan change.

Action group mặc định thu gọn:

```text
✓ Read repository structure                              12 files
  Found provider router, config store, and fallback tests
                                                        [Expand]
```

Mở rộng mới thấy command, duration, receipt/evidence ID và output thô.

### Live status card

Thay `live-operation-grid` bốn ô bằng một status strip gọn:

```text
● Running tests · tests/provider-fallback.test.mjs
  18 passed · 1 running · 42 s
```

Khi agent đổi phase, nội dung crossfade 120 ms. Không nhảy kích thước card.

### Progress

- Có tổng task rõ: hiển thị `5/8 steps` và progress bar.
- Không có tổng task: hiển thị phase stepper `Understanding → Planning → Building → Verifying` với phase hiện tại, không dùng %.
- Plan thay đổi: animate marker nhẹ và ghi “Plan updated” trong timeline.

### Composer trong lúc chạy

Composer dùng cho steer:

- Placeholder: “Add guidance, change direction, or attach context…”.
- `Enter` gửi; `Shift+Enter` xuống dòng.
- Có nút `Interrupt` chỉ khi message cần thay đổi ngay tiến trình.
- Message bình thường được xếp vào hàng đợi và có badge “Will apply after current command”.

### Attention banner

Khi cần người dùng, một card ghim dưới header và sidebar chuyển task vào `Needs You`:

```text
Permission required
Forge needs to run a command outside the project folder.
`C:\Program Files\...`

Impact: reads system configuration; no files will be changed.
[Allow once] [Always for this project] [Deny]
```

Không để yêu cầu quyền chìm trong activity timeline.

---

## 6.4. Mission Workspace — trạng thái plan approval

### Plan card

```text
Plan ready

Outcome
Add a provider fallback chain without changing current public API.

Scope
• 4 source files
• 3 test files
• No database migration

Steps
1. Add provider health scoring
2. Preserve original task lease across fallback
3. Add deterministic tests
4. Run focused and full suites

Risk: Medium · provider routing behavior changes

[Request changes] [Approve & build]
```

### Quy tắc

- `Approve & build` là primary action duy nhất.
- Plan dài được tóm tắt; full Markdown mở trong Artifact Dock.
- Mọi assumption có độ rủi ro cao nằm trong khối `Needs confirmation`.
- Không buộc phê duyệt task nhỏ nếu safety profile cho phép auto-plan.
- Người dùng chỉnh plan bằng comment theo đoạn hoặc message tự nhiên.

---

## 6.5. Artifact Dock

Artifact Dock thay inspector tab cố định bằng context-aware tabs. Chiều rộng mặc định 420 px, resize từ 360–720 px.

### Thứ tự ưu tiên tab

1. `Preview` khi có app/browser output.
2. `Plan` khi đang planning.
3. `Changes` khi có diff.
4. `Tests` khi có test.
5. `Files` khi có artifact/document.
6. `Details` cho Goal OS/evidence summary.

Chỉ tab có nội dung mới xuất hiện. Không hiện năm tab trống từ đầu.

### Dock states

- Dock đóng: một nút artifact có badge số lượng.
- Dock mở: giữ state theo mission.
- Dock pinned: chuyển task vẫn giữ loại tab, nhưng đổi nội dung.
- Dock maximized: dùng cho diff/preview chi tiết.

### Preview

- Toolbar: viewport size, reload, open external, annotate, screenshot.
- Loading state phân biệt “server starting”, “page loading”, “app error”.
- Console/network chỉ mở trong details.
- Khi click element để feedback, composer nhận chip context có selector/screenshot bounding box.

### Files/Artifacts

- Mỗi artifact có type icon, tên, cập nhật lúc nào, source mission step.
- Preview Markdown/PDF/image/code ngay trong dock nếu nhẹ.
- Artifact lớn tải theo nhu cầu.

---

## 6.6. Review & Ship

Đây là màn hình quan trọng nhất sau Home.

### Entry

Mission chuyển sang `Ready to Review`. Sidebar và global Review Queue cùng hiển thị. User bấm `Review changes`.

### Layout

```text
┌───────────────────┬──────────────────────────────────┬──────────────────────┐
│ Change navigator  │ Diff / Preview                    │ Review summary       │
│                   │                                   │                      │
│ 7 files           │ unified / split                   │ Tests 24/24          │
│ 3 accepted        │ inline comments                   │ Risk: low            │
│ 1 needs attention │                                   │ Evidence complete    │
└───────────────────┴──────────────────────────────────┴──────────────────────┘
```

### Change navigator

- Group by added/modified/deleted/renamed.
- Status per file: pending, accepted, rejected, comment.
- Filter: all, needs review, risky, generated.
- Binary/large files có summary, không render raw diff.

### Diff surface

- Unified mặc định ở cửa sổ hẹp, split ở rộng.
- Accept/reject theo hunk.
- Inline comment có action “Ask Forge to change this”.
- Search trong diff.
- Preserve horizontal/vertical scroll khi decision update.
- Syntax highlighting được worker hóa hoặc incremental.
- Không render toàn bộ diff hàng chục nghìn dòng; virtualize theo file/hunk.

### Review summary

Hiển thị:

- Outcome achieved / partially achieved.
- Test summary.
- New dependencies.
- Security/permission changes.
- API/schema migrations.
- Files outside intended scope.
- Evidence confidence.
- Checkpoint/rollback point.

### Ship actions

Primary action thay đổi theo project state:

- `Apply to local branch`.
- `Commit changes`.
- `Push branch`.
- `Create pull request`.
- `Export patch`.

Không hiện tất cả đồng thời. Secondary menu chứa lựa chọn còn lại.

### Rollback

Dialog phải nói rõ:

```text
Restore checkpoint from 14:32?
This will restore 7 files and discard 3 uncommitted edits made after the checkpoint.
Terminal history and mission conversation will be kept.

[Cancel] [View affected files] [Restore checkpoint]
```

---

## 6.7. Workroom

### Mục tiêu

Cho developer kiểm soát code trực tiếp mà không biến mọi session thành IDE nặng.

### Kích hoạt

- Rail Workroom.
- `Open in Workroom` từ task/header/diff.
- `Ctrl/Cmd+`` giữ shortcut hiện tại nhưng mở Workroom mode, không mở drawer hỗn hợp.

### Layout

```text
Files 220 px | Editor/Preview flexible | Agent/Terminal 360 px
```

Panel có thể đóng, resize và nhớ theo project.

### File area

- Project breadcrumb.
- Filter/search.
- Changed/open/recent sections.
- Git decoration tối giản.
- Tree chỉ render node đang mở.

### Editor

- Monaco chỉ import khi Workroom mở hoặc file code cần inline edit.
- Tabs có dirty indicator, close, pin.
- Breadcrumb và symbol path.
- Agent edits dùng gutter marker; click mở related mission step/evidence.
- `Save`, `Diff`, `Ask Forge`, `Revert file` nằm trong command menu/context, không thành dãy nút dài.

### Agent/Terminal area

Tab:

- Agent.
- Terminal.
- Problems.
- Output.

Chỉ terminal đang visible mới giữ renderer đầy đủ. Terminal ẩn được suspend/buffer theo performance policy.

### Browser

Browser preview là một editor tab/artifact, không nằm chung với secrets/update/plugin.

### Exit

`Back to Mission` quay đúng mission, đúng artifact và đúng scroll. Workroom không tạo session mới.

---

## 6.8. Global Review Queue

Review Queue dành cho người chạy nhiều agent:

- Needs approval.
- Needs permission.
- Ready to review.
- Failed after retry.
- PR/checks changed.

Không phải Kanban tổng quát. Nó là inbox hành động, sắp theo mức khẩn cấp và thời gian chờ. Mỗi item phải có một primary action rõ.

---

## 6.9. Projects

Project page hiển thị:

- Project identity và path.
- Active missions.
- Recent changes/checkpoints.
- Trust state.
- Default provider/mode.
- Rules/instructions summary.

Không hiển thị repository intelligence graph mặc định. Nút `Open intelligence` đưa vào Control Plane.

---

## 6.10. Settings tầng 1

Chỉ có:

- Appearance.
- Language.
- Keyboard shortcuts.
- Notifications.
- Default model/provider.
- Default safety/autonomy preset.
- Worktree location.
- Performance profile: Lite / Balanced / Performance / Auto.
- Data & privacy summary.

Mọi config nâng cao chuyển sang Control Plane.

---

## 7. Tầng 2 — Forge Control Plane

## 7.1. Entry và context

Control Plane mở từ:

- Rail icon.
- Command palette.
- `View technical details` trong mission.
- Deep-link từ error/evidence/permission.

Khi mở từ mission, global header giữ context:

```text
Mission: Build fallback tests · Step: Running focused tests
```

Mọi route có `Back to Mission` và không làm mất trạng thái tầng 1.

## 7.2. Overview

Overview không phải dashboard trang trí. Chỉ trả lời:

- Hệ thống có khỏe không?
- Có gì đang chạy?
- Có gì cần người quản trị xử lý?
- Có rủi ro/vi phạm nào mới?

Các section:

1. Runtime health.
2. Active agents/missions.
3. Pending approvals/leases.
4. Evidence gaps.
5. Repository/index freshness.
6. Provider/model status.
7. Recent policy events.
8. Performance budget warnings.

Card click mở route đã filter sẵn. Không dùng donut chart nếu con số/timeline rõ hơn.

## 7.3. Operations

Route con:

- Missions.
- Agents/Subagents.
- Human Control.
- Recovery.
- Queues.

Mission table hỗ trợ filter và drill-down. Agent detail hiển thị status, parent mission, current action, lease, resources, last heartbeat, restart/stop/pause tùy quyền.

## 7.4. Runtime & Sandboxes

Route con:

- Processes.
- Sandboxes/worktrees.
- Terminals.
- Browser sessions.
- Resource profile.
- Assets/runtime installation.

Mỗi row có state, owner mission, started, CPU/memory nếu đo được, action an toàn. Không polling mọi metric khi route không visible.

## 7.5. Context & Memory

Chia rõ:

- **Current Context:** context của mission/step hiện tại.
- **Memory:** durable items theo project.
- **Retrieval:** vì sao item được chọn.
- **Conflicts:** instruction/memory mâu thuẫn.
- **Retention:** policy và cleanup.

Mỗi context item có provenance, confidence, scope, freshness và action exclude/pin. Nội dung nhạy cảm được redact theo policy.

## 7.6. Evidence & Trace

Route con:

- Trace Explorer.
- Receipts.
- Verification Runtime.
- Export bundles.
- Evidence gaps.

Trace mặc định là timeline phân cấp theo phase; graph chỉ là view phụ. Có filter theo agent, tool, file, risk, time và receipt type. Raw JSON mở trong code viewer, không đổ ra `pre` mặc định.

## 7.7. Intelligence

Gom Repository Intelligence và Codebase Knowledge:

- Repository Overview.
- Symbols/AST.
- Routes/APIs.
- Data models.
- Dependencies.
- References/calls.
- Git history/recency.
- Search/ranking.
- Watch/index state.

Dashboard dùng density cao nhưng cùng token với shell. Animation orbit/grid bị loại. Graph chỉ animate khi người dùng thao tác, không chạy nền.

## 7.8. Trust & Security

Route con:

- Workspace Trust.
- Permissions & Leases.
- Secrets.
- Sandboxing policy.
- Browser permissions.
- Plugin capabilities.
- Audit events.

Permission matrix phải có ngôn ngữ hai lớp:

- Cột label dễ hiểu.
- Tooltip/expanded detail chứa capability ID thật.

Secrets không bao giờ hiển thị value. Chỉ provider/service, account, backend, last used, rotation status.

## 7.9. Governance

Route con:

- Instructions.
- Git policy.
- Hooks.
- Guardrails.
- Approval policy.
- Change history.

Instruction resolution view phải cho thấy precedence bằng stack rõ ràng:

```text
Organization policy
↓ Project AGENTS.md
↓ Project local rules
↓ Mission instruction
↓ User follow-up
```

Conflict được highlight, nhưng không dùng đỏ cho mọi override hợp lệ.

## 7.10. Models, Providers, Skills & Plugins

- Providers.
- Model catalog/routing.
- Skills.
- MCP/LSP/plugins.
- Hooks/integrations.

Tầng 1 chỉ chọn model/mode đơn giản. Tầng 2 mới cấu hình fallback, capability, limits, local endpoint và plugin quarantine.

## 7.11. Autonomy

- Intent preset mapping.
- Agent modes chi tiết.
- Budget/time/tool boundaries.
- Auto-recovery policy.
- Subagent spawning policy.
- Mission state machine.

Không dùng 20 card mode cùng lúc. Dùng table/side detail, search, tag và compare.

## 7.12. Labs & Benchmarks

Tách nghiên cứu khỏi vận hành:

- Benchmark runs.
- Evaluation suites.
- Experiment configurations.
- Model/provider comparisons.
- Decision efficiency.
- Context/retrieval quality.
- Regression history.

Không để dữ liệu thử nghiệm ảnh hưởng Overview sản phẩm trừ khi một release gate thất bại.

## 7.13. Release & Recovery

- Signed updates.
- Version status.
- Migration state.
- Recovery checkpoints.
- Diagnostics export.
- Safe restart.

Update manager rời khỏi Workroom. Nó phải nói rõ version, signature, size, restart impact và rollback availability.

---
# Phần III — Design system “Forge Quiet Authority”

## 8. Ngôn ngữ thị giác

### 8.1. Tính cách

ForgeStudio phải tạo cảm giác:

- Chính xác hơn là hào nhoáng.
- Cao cấp hơn là nhiều hiệu ứng.
- Tĩnh hơn là “AI đang phát sáng”.
- Kỹ thuật nhưng không lạnh lẽo.
- Đáng tin hơn là thần bí.

Tên nội bộ của hướng thiết kế:

> **Forge Quiet Authority — Graphite precision with restrained violet intelligence.**

### 8.2. Tỷ lệ thẩm mỹ

- 80% neutral graphite/ink.
- 12% typography, border và hierarchy.
- 6% semantic colors.
- 2% Forge violet accent.

Accent tím chỉ dùng cho:

- Primary action.
- Active navigation.
- Focus ring.
- Agent intelligence state có chủ đích.
- Một số selected/highlight states.

Không dùng tím cho tất cả card, graph, icon và heading.

### 8.3. Điều chỉnh từ UI-UX Pro Max

`ui-ux-pro-max-skill` cung cấp thư viện phong cách, palette, typography, UX guidelines và đặc biệt kiến trúc token ba tầng. ForgeStudio không nên chọn một style pack nguyên khối. Ta chỉ lấy các nguyên tắc phù hợp:

- Minimalism/Swiss cho hierarchy.
- Dark OLED/developer tool cho nền.
- Dimensional layering rất nhẹ cho panel/modal.
- AI-native UI ở cấp interaction, không ở cấp gradient trang trí.
- Real-time monitoring cho Control Plane.
- Progressive disclosure và accessibility checklist.
- Primitive → Semantic → Component tokens.
- Không dùng raw hex trực tiếp trong component CSS.

Các phong cách phải tránh:

- Heavy glassmorphism.
- Cyberpunk/HUD cho shell chính.
- Aurora gradient dày.
- Neon border quanh mọi card.
- Clay/neumorphism.
- Motion-driven decorative UI.
- Bento card hóa mọi thứ.

---

## 9. Token architecture ba tầng

### 9.1. Cấu trúc file

```text
ui-v3/styles/
  tokens/
    primitive.css
    semantic.css
    component.css
  base/
    reset.css
    typography.css
    focus.css
    utilities.css
  layout/
    app-shell.css
    workspace.css
    control-plane.css
  components/
    button.css
    input.css
    menu.css
    dialog.css
    tabs.css
    card.css
    status.css
    timeline.css
    diff.css
    table.css
    toast.css
    tooltip.css
  pages/
    home.css
    mission.css
    review.css
    workroom.css
    control-plane-pages.css
  motion.css
  responsive.css
```

Không tạo một file CSS riêng với palette khác cho từng center.

### 9.2. Primitive tokens

```css
@layer tokens.primitive {
  :root {
    --forge-black-950: #090a0c;
    --forge-black-900: #0d0f12;
    --forge-gray-875: #111419;
    --forge-gray-850: #14171c;
    --forge-gray-800: #181c22;
    --forge-gray-750: #1e232b;
    --forge-gray-700: #262c35;
    --forge-gray-600: #363e49;
    --forge-gray-500: #596372;
    --forge-gray-400: #7f8998;
    --forge-gray-300: #a7afbb;
    --forge-gray-200: #cfd4dc;
    --forge-gray-100: #eef1f5;

    --forge-violet-700: #6656d9;
    --forge-violet-600: #7867ed;
    --forge-violet-500: #8b7cf6;
    --forge-violet-400: #a79cff;

    --forge-green-500: #58c996;
    --forge-amber-500: #d9a957;
    --forge-red-500: #e56f78;
    --forge-blue-500: #66a8e8;

    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;

    --radius-1: 6px;
    --radius-2: 9px;
    --radius-3: 12px;
    --radius-4: 16px;

    --duration-instant: 80ms;
    --duration-fast: 120ms;
    --duration-normal: 160ms;
    --duration-panel: 220ms;
    --duration-modal: 260ms;

    --ease-standard: cubic-bezier(.2, .7, .2, 1);
    --ease-enter: cubic-bezier(.16, 1, .3, 1);
    --ease-exit: cubic-bezier(.4, 0, 1, 1);
  }
}
```

Màu trên là baseline để xây, không phải lời mời rải raw hex. Sau khi visual calibration trên màn hình thật, chỉ sửa primitive.

### 9.3. Semantic tokens

```css
@layer tokens.semantic {
  :root {
    --surface-canvas: var(--forge-black-900);
    --surface-rail: var(--forge-black-950);
    --surface-sidebar: var(--forge-gray-875);
    --surface-panel: var(--forge-gray-850);
    --surface-raised: var(--forge-gray-800);
    --surface-overlay: var(--forge-gray-750);
    --surface-hover: color-mix(in srgb, white 5%, transparent);
    --surface-selected: color-mix(in srgb, var(--forge-violet-500) 14%, transparent);

    --border-subtle: color-mix(in srgb, white 7%, transparent);
    --border-default: color-mix(in srgb, white 11%, transparent);
    --border-strong: color-mix(in srgb, white 17%, transparent);

    --text-primary: var(--forge-gray-100);
    --text-secondary: var(--forge-gray-300);
    --text-muted: var(--forge-gray-400);
    --text-faint: var(--forge-gray-500);

    --accent: var(--forge-violet-500);
    --accent-hover: var(--forge-violet-400);
    --accent-muted: color-mix(in srgb, var(--accent) 15%, transparent);
    --focus-ring: var(--forge-violet-400);

    --status-success: var(--forge-green-500);
    --status-warning: var(--forge-amber-500);
    --status-danger: var(--forge-red-500);
    --status-info: var(--forge-blue-500);

    --shadow-popover: 0 10px 34px rgba(0, 0, 0, .36);
    --shadow-modal: 0 24px 72px rgba(0, 0, 0, .48);
  }
}
```

Nếu `color-mix` gặp vấn đề trên Electron target, build step sinh fallback RGB/rgba. Không tính màu trong runtime JS.

### 9.4. Component tokens

Ví dụ:

```css
@layer tokens.component {
  :root {
    --button-primary-bg: var(--accent);
    --button-primary-bg-hover: var(--accent-hover);
    --button-primary-fg: white;
    --button-secondary-bg: var(--surface-raised);
    --button-secondary-border: var(--border-default);

    --composer-bg: var(--surface-panel);
    --composer-border: var(--border-default);
    --composer-border-focus: var(--focus-ring);

    --task-row-bg-hover: var(--surface-hover);
    --task-row-bg-active: var(--surface-selected);

    --dialog-bg: var(--surface-overlay);
    --dialog-border: var(--border-strong);
  }
}
```

Mọi component state phải được mô tả: default, hover, active, focus-visible, disabled, loading, destructive và selected.

---

## 10. Typography

### 10.1. Font strategy

Không tải Google Fonts. Dùng:

```css
font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
  "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
```

Inter chỉ được ưu tiên khi đã đóng gói hợp pháp trong app. Nếu không, system font vẫn phải đẹp. Code:

```css
font-family: "SFMono-Regular", "Cascadia Code", "JetBrains Mono",
  Consolas, ui-monospace, monospace;
```

Không đóng gói font chỉ để đạt một screenshot. Tính nhất quán và startup quan trọng hơn.

### 10.2. Type scale

| Token | Size / line | Dùng cho |
|---|---|---|
| `display` | 32/40, 650 | Home hero duy nhất |
| `title-1` | 24/32, 650 | Page title |
| `title-2` | 18/26, 620 | Panel heading |
| `title-3` | 15/22, 620 | Card heading |
| `body` | 14/21, 400 | Nội dung chính |
| `body-small` | 13/19, 400 | Sidebar/card |
| `label` | 12/16, 560 | Control labels |
| `caption` | 11/15, 500 | Metadata tối thiểu |
| `code` | 12.5/19 | Code/diff/terminal adjunct |

Không dùng chữ dưới 11 px cho nội dung cần đọc. Không dùng uppercase letter-spacing lớn cho mọi heading; `eyebrow` chỉ ở onboarding/Control Plane section đặc biệt.

### 10.3. Độ dài dòng

- Chat/narrative: 62–78 ký tự tương đương.
- Plan/document: 72–92.
- Control Plane data: theo grid, không áp max width text nếu là table.
- Không cho message text kéo từ trái sang phải toàn màn hình.

---

## 11. Spacing, density và shape

### 11.1. Grid

Dùng base 4 px. Các khoảng phổ biến: 8, 12, 16, 20, 24, 32.

### 11.2. Density modes

ForgeStudio có hai density profile, không phải theme:

- **Comfortable:** mặc định tầng 1.
- **Compact:** mặc định table/Control Plane và tùy chọn người dùng.

Không cho mỗi center tự định padding.

### 11.3. Radius

- Small controls: 6 px.
- Buttons/inputs/rows: 9 px.
- Cards/panels: 12 px.
- Modal/large composer: 16 px.

Không dùng pill cho mọi tab/button. Pill chỉ dành cho status, filter chip hoặc segmented compact control.

### 11.4. Shadows

- Panel trong layout: không shadow, chỉ border/surface.
- Popover: một shadow vừa.
- Modal: shadow sâu.
- Card hover: đổi border/surface, không nhấc lên 3 px hàng loạt.

---

## 12. Iconography

- Một bộ SVG line icon đồng nhất, stroke 1.75–2.
- Kích thước chuẩn 16, 18, 20; rail 20.
- Không dùng emoji làm icon chức năng.
- Icon luôn có tooltip/aria-label nếu không có text.
- Trạng thái không chỉ dựa vào màu icon; thêm label hoặc shape.
- Forge mark chỉ xuất hiện ở brand/home/agent identity, không lặp trong mọi card.

---

## 13. Component architecture

### 13.1. Thành phần nền tảng

```text
AppShell
├─ GlobalRail
├─ SessionSidebar
├─ WorkspaceRouter
│  ├─ HomeView
│  ├─ MissionView
│  ├─ ReviewView
│  ├─ WorkroomView
│  └─ ProjectView
├─ CommandPalette
├─ GlobalDialogHost
├─ ToastRegion
└─ ControlPlaneGateway
```

### 13.2. Thành phần mission

```text
MissionHeader
MissionStatusStrip
ActivityTimeline
  ├─ NarrativeEvent
  ├─ ActionGroup
  ├─ DecisionEvent
  ├─ ApprovalCard
  ├─ ErrorRecoveryCard
  └─ SubagentHUD
MissionComposer
ArtifactDock
  ├─ PreviewArtifact
  ├─ PlanArtifact
  ├─ ChangesArtifact
  ├─ TestsArtifact
  ├─ FileArtifact
  └─ DetailsArtifact
```

### 13.3. Thành phần review

```text
ReviewShell
ChangeNavigator
DiffViewport
HunkToolbar
InlineReviewComposer
VerificationSummary
ShipActions
RollbackDialog
```

### 13.4. Thành phần Control Plane

```text
ControlPlaneShell
ControlPlaneSidebar
ControlPlaneHeader
RouteOutlet
FilterBar
DataTable
MetricStrip
EvidenceLink
TraceTimeline
DetailDrawer
RawDataViewer
```

### 13.5. API component tối thiểu

Không cần framework component. Mỗi module xuất interface nhất quán:

```js
export function createMissionHeader({ root, actions }) {
  return {
    update(viewModel) {},
    focusTitle() {},
    destroy() {}
  };
}
```

Quy tắc:

- Constructor chỉ bind DOM/event, không fetch.
- `update()` nhận view model đã normalize.
- `destroy()` gỡ listener, observer, timer và worker.
- Không module nào tự đọc `state` global ngoài adapter.
- Không innerHTML toàn trang sau lần mount đầu.

---

# Phần IV — Motion và cảm giác mượt

## 14. Motion principles

### 14.1. Motion có bốn vai trò hợp lệ

1. **Spatial continuity:** panel từ đâu mở ra.
2. **State acknowledgement:** click đã được nhận.
3. **Attention guidance:** có approval/error mới.
4. **Hierarchy:** item mở rộng/thu gọn.

Motion trang trí không có vai trò trên bị loại.

### 14.2. Duration

| Interaction | Duration |
|---|---:|
| Button press/focus response | 80 ms |
| Hover/color change | 120 ms |
| Item enter/expand | 160 ms |
| Sidebar/dock transition | 220 ms |
| Modal enter | 260 ms |
| Toast enter/exit | 160/120 ms |

Không có animation UI chức năng dài hơn 300 ms.

### 14.3. Properties được phép

Ưu tiên:

- `transform`.
- `opacity`.
- `clip-path` chỉ khi profile performance cho phép và đã đo.

Hạn chế:

- `box-shadow` transition.
- `background` gradient interpolation.
- `filter`.

Cấm cho animation liên tục:

- `width`, `height`.
- `top`, `left`, `right`, `bottom`.
- `border-width`.
- `backdrop-filter`.
- shadow nhiều lớp.

### 14.4. Panel open/close

Không animate grid column width qua nhiều frame. Cách thực hiện:

- Sidebar persistent: đổi layout một lần, animate nội dung shell bằng transform 8–12 px nếu cần.
- Overlay ở cửa sổ hẹp: `transform: translateX()`.
- Artifact Dock desktop: giữ width đã phân bổ; open/close dùng class và discrete layout, content fade/slide ngắn.
- Resize do người dùng kéo: không transition.

### 14.5. Timeline updates

- Item mới xuất hiện opacity 0→1 và translateY 4 px trong 140–160 ms.
- Nếu hơn 5 event tới cùng lúc, batch thành group; không animate từng row.
- Streaming text cập nhật theo batch 50–100 ms, không update từng token nếu gây layout liên tục.
- Giữ vị trí scroll nếu user đã cuộn lên; chỉ auto-follow khi ở gần đáy.

### 14.6. Agent thinking state

Không dùng ba chấm nhảy liên tục suốt hàng phút. Dùng:

```text
● Planning next step
Last update 6s ago
```

Dot pulse rất nhẹ, dừng khi window hidden hoặc reduced effects. Khi không có heartbeat, chuyển thành `No update for 30s` thay vì tiếp tục animation giả.

### 14.7. Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Ngoài media query, runtime profile `reducedEffects` phải ngăn tạo particle/orbit/canvas animation ngay từ đầu.

---

# Phần V — Kiến trúc hiệu năng

## 15. Nguyên tắc: đẹp hơn bằng giảm công việc, không bằng thêm GPU effects

Electron official guidance nhấn mạnh đo đạc, tránh tải/chạy code quá sớm, không block main/renderer, giảm network và bundle code. ForgeStudio có lợi thế local asset và ESM. 3.0.0 phải giữ lợi thế đó.

## 15.1. Không framework rewrite

Lý do:

- Shell hiện tại đã nhỏ và hoạt động.
- Chuyển framework làm tăng scope/rủi ro trước 3.0.0.
- Virtual DOM không tự giải quyết timeline/diff lớn nếu vẫn render sai.
- Framework runtime, hydration và dependency graph có thể làm startup/memory nặng hơn.
- Native DOM incremental update đủ cho cấu trúc app này.

Có thể dùng build tool để bundle, minify, code-split và tạo manifest. Build tool không trở thành runtime framework.

## 15.2. Bundle strategy

Output đề xuất:

```text
ui-dist/
  shell.js                 # rail/sidebar/router/dialog/toast
  mission.js               # loaded when task opens
  review.js                # loaded when diff exists/open review
  workroom.js              # loaded on demand
  control-plane.js         # shell CP only
  cp-operations.js
  cp-runtime.js
  cp-context.js
  cp-evidence.js
  cp-intelligence.js
  cp-security.js
  cp-governance.js
  cp-extensions.js
  cp-labs.js
  styles.css
```

- Shell preload không import Monaco, xterm, graph engine, syntax highlighter đầy đủ hoặc Control Plane pages.
- Preload chunk khi browser idle và xác suất dùng cao; ví dụ mission chunk sau Home idle.
- Không preload Control Plane trong profile Lite.

## 15.3. State model

```js
const uiState = {
  shell: { route, sidebarCollapsed, commandOpen },
  project: { currentId, summary },
  sessions: { order, byId, filters },
  mission: { currentId, header, messages, activities, artifacts },
  review: { files, decisions, filters },
  workroom: { openFiles, activeFile, panels },
  controlPlane: { route, filtersByRoute }
};
```

Updates phải mang type và payload nhỏ:

```js
uiBus.dispatch({ type: 'activity/upsert', missionId, activity });
uiBus.dispatch({ type: 'mission/header', missionId, patch });
uiBus.dispatch({ type: 'artifact/available', missionId, artifact });
```

Không refetch/rerender toàn snapshot chỉ vì heartbeat thay đổi.

## 15.4. SSE và batching

- Parse event một lần.
- Coalesce theo mission và state slice.
- UI flush tối đa một lần mỗi animation frame.
- Text streaming flush 50–100 ms.
- Header elapsed timer dùng một shared scheduler, không mỗi component một interval.
- Khi document hidden, giảm refresh về heartbeat tối thiểu.
- Khi task không active, chỉ cập nhật sidebar summary, không render timeline.

## 15.5. DOM budgets

Mục tiêu nội bộ:

| Surface | DOM node target |
|---|---:|
| Shell + Home | < 1,200 |
| Mission visible | < 2,500 |
| Mission + Artifact Dock | < 3,500 |
| Review visible | < 4,000 nhờ virtualization |
| Control Plane route | < 3,500 visible |

Các con số là release budget, không phải dự đoán tự động. CI hoặc smoke harness đo và fail khi tăng bất thường.

## 15.6. Virtualization

Bắt buộc cho:

- Activity timeline dài.
- Message history rất dài.
- Diff lớn.
- Trace/evidence list.
- Repository symbols/references.
- Tables trên 200 row.

Không cần thư viện nặng. Dùng windowed list với fixed/estimated row height, resize observer và overscan 6–12 item. Diff hunk có thể virtualize theo hunk thay vì từng line để giữ selection.

## 15.7. Worker offload

Web Worker cho:

- Diff parse và syntax tokenization nặng.
- Knowledge graph layout.
- Search/filter/ranking ở dataset lớn.
- Log/evidence JSON formatting.
- Markdown preprocessing lớn.

Worker trả view model tối thiểu, không clone snapshot khổng lồ liên tục.

## 15.8. CSS performance

- Loại `backdrop-filter: blur(18px)` khỏi card lặp.
- Không có animation quay orbit 34 giây trên route.
- Dùng `content-visibility: auto` cho section dài Control Plane nếu đo cho kết quả tốt.
- Dùng `contain: layout paint` cho preview/graph/terminal isolation khi phù hợp.
- Shadow chỉ ở overlay.
- Không dùng selector sâu/phổ quát trong component hot path.
- CSS được layer hóa để tránh specificity war.

## 15.9. Monaco/xterm

- Lazy import khi mở Workroom.
- Trong profile Lite, chỉ giữ tối đa 4 editor model như policy hiện tại.
- Chỉ render tối đa 2 terminal visible; terminal khác suspend view nhưng giữ process tùy policy.
- Dispose model khi tab đóng và không còn reference.
- Không tự preload language service cho ngôn ngữ chưa mở.
- Fallback textarea vẫn tồn tại khi asset lỗi.

## 15.10. Preview/browser

- Iframe/browser session chỉ chạy khi artifact tab visible hoặc mission cần browser.
- Pause screenshot polling khi hidden.
- Không giữ nhiều live preview nếu người dùng đã chuyển mission; dùng snapshot thumbnail.
- Mọi devtools panel tải theo click.

## 15.11. Performance budgets

Đo trên máy tham chiếu tối thiểu 8 GB RAM, 4 core, Windows 11, profile Lite:

| Metric | Release target |
|---|---:|
| Window `ready-to-show` từ app launch | p50 ≤ 1.2 s, p95 ≤ 1.8 s |
| Home interactive sau window show | ≤ 250 ms |
| Route switch đã tải | p95 ≤ 100 ms |
| First open lazy route | p95 ≤ 350 ms, có skeleton sau 180 ms |
| Keystroke/input latency | p95 < 50 ms |
| Long task trên shell | không task > 50 ms trong tương tác thường |
| Animation | ≥ 55 FPS p95 trên transition chuẩn |
| Idle renderer CPU, không mission | < 1% trung bình |
| Idle renderer memory, chưa Workroom | mục tiêu < 180 MB |
| Renderer memory với Workroom | mục tiêu < 350 MB |
| Hidden window activity | timer/render giảm ≥ 80% |
| Base shell JS parse/execute | < 120 ms trên máy tham chiếu |

Nếu ngân sách không đạt, release gate yêu cầu profile trace và quyết định giảm tính năng hiển thị/animation, không chỉ tăng hardware target.

## 15.12. Skeleton và perceived performance

- Dưới 180 ms: không skeleton; giữ nội dung cũ hoặc spinner nhỏ trong control.
- 180–800 ms: skeleton theo hình dạng thật.
- Trên 800 ms: thêm status text và cancel/retry nếu hợp lý.
- Không dùng skeleton shimmer chạy liên tục trên nhiều panel; dùng pulse opacity nhẹ hoặc static placeholder trong reduced effects.

---

# Phần VI — Human-AI interaction, trust và copy

## 16. Quy tắc human-AI interaction

Áp dụng từ Microsoft HAX và nghiên cứu oversight:

### Khi bắt đầu

- Nói rõ Forge có thể làm gì với mode hiện tại.
- Nói rõ phạm vi workspace và isolation.
- Không ngầm hứa chắc chắn khi chưa đọc project.

### Trong khi tương tác

- Cho phép sửa hướng.
- Hiển thị vì sao cần quyền.
- Cho phép inspect nguồn/context ở mức phù hợp.
- Nói rõ uncertainty khi evidence thiếu.

### Khi sai

- Error phải có stage, tác động và next action.
- Giữ checkpoint.
- Không reset toàn bộ mission khi retry.
- Cho phép người dùng cung cấp correction và ghi nhận nó.

### Theo thời gian

- Memory có thể xem, sửa, pin, exclude và xóa.
- Auto-adaptation phải có audit trail ở tầng 2.
- Không âm thầm mở rộng permission.

## 17. Risk moments

Tầng 1 phải làm nổi bật các thời điểm:

- Trước khi chạy lệnh phá hủy/không đảo ngược.
- Trước khi ghi ngoài workspace.
- Trước khi gửi dữ liệu ra network/provider mới.
- Trước khi cài dependency/plugin.
- Trước khi đổi schema/database.
- Trước khi force push/merge/deploy.
- Khi test không đủ hoặc evidence thiếu.
- Khi agent tự thay plan lớn.

Mỗi approval card có:

1. Action.
2. Why needed.
3. Impact.
4. Scope.
5. Reversibility.
6. Options.
7. Technical details collapsed.

## 18. Copy system

### 18.1. Voice

- Bình tĩnh.
- Cụ thể.
- Không tự tâng bốc.
- Không anthropomorphism quá mức.
- Không dùng thuật ngữ backend nếu không cần.

### 18.2. Ví dụ

| Không dùng | Dùng |
|---|---|
| “Runtime fabric lease denied” | “Forge chưa có quyền chạy lệnh này.” |
| “Evidence runtime incomplete” | “Chưa đủ bằng chứng để xác nhận thay đổi an toàn.” |
| “Context retrieval degraded” | “Forge đang dùng ít thông tin từ project hơn bình thường.” |
| “Recovery organ acquired lease” | “Forge đang thử một cách phục hồi an toàn khác.” |
| “Mission graph spawned 3 nodes” | “Forge đã chia công việc cho 3 agent.” |
| “Provider fallback exhausted” | “Không model nào trong chuỗi dự phòng phản hồi thành công.” |

Technical detail giữ nguyên ID/code trong expandable section.

### 18.3. Status verbs

Dùng động từ cụ thể:

- Reading.
- Planning.
- Editing.
- Running tests.
- Reviewing.
- Waiting for approval.
- Recovering.
- Ready to review.

Tránh “Thinking…” kéo dài, “Working…” chung chung hoặc “Magic happening”.

## 19. Notification hierarchy

1. **Inline state:** thông tin bình thường.
2. **Toast:** confirmation không cần action.
3. **Banner/card:** cần chú ý trong mission.
4. **Review Queue:** cần action nhưng có thể xử lý sau.
5. **System notification:** task hoàn tất/blocked khi app không focus.
6. **Modal:** chỉ cho action rủi ro/không thể đảo ngược hoặc thiết lập bắt buộc.

Không dùng modal cho provider test, warning nhẹ, plan summary hoặc success.

---

# Phần VII — Accessibility và responsive

## 20. Accessibility release requirements

- WCAG 2.2 AA cho contrast và keyboard.
- Focus-visible rõ 2 px, không bị clip.
- Mọi icon-only button có accessible name.
- Landmarks và heading hierarchy đúng.
- Timeline dùng semantics phù hợp, không spam live region.
- Chỉ event cần chú ý mới `aria-live="assertive"`; activity dùng polite/batched.
- Tab/arrow-key behavior theo ARIA Authoring Practices.
- Dialog trap focus, restore focus khi đóng, `Esc` hoạt động trừ action nguy hiểm đang chạy.
- Status không chỉ dùng màu.
- Diff line added/removed có text/marker.
- Resize handle dùng keyboard.
- Hit target tối thiểu 32 px desktop; action quan trọng 36–40 px.
- Zoom 200% không mất action chính.
- `prefers-reduced-motion`, `prefers-contrast` được kiểm tra.

## 21. Keyboard map

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+K` | Command palette |
| `Ctrl/Cmd+N` | New mission |
| `Ctrl/Cmd+Shift+R` | Review Queue |
| `Ctrl/Cmd+`` | Toggle Workroom |
| `Ctrl/Cmd+Shift+P` | Control Plane |
| `Ctrl/Cmd+\` | Toggle Artifact Dock |
| `Alt+↑/↓` | Previous/next mission needing attention |
| `Ctrl/Cmd+Enter` | Primary action in approval/review context |
| `Esc` | Close overlay / return focus |

Shortcut phải hiển thị theo hệ điều hành và tùy chỉnh được.

## 22. Responsive desktop

ForgeStudio là desktop-first, nhưng phải làm việc ở cửa sổ nhỏ:

### ≥ 1440 px

- Sidebar + conversation + Artifact Dock.
- Review ba cột.

### 1180–1439 px

- Artifact Dock 380–420 px.
- Review summary có thể overlay/collapse.

### 900–1179 px

- Sidebar có thể collapse.
- Artifact Dock mở overlay hoặc mode full panel.
- Review hai cột.

### 640–899 px

- Rail + một surface chính.
- Sidebar/dock là overlay.
- Workroom dùng tab, không ba cột.

### < 640 px

Không phải target chính cho desktop app, nhưng không crash/overflow vô hạn; cung cấp mode đọc/steer tối giản nếu window bị thu nhỏ.

---
# Phần VIII — Chiến lược migration từ 2.22.0 đến 3.0.0

## 23. Không sửa UI lớn khi capability vẫn đang biến động

Người phát triển đang tiếp tục thêm tính năng từ 2.22.0 đến 3.0.0. Vì vậy, cách an toàn không phải bắt đầu thay giao diện ngay, mà là tách quá trình thành ba đường:

### Đường 1 — Feature development tiếp tục

- Tiếp tục thêm backend/capability trong kiến trúc hiện tại.
- Mỗi capability mới phải đăng ký metadata UI contract, không tự thêm icon rail.
- UI 2.x chỉ thêm entry tối thiểu để kiểm thử chức năng.

### Đường 2 — Capability ledger chuẩn bị cho 3.0

Tạo một registry mô tả mọi capability:

```js
{
  id: 'context-memory',
  domain: 'context',
  levelOneExposure: 'context-summary',
  controlPlaneRoute: '/context/memory',
  requiredPermissions: ['project:read'],
  dataSources: ['/api/context/...'],
  states: ['loading', 'ready', 'empty', 'degraded', 'error'],
  owner: 'context-memory-center'
}
```

Ledger này giải quyết rủi ro “đến 3.0 mới phát hiện còn center không được đưa vào UI”.

### Đường 3 — UI v3 phát triển song song sau feature freeze mềm

- Dựng `ui-v3/` song song với `ui/`.
- Feature flag chọn UI root.
- UI 2.x vẫn là fallback cho đến khi release gates đạt.
- Không sửa cùng lúc toàn bộ verifier cũ; tạo compatibility map và chuyển dần.
- Khi v3 ổn định, `ui/` trở thành v3 và UI cũ chuyển vào `legacy-ui/` chỉ trong một release recovery window, sau đó xóa.

## 24. Các cổng phiên bản

### 2.22.x–2.8x.x — Inventory phase

- Mọi feature mới thêm vào capability ledger.
- Ghi lại API, states, actions, permissions và evidence.
- Không polish center riêng bằng style mới.

### 2.9x.x — Soft UI freeze

- Đóng danh sách domain và route Control Plane.
- Chốt terminology tầng 1.
- Chốt API view models.
- Bắt đầu `ui-v3/` và visual regression.

### 2.99.0 — Feature-complete candidate

- Không thêm top-level capability mới nếu không có exception.
- Chỉ bug fix, missing state và release gate.
- Chạy capability coverage audit: 100% capability có route/entry/visibility rule.

### 3.0.0-rc

- UI v3 mặc định.
- UI cũ chỉ bật bằng recovery flag.
- Performance, accessibility, security, packaging và update tests bắt buộc.

### 3.0.0 stable

- Xóa recovery flag khỏi UI settings; giữ CLI/environment emergency switch trong một chu kỳ nếu release policy yêu cầu.
- Tất cả screenshot/docs/onboarding dùng v3.

---

# Phần IX — File architecture cho UI v3

## 25. Cấu trúc đề xuất

```text
ui-v3/
  index.html
  app.mjs
  manifest.json
  assets/
    forgeos-mark.svg
    icons.svg
  core/
    api-client.mjs
    event-stream.mjs
    ui-store.mjs
    ui-bus.mjs
    router.mjs
    scheduler.mjs
    focus-manager.mjs
    command-registry.mjs
    capability-registry.mjs
    performance-observer.mjs
  shell/
    app-shell.mjs
    global-rail.mjs
    session-sidebar.mjs
    project-switcher.mjs
    command-palette.mjs
    dialog-host.mjs
    toast-region.mjs
  views/
    home/
      home-view.mjs
      mission-composer.mjs
    mission/
      mission-view.mjs
      mission-header.mjs
      status-strip.mjs
      activity-timeline.mjs
      activity-item.mjs
      mission-composer.mjs
      artifact-dock.mjs
    review/
      review-view.mjs
      change-navigator.mjs
      diff-viewport.mjs
      verification-summary.mjs
      ship-actions.mjs
    workroom/
      workroom-view.mjs
      file-tree.mjs
      editor-host.mjs
      terminal-host.mjs
      problems-panel.mjs
    projects/
      project-view.mjs
  control-plane/
    control-plane-shell.mjs
    route-registry.mjs
    overview/
    operations/
    runtime/
    context/
    evidence/
    intelligence/
    security/
    governance/
    extensions/
    autonomy/
    labs/
    release/
  workers/
    diff-worker.mjs
    graph-worker.mjs
    search-worker.mjs
  styles/
    ...
```

## 26. Existing file mapping

| File 2.22.0 | Hướng xử lý |
|---|---|
| `ui/app.js` | Tách shell/router/store/render adapters; không copy nguyên file sang v3 |
| `ui/index.html` | Dùng làm source inventory; v3 index chỉ chứa shell mounts/dialog host |
| `ui/style.css` | Chuyển giá trị đã chứng minh tốt vào token; loại style fragmented |
| `ui/ui-state.mjs` | Mở rộng thành store theo slice, giữ API compatibility khi hợp lý |
| `ui/refresh-coalescer.mjs` | Giữ và nâng thành event scheduler chung |
| `ui/workroom.js` | Chia file tree/editor/terminal; giữ API/file service integration |
| `ui/diff-review-center.js` | Chuyển logic quyết định sang review model; UI thành virtualized diff viewport |
| `ui/goal-os.js` | Tách tầng 1 plan/details và tầng 2 Goal OS sâu |
| `ui/*-center.js` | Chuyển thành Control Plane route adapters theo domain |
| `ui/*-center.css` | Không mang nguyên; map sang tokens/components/pages |
| `src/app.mjs` | Chọn `uiRoot` theo build/feature flag trong giai đoạn migration |
| `src/server/http-server.mjs` | Giữ static safety; hỗ trợ hashed assets nếu build manifest yêu cầu |
| release verifiers | Thay kiểm tra file cứng bằng capability/UI manifest coverage |

---

# Phần X — Implementation Plan

## 27. Nguyên tắc thực thi

- Mỗi task tạo ra một lát cắt chạy được và có test riêng.
- TDD cho router/store/component contracts và release gates.
- Visual polish không được thực hiện trước khi state/error/keyboard hoàn chỉnh.
- Mỗi task kết thúc bằng commit nhỏ.
- Không xóa UI cũ trước khi v3 vượt toàn bộ release gates.

## Task 1: Freeze capability inventory and UI contract

**Files:**
- Create: `src/ui/capability-registry.mjs`
- Create: `scripts/audit-ui-capability-coverage.mjs`
- Create: `tests/ui-capability-registry.test.mjs`
- Modify: `src/app.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `registerUiCapability(definition)`, `listUiCapabilities()`, `validateUiCapability(definition)`.
- Each definition includes `id`, `domain`, `controlPlaneRoute`, `levelOneExposure`, `apiRoutes`, `states`, `permissions`.

- [ ] **Step 1: Write the failing registry test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUiCapability } from '../src/ui/capability-registry.mjs';

test('UI capability requires a route and complete state model', () => {
  assert.throws(() => validateUiCapability({ id: 'runtime' }), /controlPlaneRoute/);
  const value = validateUiCapability({
    id: 'runtime', domain: 'runtime', controlPlaneRoute: '/runtime/processes',
    levelOneExposure: 'status-only', apiRoutes: ['/api/runtime'],
    states: ['loading', 'ready', 'empty', 'degraded', 'error'], permissions: []
  });
  assert.equal(value.id, 'runtime');
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `node --test tests/ui-capability-registry.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict validation and immutable registry output**

The validator rejects missing fields, duplicate IDs, duplicate routes and state models without all five standard states.

- [ ] **Step 4: Register every current `CENTER_SPECS` capability**

Coverage must include all 16 existing centers plus Workroom, Provider Connections, Goal OS and Diff Review.

- [ ] **Step 5: Add audit command**

```json
"audit:ui-capabilities": "node scripts/audit-ui-capability-coverage.mjs"
```

- [ ] **Step 6: Verify**

Run: `npm run audit:ui-capabilities && npm test`

Expected: coverage reports zero unregistered UI capabilities and existing suite passes.

- [ ] **Step 7: Commit**

```bash
git add src/ui scripts/audit-ui-capability-coverage.mjs tests/ui-capability-registry.test.mjs package.json src/app.mjs
git commit -m "chore(ui): register capability contracts for v3"
```

## Task 2: Capture performance and visual baseline for 2.22.x

**Files:**
- Create: `scripts/capture-ui-performance-baseline.mjs`
- Create: `tests/ui-performance-budget.test.mjs`
- Create: `docs/ui-v3/performance-baseline.json`
- Modify: `package.json`

**Interfaces:**
- Produces JSON fields: `readyToShowMs`, `homeInteractiveMs`, `routeSwitchMs`, `rendererMemoryBytes`, `domNodes`, `longTasks`, `idleCpuEstimate`.

- [ ] Write a failing test that validates the baseline schema and rejects missing metrics.
- [ ] Implement a capture harness using Electron/Chromium performance entries already available to the app; do not add analytics network calls.
- [ ] Record baseline on the reference 8 GB Windows machine and on CI where supported.
- [ ] Add `npm run benchmark:ui`.
- [ ] Store machine metadata with the result so comparisons are not mixed across hardware.
- [ ] Verify schema test and capture script.
- [ ] Commit with message `test(ui): establish v3 performance baseline`.

## Task 3: Create isolated UI v3 build and fallback switch

**Files:**
- Create: `ui-v3/index.html`
- Create: `ui-v3/app.mjs`
- Create: `scripts/build-ui-v3.mjs`
- Create: `tests/ui-v3-root-switch.test.mjs`
- Modify: `src/app.mjs`
- Modify: `package.json`
- Modify: packaging scripts that copy `ui/`

**Interfaces:**
- Environment: `FORGE_STUDIO_UI_VERSION=v2|v3` during development.
- Build output: `ui-dist/manifest.json` with hashed chunk paths.

- [ ] Write a failing test that starts the server with `FORGE_STUDIO_UI_VERSION=v3` and asserts the served HTML contains `data-ui-version="3"`.
- [ ] Add a safe resolver:

```js
const requestedUi = process.env.FORGE_STUDIO_UI_VERSION === 'v3' ? 'ui-dist' : 'ui';
const uiRoot = path.join(appRoot, requestedUi);
```

The resolver must verify the path exists and fall back to `ui/` only in development, not silently in stable packaging.

- [ ] Build a minimal v3 shell with no API behavior beyond rendering startup health.
- [ ] Bundle with ESM code splitting and local assets only.
- [ ] Update portable/Electron packaging tests to assert both development source and production `ui-dist` manifest.
- [ ] Verify `npm run build:ui-v3`, root switch test, packaging test and `npm run validate`.
- [ ] Commit `build(ui): add isolated v3 renderer pipeline`.

## Task 4: Implement the three-layer design token system

**Files:**
- Create: `ui-v3/styles/tokens/primitive.css`
- Create: `ui-v3/styles/tokens/semantic.css`
- Create: `ui-v3/styles/tokens/component.css`
- Create: `ui-v3/styles/base/reset.css`
- Create: `ui-v3/styles/base/typography.css`
- Create: `scripts/validate-ui-tokens.mjs`
- Create: `tests/ui-v3-tokens.test.mjs`

**Interfaces:**
- CSS components may consume semantic/component variables only.
- Raw hex is allowed only in `primitive.css` and generated fallback files.

- [ ] Write test scanning `ui-v3/styles/components` and `pages` for raw `#[0-9a-f]` colors.
- [ ] Add the exact token hierarchy in this document.
- [ ] Add token validation for undefined variables and cyclic references.
- [ ] Add contrast test fixtures for primary text, secondary text, danger, focus and selected row.
- [ ] Import layers in deterministic order:

```css
@layer reset, tokens, base, layout, components, pages, utilities;
```

- [ ] Verify token tests and browser rendering in v3 shell.
- [ ] Commit `feat(ui): establish Forge Quiet Authority design tokens`.

## Task 5: Build the lightweight AppShell and router

**Files:**
- Create: `ui-v3/core/router.mjs`
- Create: `ui-v3/core/ui-store.mjs`
- Create: `ui-v3/core/ui-bus.mjs`
- Create: `ui-v3/shell/app-shell.mjs`
- Create: `ui-v3/shell/global-rail.mjs`
- Create: `ui-v3/styles/layout/app-shell.css`
- Create: `tests/ui-v3-router.test.mjs`
- Create: `tests/ui-v3-shell.test.mjs`

**Interfaces:**

```js
router.register({ id, pattern, load, title });
router.navigate(path, { replace = false, state = null } = {});
store.select(selector, listener);
store.dispatch(action);
```

- [ ] Test route registration, unknown route fallback, back navigation and lazy loader called once.
- [ ] Implement rail with exactly the approved destinations; test that technical centers do not appear as separate rail buttons.
- [ ] Preserve focus when route changes and announce page title.
- [ ] Ensure route switch does not recreate rail/sidebar.
- [ ] Add keyboard shortcuts for command, mission, review, workroom and Control Plane.
- [ ] Verify route switch p95 against local budget.
- [ ] Commit `feat(ui): add v3 application shell and lazy router`.

## Task 6: Build Session Sidebar and project switcher

**Files:**
- Create: `ui-v3/shell/session-sidebar.mjs`
- Create: `ui-v3/shell/project-switcher.mjs`
- Create: `ui-v3/core/session-view-model.mjs`
- Create: `ui-v3/styles/components/session-sidebar.css`
- Create: `tests/ui-v3-session-sidebar.test.mjs`

**Interfaces:**

```js
buildSessionGroups(runs, approvals) => {
  needsYou: [], running: [], review: [], recent: []
}
```

- [ ] Test deterministic grouping and priority.
- [ ] Test that `Needs You` outranks running and that archived tasks are excluded.
- [ ] Render rows keyed by mission ID; patch status/title without replacing the list.
- [ ] Add keyboard navigation, context menu and search.
- [ ] Virtualize recent tasks after 100 rows.
- [ ] Verify focus/scroll remain stable during SSE updates.
- [ ] Commit `feat(ui): add action-oriented mission sidebar`.

## Task 7: Build Home and Mission Composer

**Files:**
- Create: `ui-v3/views/home/home-view.mjs`
- Create: `ui-v3/views/home/mission-composer.mjs`
- Create: `ui-v3/core/intent-presets.mjs`
- Create: `ui-v3/styles/pages/home.css`
- Create: `tests/ui-v3-home.test.mjs`

**Interfaces:**

```js
createMissionRequest({ objective, projectId, intent, modelChoice, attachments, options })
```

- [ ] Test four intent presets map to enforceable backend mode boundaries.
- [ ] Test empty objective, missing project and unavailable provider states.
- [ ] Implement composer autosize without layout loops.
- [ ] Keep advanced mission options in a popover; persist per-project defaults only after explicit choice.
- [ ] Render repository-based suggestions only when evidence says they are available.
- [ ] Verify submit produces the same API payload semantics as 2.22.0.
- [ ] Commit `feat(ui): create focused mission entry experience`.

## Task 8: Build incremental Mission Workspace

**Files:**
- Create: `ui-v3/views/mission/mission-view.mjs`
- Create: `ui-v3/views/mission/mission-header.mjs`
- Create: `ui-v3/views/mission/status-strip.mjs`
- Create: `ui-v3/views/mission/activity-timeline.mjs`
- Create: `ui-v3/views/mission/activity-item.mjs`
- Create: `ui-v3/views/mission/mission-composer.mjs`
- Create: `ui-v3/core/mission-view-model.mjs`
- Create: `tests/ui-v3-mission-incremental.test.mjs`

**Interfaces:**

```js
missionView.update({ headerPatch, messageEvents, activityEvents, artifactEvents });
activityTimeline.upsert(activity);
activityTimeline.setFollowMode('auto' | 'manual');
```

- [ ] Test heartbeat update does not replace message or activity nodes.
- [ ] Test append, update, group and collapse behavior by stable IDs.
- [ ] Test user scroll disables auto-follow until they return near bottom.
- [ ] Implement phase status without fake percentages.
- [ ] Implement batched live regions and streaming text flush.
- [ ] Suspend heavy updates when mission is not active.
- [ ] Verify 5,000 synthetic activities remain navigable under memory/latency budget.
- [ ] Commit `feat(ui): render mission activity incrementally`.

## Task 9: Implement approval, permission and recovery cards

**Files:**
- Create: `ui-v3/views/mission/approval-card.mjs`
- Create: `ui-v3/views/mission/permission-card.mjs`
- Create: `ui-v3/views/mission/recovery-card.mjs`
- Create: `ui-v3/core/risk-copy.mjs`
- Create: `tests/ui-v3-approval-flow.test.mjs`

**Interfaces:**

```js
formatRiskMoment(event) => { title, reason, impact, scope, reversibility, actions, technical };
```

- [ ] Test destructive, outside-workspace, network, dependency, plugin and database cases.
- [ ] Test no permission can be granted without scope and expiry.
- [ ] Pin active request below header and move session to `Needs You`.
- [ ] Keep technical capability/lease identifiers in expandable detail.
- [ ] Restore focus to triggering context after decision.
- [ ] Verify denial and timeout states.
- [ ] Commit `feat(ui): make agent risk moments legible`.

## Task 10: Build contextual Artifact Dock

**Files:**
- Create: `ui-v3/views/mission/artifact-dock.mjs`
- Create: `ui-v3/views/mission/artifact-registry.mjs`
- Create: `ui-v3/views/mission/artifacts/plan-artifact.mjs`
- Create: `ui-v3/views/mission/artifacts/tests-artifact.mjs`
- Create: `ui-v3/views/mission/artifacts/preview-artifact.mjs`
- Create: `tests/ui-v3-artifact-dock.test.mjs`

**Interfaces:**

```js
artifactRegistry.register({ kind, label, priority, loadRenderer });
artifactDock.setArtifacts(missionId, artifacts);
artifactDock.open(kind);
```

- [ ] Test only available artifact tabs render.
- [ ] Test dock state persists per mission.
- [ ] Implement lazy renderer loading and teardown.
- [ ] Add resize with pointer and keyboard, clamped 360–720 px.
- [ ] Add preview states: starting, loading, ready, app-error, disconnected.
- [ ] Verify hidden preview stops polling and background work.
- [ ] Commit `feat(ui): add contextual mission artifact dock`.

## Task 11: Build Review & Ship as a first-class workflow

**Files:**
- Create: `ui-v3/views/review/review-view.mjs`
- Create: `ui-v3/views/review/change-navigator.mjs`
- Create: `ui-v3/views/review/diff-viewport.mjs`
- Create: `ui-v3/views/review/verification-summary.mjs`
- Create: `ui-v3/views/review/ship-actions.mjs`
- Create: `ui-v3/workers/diff-worker.mjs`
- Create: `tests/ui-v3-review-flow.test.mjs`
- Modify: adapter around current diff-review API

**Interfaces:**

```js
reviewModel.load(missionId);
reviewModel.decide({ file, hunkId, decision, reason });
reviewModel.requestChange({ file, hunkId, comment });
reviewModel.ship(action);
```

- [ ] Test file/hunk decisions preserve evidence binding.
- [ ] Test large diff is chunked/virtualized and cancellation works.
- [ ] Move parsing/tokenization to worker.
- [ ] Add inline request-change flow.
- [ ] Compute review summary from actual test/security/scope evidence; never infer success from file count.
- [ ] Add explicit rollback scope dialog.
- [ ] Verify keyboard review and no focus loss after hunk decision.
- [ ] Commit `feat(ui): promote review and shipping workflow`.

## Task 12: Split Advanced Drawer into Workroom and Control Plane routes

**Files:**
- Create: `ui-v3/views/workroom/*`
- Modify: current workroom adapters for file/terminal APIs
- Create: `tests/ui-v3-workroom-lazy.test.mjs`
- Create: `tests/ui-v3-advanced-migration.test.mjs`

**Interfaces:**

```js
workroom.open({ missionId, projectId, file, panel });
workroom.close({ returnToMission: true });
```

- [ ] Test opening Home/Mission does not load Monaco/xterm.
- [ ] Test opening Workroom loads editor assets once.
- [ ] Split file tree, editor and terminal lifecycles.
- [ ] Move credential/update/rules/plugin panels out of Workroom.
- [ ] Turn browser into preview/editor artifact.
- [ ] Keep fallback textarea if Monaco install fails.
- [ ] Verify editor models and terminal views respect runtime profile limits.
- [ ] Commit `refactor(ui): split workroom from system administration`.

## Task 13: Build Control Plane shell and route registry

**Files:**
- Create: `ui-v3/control-plane/control-plane-shell.mjs`
- Create: `ui-v3/control-plane/route-registry.mjs`
- Create: `ui-v3/control-plane/overview/overview-view.mjs`
- Create: `ui-v3/styles/layout/control-plane.css`
- Create: `tests/ui-v3-control-plane-shell.test.mjs`

**Interfaces:**

```js
controlPlaneRoutes.register({ path, domain, label, load, capabilityIds });
assertCapabilityCoverage(capabilities, routes);
```

- [ ] Test every capability registry item resolves to a Control Plane route or an explicit level-one-only exception.
- [ ] Implement textual domain navigation and deep links.
- [ ] Preserve mission context in header when entering from task.
- [ ] Lazy load route chunks and isolate route errors with an error boundary module.
- [ ] Build Overview from health/action data, not decorative charts.
- [ ] Verify Control Plane failure cannot break shell/mission.
- [ ] Commit `feat(ui): establish Forge Control Plane`.

## Task 14: Migrate runtime, operations and security domains

**Files:**
- Create domain modules under `ui-v3/control-plane/operations`, `runtime`, `security`.
- Adapt current `runtime-control-center`, `sandbox-manager`, `workspace-trust-center`, `secrets-manager`, `integrated-browser-center`, `local-operations-center`, `agent-operations-center`.
- Create domain UI tests.

**Interfaces:**
- Routes exactly follow Sections 7.3, 7.4 and 7.8.
- Shared `DataTable`, `DetailDrawer`, `PermissionBadge`, `EvidenceLink` components.

- [ ] Write route coverage tests before migration.
- [ ] Normalize API payloads into shared row/detail view models.
- [ ] Replace per-center visual styles with token components.
- [ ] Pause polling when route hidden.
- [ ] Ensure secret values are never inserted into DOM.
- [ ] Verify all current actions remain available with the same permission guards.
- [ ] Commit `feat(ui): migrate operations runtime and security domains`.

## Task 15: Migrate context, evidence and intelligence domains

**Files:**
- Create domain modules under `context`, `evidence`, `intelligence`.
- Create `ui-v3/workers/graph-worker.mjs` and `search-worker.mjs`.
- Adapt Context/Memory, Trace/Evidence, Evidence Runtime, Repository Intelligence and Codebase Knowledge.

- [ ] Test provenance/confidence/freshness fields survive normalization.
- [ ] Implement hierarchical trace timeline as default; graph as secondary view.
- [ ] Virtualize symbols/references/evidence lists.
- [ ] Move graph layout/search off renderer thread.
- [ ] Remove orbit/grid/background animation and backdrop blur from repeated cards.
- [ ] Add raw data viewer loaded only on request.
- [ ] Verify large synthetic repository datasets stay within route budget.
- [ ] Commit `feat(ui): migrate intelligence context and evidence domains`.

## Task 16: Migrate governance, autonomy, extensions and release domains

**Files:**
- Create domain modules under `governance`, `autonomy`, `extensions`, `release`.
- Adapt Git Governance, Instruction Governance, Agent Modes, Mission State, Provider Connections, Plugin Review and Signed Update.

- [ ] Test instruction precedence stack and conflict presentation.
- [ ] Test 4 intent presets map to detailed modes without losing constraints.
- [ ] Replace mode-card wall with searchable table/detail/compare.
- [ ] Keep plugin quarantine and capability review explicit.
- [ ] Move signed update out of Workroom and preserve signature/rollback states.
- [ ] Verify provider and plugin credentials remain outside renderer logs.
- [ ] Commit `feat(ui): complete Control Plane domain migration`.

## Task 17: Implement motion, visibility scheduling and performance policies

**Files:**
- Create: `ui-v3/styles/motion.css`
- Create: `ui-v3/core/scheduler.mjs`
- Create: `ui-v3/core/visibility-policy.mjs`
- Create: `ui-v3/core/performance-observer.mjs`
- Create: `tests/ui-v3-motion-policy.test.mjs`
- Modify: runtime performance policy adapter

**Interfaces:**

```js
scheduler.enqueue(key, callback, { priority: 'frame' | 'idle' | 'background' });
visibilityPolicy.subscribe(surfaceId, listener);
```

- [ ] Test no forbidden animated properties in component/page CSS.
- [ ] Test reduced motion disables nonessential transitions and continuous animation.
- [ ] Batch event stream updates through scheduler.
- [ ] Suspend hidden preview, terminal repaint, graph and polling.
- [ ] Report long tasks and memory budgets locally without network telemetry.
- [ ] Verify performance budgets on reference machine.
- [ ] Commit `perf(ui): enforce lightweight motion and rendering budgets`.

## Task 18: Accessibility, visual regression and release gate

**Files:**
- Create: `scripts/audit-ui-v3-accessibility.mjs`
- Create: `scripts/capture-ui-v3-states.mjs`
- Create: `scripts/verify-ui-v3-release.mjs`
- Create: `tests/ui-v3-accessibility.test.mjs`
- Create: `tests/ui-v3-release-gate.test.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: packaging/update verifiers

**Interfaces:**
- Release report includes capability coverage, keyboard paths, contrast, reduced motion, DOM budgets, long tasks, memory, visual states and missing empty/error/loading states.

- [ ] Build deterministic fixture data for all core states; no secret or hidden simulator data.
- [ ] Capture Home, onboarding, running, planning, approval, permission, failure, review, workroom and every Control Plane domain at 1440, 1180 and 900 widths.
- [ ] Test keyboard-only completion of new mission, approval, review and rollback cancel.
- [ ] Test focus restore for every dialog/popover/drawer.
- [ ] Run all 350+ existing tests plus v3 suite.
- [ ] Run `npm run validate`, Electron packaging, portable packaging, smoke and release matrix.
- [ ] Fail release when any capability is missing, any primary route crashes, or performance budget regresses beyond approved threshold.
- [ ] Commit `test(ui): gate ForgeStudio 3.0 experience`.

---

# Phần XI — Test matrix

## 28. Functional states bắt buộc

Mỗi surface phải có ít nhất:

- Loading.
- Ready with data.
- Empty.
- Degraded/partial.
- Error with recovery.
- Permission denied nếu áp dụng.
- Offline/provider unavailable nếu áp dụng.

## 29. Core journeys

### Journey A — Người bình thường

1. Mở app.
2. Chọn project.
3. Nhập mục tiêu.
4. Forge lập plan hoặc tự chạy theo preset.
5. User trả lời một câu hỏi/approval.
6. Xem preview/artifact.
7. Chấp nhận kết quả.

Không cần mở terminal, evidence hoặc Control Plane.

### Journey B — Developer

1. Chọn repository.
2. Tạo Build mission trong worktree.
3. Steer trong lúc chạy.
4. Mở changed file trong Workroom.
5. Review diff theo hunk.
6. Xem focused/full test evidence.
7. Commit/push/PR.

### Journey C — Researcher/admin

1. Mở mission có vấn đề.
2. Deep-link vào Evidence/Trace.
3. Xem context provenance.
4. Kiểm tra lease/policy.
5. Điều chỉnh mode/permission.
6. Export evidence bundle.
7. Quay lại đúng mission state.

### Journey D — Recovery

1. Provider thất bại.
2. Fallback/recovery chạy.
3. UI giải thích trạng thái, không treo animation.
4. Nếu cần, user đổi provider hoặc retry checkpoint.
5. Mission tiếp tục không reset toàn bộ.

## 30. Visual QA checklist

- Hierarchy nhìn rõ khi blur mắt/screenshot thu nhỏ.
- Không có hơn một primary button trong một decision area.
- Không có empty card chỉ để lấp chỗ.
- Không có tab trống.
- Không có heading gradient trong surface làm việc.
- Không có text < 11 px cần đọc.
- Không có border tím quanh card không selected.
- Không có icon không tooltip.
- Không có tooltip chứa action bắt buộc.
- Không có layout shift khi status text đổi.
- Không có control nhảy khi scrollbar xuất hiện.
- Không có shimmer/pulse chạy ở phần không visible.
- Không có modal dùng cho success.
- Không có raw JSON mặc định.
- Không có table thiếu empty/error/loading.
- Không có disabled button mà không giải thích nguyên nhân khi người dùng cần nó.

## 31. Performance QA checklist

- Profile cold launch.
- Profile first mission open.
- Profile 5,000 activities.
- Profile 50,000 diff lines.
- Profile repository intelligence dataset lớn.
- Profile mở/đóng Workroom 20 lần và kiểm tra memory leak.
- Profile chuyển 100 missions và kiểm tra detached DOM.
- Profile hidden window 10 phút.
- Profile provider disconnected/reconnected loop.
- Profile Control Plane route failure.
- Verify no timer/observer/worker remains after destroy.

## 32. Accessibility QA checklist

- Keyboard only.
- Screen reader smoke.
- 200% zoom.
- Windows high contrast.
- Reduced motion.
- Color blindness checks cho status/diff.
- Focus visible trên dark surface.
- Dialog focus restore.
- Live region không đọc lại toàn timeline.
- Error liên kết tới field/action tương ứng.

---

# Phần XII — Quyết định cần bảo vệ trong review code

## 33. Architectural decision records

### ADR-UI-001 — Two-layer product architecture

**Decision:** Tầng 1 Workspace, tầng 2 Control Plane.

**Reject:** một rail chứa mọi center hoặc một dashboard duy nhất chứa mọi capability.

### ADR-UI-002 — No framework rewrite for 3.0

**Decision:** ESM/native DOM + build-time bundling.

**Reject:** React/Vue migration chỉ vì muốn component hóa.

### ADR-UI-003 — Review is a workflow

**Decision:** Review & Ship là route/state chính thức.

**Reject:** diff/test chỉ là tab phụ trong inspector.

### ADR-UI-004 — Contextual artifact dock

**Decision:** chỉ hiện artifact có nội dung.

**Reject:** năm tab cố định kể cả khi trống.

### ADR-UI-005 — Control Plane is lazy and fault-isolated

**Decision:** route chunk riêng, error isolation, không tải lúc startup.

**Reject:** import toàn bộ center vào shell.

### ADR-UI-006 — Composite-only motion

**Decision:** transform/opacity, duration ≤ 300 ms, reduced motion.

**Reject:** blur/orbit/particle/layout animation liên tục.

### ADR-UI-007 — Capability registry is source of truth

**Decision:** mọi feature có UI contract và coverage audit.

**Reject:** thêm một button/icon trực tiếp mỗi khi có feature mới.

---

# Phần XIII — Định nghĩa “UI triệu đô” cho ForgeStudio

## 34. Không đo bằng screenshot

Một screenshot có thể đẹp nhưng sản phẩm vẫn rẻ tiền nếu:

- Click chậm.
- Scroll giật.
- Task đổi trạng thái làm nhảy layout.
- Permission khó hiểu.
- Diff không review được.
- Error chỉ có mã kỹ thuật.
- Người dùng không biết cần làm gì tiếp.

UI triệu đô của ForgeStudio được đo bằng:

1. **Time to first mission:** nhanh.
2. **Time to understand state:** dưới vài giây.
3. **Time to review:** ngắn hơn đọc log thô.
4. **Error recovery:** không mất công việc.
5. **Trust:** scope, permission, evidence và rollback rõ.
6. **Performance:** mượt trên máy 8 GB.
7. **Depth:** chuyên gia vẫn điều tra được mọi thứ.
8. **Consistency:** mọi module trông thuộc cùng một sản phẩm.

## 35. North-star experience

Người dùng mở ForgeStudio và thấy một không gian yên tĩnh. Họ chọn project, viết mục tiêu, bấm gửi. Forge phân tích và chỉ hỏi đúng điều cần hỏi. Khi chạy, giao diện kể lại tiến trình bằng các phase và action group, không đổ log. Khi cần quyền, lý do và tác động xuất hiện rõ. Khi có kết quả, preview, diff, tests và risk summary cùng nằm trong một workflow review. Người dùng chấp nhận, commit hoặc rollback với sự tự tin.

Nhà nghiên cứu bấm Control Plane và ngay lập tức có toàn bộ context, evidence, trace, mission graph, runtime, governance và repository intelligence — nhưng không một phần nào trong số đó làm chậm hoặc làm rối trải nghiệm của người dùng bình thường.

Đó là lợi thế mà ForgeStudio có thể vượt các agent UI khác: **đơn giản ở bề mặt nhưng không nghèo nàn; sâu ở bên trong nhưng không nặng nề.**

---
# Phần XIV — Component state specification

## 36. Buttons

### Primary

- Chỉ một primary trong một decision group.
- Height 36 px bình thường, 40 px ở onboarding/hero.
- Loading giữ nguyên width, thay label bằng progress text ngắn hoặc spinner 14 px + label.
- Không vô hiệu hóa sau click nếu action đang chạy mà không có trạng thái; chuyển sang loading.
- Destructive primary chỉ dùng trong confirmation cuối.

### Secondary

- Surface raised + subtle border.
- Không cạnh tranh với primary bằng màu accent.

### Ghost/icon

- Hover surface 5% white.
- Tooltip sau 450–600 ms; keyboard focus hiển thị ngay.
- Active press scale tối đa `.98`, 80 ms; reduced motion tắt.

## 37. Inputs và composer

- Label luôn tồn tại cho form settings; placeholder không thay label.
- Composer có focus border rõ nhưng không glow dày.
- Autosize tối đa 8 dòng, sau đó scroll bên trong.
- Attachment chip hiển thị name/type/size và remove.
- Slash/mention menu dùng virtual list khi dài.
- Validation xuất hiện sau blur hoặc submit, không cảnh báo từng phím.
- Secret input không echo vào DOM attribute/log.

## 38. Menus, popovers và command palette

- Command palette là một search/action surface duy nhất cho route, mission, file và command.
- Kết quả phân nhóm: Navigate, Missions, Files, Actions, Control Plane.
- Keyboard selection không cuộn page nền.
- Popover tự lật khi thiếu không gian; không vượt viewport.
- Context menu không chứa action không áp dụng; nếu disabled, phải có lý do trong tooltip.

## 39. Tabs

- Dùng khi các view ngang hàng và số lượng ổn định 2–6.
- Không dùng tab cho domain navigation tầng 2; dùng sidebar/routes.
- Tab không có nội dung thì không render.
- Tab badge chỉ hiển thị số cần chú ý, không hiển thị toàn bộ item count.

## 40. Tables

- Header sticky khi cần.
- Row height Comfortable 40–44 px; Compact 32–36 px.
- Selection checkbox chỉ xuất hiện khi có batch action.
- Column action ghim phải hoặc nằm trong menu.
- Column resize không animation.
- Empty state nằm trong body và giải thích filter/no data khác nhau.
- Table lớn phải virtualize và giữ keyboard navigation.

## 41. Cards

Card chỉ dùng khi nhóm nội dung cần boundary. Không card hóa từng dòng dữ liệu.

Các loại hợp lệ:

- Decision card.
- Summary card.
- Artifact card.
- Empty/error card.
- Metric strip item.

Không có “card trong card trong card” quá hai lớp.

## 42. Status

Mỗi status gồm ít nhất hai trong ba yếu tố:

- Màu.
- Icon/shape.
- Text.

Taxonomy duy nhất:

- Neutral.
- Active/info.
- Success.
- Warning/needs attention.
- Danger/failure.
- Paused.

Không tạo màu riêng cho từng center.

## 43. Toast

- Success confirmation: 3–4 giây.
- Error có action: tồn tại đến khi dismiss hoặc action.
- Tối đa ba toast visible; phần còn lại queue.
- Toast không dùng cho permission/approval.
- Không che composer hoặc primary ship action.

## 44. Dialog

- Max width 480 px bình thường, 720 px cho settings/review detail.
- Header/body/footer rõ.
- Primary ở phải theo Windows convention hiện có; destructive tách và có copy cụ thể.
- Không animate backdrop blur; backdrop opacity 120 ms, dialog transform/opacity 220–260 ms.
- Không đóng khi click backdrop nếu người dùng đang nhập secret hoặc xác nhận action rủi ro.

## 45. Empty states

Empty state phải thuộc một trong bốn loại:

1. **First use:** giải thích và có action bắt đầu.
2. **No result:** gợi ý sửa filter/search.
3. **Not available yet:** nói điều kiện tạo dữ liệu.
4. **Unavailable/error:** lý do và recovery.

Không dùng illustration lớn ở Control Plane. Home có thể dùng Forge mark rất nhẹ.

---

# Phần XV — Design review rubric

## 46. Chấm điểm mỗi màn hình trước khi merge

Mỗi tiêu chí 0–2; dưới 16/20 không merge.

| Tiêu chí | 0 | 1 | 2 |
|---|---|---|---|
| Mục tiêu | Không rõ | Có thể đoán | Hiểu trong 3 giây |
| Primary action | Nhiều/không có | Có nhưng cạnh tranh | Một action rõ |
| Hierarchy | Phẳng/rối | Tạm ổn | Rõ khi nhìn lướt |
| Progressive disclosure | Đổ hết chi tiết | Một phần ẩn | Đúng tầng/ngữ cảnh |
| State coverage | Thiếu | Có loading/error | Đủ loading/empty/degraded/error |
| Trust | Mơ hồ | Có status | Scope/risk/reversibility rõ |
| Keyboard/accessibility | Không dùng được | Dùng một phần | Hoàn chỉnh |
| Motion | Nặng/gây nhiễu | Chấp nhận | Hướng dẫn và mượt |
| Performance | Không đo | Qua cảm nhận | Qua budget/profile |
| Consistency | Style riêng | Gần token | Hoàn toàn theo system |

## 47. Câu hỏi bắt buộc trong PR UI

- Surface này thuộc tầng 1 hay tầng 2? Vì sao?
- Người dùng cần quyết định gì ở đây?
- Chi tiết nào có thể giấu đến khi mở rộng?
- Khi API loading/empty/degraded/error, UI trông thế nào?
- Surface bị destroy có dọn timer/observer/worker không?
- Có render lại node không liên quan khi state đổi không?
- Motion dùng property nào và giảm motion ra sao?
- Capability registry và route coverage đã cập nhật chưa?
- Screenshot ở 1440/1180/900 có qua không?
- Performance trace có long task mới không?

---

# Phần XVI — Source audit appendix

## 48. Dữ liệu thực tế từ ForgeStudio 2.22.0

Tại thời điểm lập tài liệu:

- `ui/index.html`: 262 dòng.
- JavaScript/ESM trực tiếp trong `ui/`: khoảng 3.162 dòng.
- 28 phép gán `.innerHTML =` trong UI modules.
- 16 center được đăng ký trong `CENTER_SPECS`.
- 13 lần dùng `backdrop-filter` trong CSS.
- 32 khai báo `animation:` trong CSS.
- 15 media rule/occurrence liên quan `prefers-reduced-motion`.
- 32 test file có tên chứa `ui`.
- 350 Node test files tổng cộng.

Các con số này không tự động chứng minh UI nặng hoặc nhẹ; chúng là baseline để theo dõi độ phức tạp. Đặc biệt, CSS nhiều module đang được viết một dòng nên line count CSS không có ý nghĩa tốt; nên theo dõi byte size, selector count, style recalculation và paint cost thay vì số dòng.

## 49. Rủi ro migration cụ thể

### Release verifiers phụ thuộc đường dẫn UI cũ

Nhiều verifier/test đang đọc trực tiếp `ui/index.html`, `ui/app.js` và tên center file. Vì vậy:

- Không đổi đường dẫn toàn bộ trong một commit.
- Tạo manifest/compatibility adapter.
- Chuyển verifier từ “file tồn tại” sang “capability có route và release evidence”.
- Giữ test nghiệp vụ backend độc lập với markup cụ thể.

### Packaging phụ thuộc `app/ui/index.html`

Portable/Electron packaging test đang xác nhận thư mục `ui/`. Build v3 phải tạo `ui-dist/` rồi packaging copy đến đường dẫn production đã chốt, hoặc thay `ui/` atomically sau build. Không ship source modules dư nếu không cần.

### Static server path

`src/app.mjs` truyền `uiRoot: path.join(appRoot, 'ui')`. Giai đoạn migration cần resolver có kiểm tra path và manifest. Không lấy path từ request/user input.

### Center actions có side effects

Migrate presentation nhưng không gọi API theo cách mới nếu chưa có contract test. Mọi action runtime/security/governance phải giữ auth, CSRF/token và permission behavior hiện tại.

---

# Phần XVII — Ưu tiên thực tế

## 50. Nếu nguồn lực chỉ đủ cho 20% thay đổi

Làm theo thứ tự:

1. Dọn rail: chỉ giữ entry tầng 1 + Control Plane.
2. Session Sidebar theo `Needs You / Running / Review / Recent`.
3. Mission activity grouping và status strip.
4. Artifact Dock context-aware.
5. Review & Ship first-class.
6. Tách Workroom khỏi vault/update/plugin.
7. Gom center vào Control Plane shell chung.
8. Token thống nhất và bỏ hiệu ứng nặng.

Chỉ tám thay đổi này đã làm ForgeStudio trông như một sản phẩm agent cấp cao thay vì một tập hợp center.

## 51. Nếu nguồn lực đủ cho bản hoàn thiện

Thực hiện toàn bộ 18 tasks, đặc biệt:

- Incremental DOM.
- Virtualized diff/trace/list.
- Worker offload.
- Capability coverage.
- Performance release gate.
- Accessibility/visual regression.
- Copy system và risk moments.

---

# Phần XVIII — Nguồn nghiên cứu chính thức

> Truy cập và đối chiếu ngày 31 tháng 7 năm 2026. Tính năng sản phẩm có thể tiếp tục thay đổi; khi bắt đầu triển khai 3.0.0 cần chạy lại research freshness audit.

## 52. Design system và UI/UX

1. UI UX Pro Max repository: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
2. UI UX Pro Max design-system skill: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/design-system/SKILL.md>
3. Microsoft — Guidelines for Human-AI Interaction: <https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/>
4. WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
5. Web.dev — Animation performance guide: <https://web.dev/articles/animations-guide>

## 53. Agent interfaces toàn cầu

6. OpenAI — Introducing the Codex app: <https://openai.com/index/introducing-the-codex-app/>
7. Claude Code Desktop documentation: <https://code.claude.com/docs/en/desktop>
8. Cursor — New Cursor Interface / Agents Window: <https://cursor.com/changelog/3-0>
9. GitHub — Copilot App agent sessions: <https://docs.github.com/en/copilot/how-tos/github-copilot-app/agent-sessions>
10. Windsurf 2.0 / Agent Command Center: <https://windsurf.com/switch/cursor>
11. Windsurf Cascade modes: <https://docs.windsurf.com/windsurf/cascade/modes>
12. Kiro Specs: <https://kiro.dev/docs/web/specs/>
13. Zed Agent Profiles: <https://zed.dev/docs/ai/agent-profiles>
14. Replit Checkpoints and Rollbacks: <https://docs.replit.com/features/version-control/checkpoints-and-rollbacks>

## 54. Agent interfaces Trung Quốc

15. Qoder Quest overview: <https://docs.qoder.com/user-guide/quest/overview>
16. Tencent CodeBuddy Agents quickstart: <https://www.codebuddy.ai/docs/ide/User-guide/Agent-Mode/Quickstart>
17. Alibaba Lingma April 2026 updates: <https://www.alibabacloud.com/help/en/lingma/product-overview/april-2026-product-announcement>
18. TRAE SOLO: <https://www.trae.ai/blog/product_solo>

## 55. Electron performance

19. Electron Performance: <https://www.electronjs.org/docs/latest/tutorial/performance>
20. Electron Security: <https://www.electronjs.org/docs/latest/tutorial/security>

---

# Phần XIX — Final release checklist

## 56. Product structure

- [ ] Rail tầng 1 không có technical-center sprawl.
- [ ] Tất cả capability có registry entry.
- [ ] Tất cả center 2.22.0 có route hoặc exposure rule ở 3.0.0.
- [ ] Control Plane deep-link và back-to-mission hoạt động.
- [ ] Workroom không chứa secrets/update/plugin administration.

## 57. Core experience

- [ ] Home gửi mission với tối đa bốn control mặc định.
- [ ] Running mission có phase, action grouping và steer.
- [ ] Approval/permission luôn nổi bật.
- [ ] Artifact Dock chỉ hiện nội dung có thật.
- [ ] Review & Ship xử lý file/hunk/test/risk/rollback.
- [ ] Multi-agent được nén thành task/subagent HUD dễ đọc.

## 58. Visual system

- [ ] Tất cả component dùng token.
- [ ] Không raw hex ngoài primitive/generated fallback.
- [ ] Không center có theme thương hiệu riêng.
- [ ] Không gradient heading trong work surface.
- [ ] Không blur lặp/card sci-fi animation.
- [ ] Typography, spacing, radius và icon đồng nhất.

## 59. Performance

- [ ] Shell không import Monaco/xterm/Control Plane.
- [ ] Event updates theo state slice.
- [ ] Lists/diff/trace lớn được virtualize.
- [ ] Heavy parse/graph/search ở worker.
- [ ] Hidden surfaces suspend work.
- [ ] Performance budgets đạt trên máy 8 GB.
- [ ] Không memory leak sau route/workroom stress test.

## 60. Trust, accessibility và release

- [ ] Risk moments có impact/scope/reversibility.
- [ ] Keyboard journeys hoàn chỉnh.
- [ ] Reduced motion hoàn chỉnh.
- [ ] Contrast WCAG AA.
- [ ] Empty/loading/degraded/error states đầy đủ.
- [ ] Existing backend/security tests đều qua.
- [ ] Packaging, update, portable và Electron gates đều qua.
- [ ] UI v2 recovery đã được kiểm thử trước khi stable switch.

---

## 61. Kết luận cuối cùng

ForgeStudio 2.22.0 không thiếu chiều sâu; nó đang thiếu **sự biên tập**. Sản phẩm đã có nhiều hệ thống mà agent UI phổ biến không phơi bày được: evidence, governance, context orchestration, runtime control, mission state, trust và local operations. Nếu tiếp tục thêm những center ngang hàng, giao diện sẽ ngày càng giống công cụ nội bộ và càng khó đạt độ sang trọng.

ForgeStudio 3.0.0 phải làm điều ngược lại:

- Giảm số thứ người dùng thấy.
- Tăng độ rõ của những gì đang xảy ra.
- Đưa review và quyết định lên trước.
- Giữ toàn bộ nghiên cứu ở Control Plane.
- Dùng token và component thống nhất.
- Dùng motion để giải thích, không để trang trí.
- Dùng hiệu năng như một phần của thẩm mỹ.
- Đo mọi lời hứa trên máy 8 GB.

Khi thực hiện đúng, tầng ngoài của ForgeStudio sẽ dễ dùng và thanh lịch như các agent app tốt nhất, trong khi tầng trong vẫn sâu hơn đáng kể. Đây không phải thiết kế “giống Codex/Cursor/Claude Code”. Đây là kiến trúc để ForgeStudio trở thành một **AI engineering workspace có control plane riêng**, với vẻ ngoài điềm tĩnh, tốc độ local và độ kiểm chứng mà sản phẩm khác thường giấu hoặc không có.
