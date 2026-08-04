# Nolane Agent 5.0.0-beta.6 — Remaining Gaps Report

- Tổng yêu cầu: **198**
- Còn lại: **5**
- Hoàn thành một phần: **0**
- Cổng bên ngoài: **5**
- Chưa triển khai: **0**
- Audit SHA-256: `c03d6c18c07eca8a6a5f35028b926c74f873801b9df2d1baaf69afe9401a7b86`
- Receipt SHA-256: `44cdaa21cd32a5eb28cfef0e7c9a0a4c519a5e4d12f2d2fc1a09b95f58d7d144`

> Báo cáo này liệt kê toàn bộ item chưa ở trạng thái source + test. Không có item nào bị ẩn hoặc gộp mất.

## 1. UI v3

### NOL-UI-002 — Capture a machine-labelled Windows 8 GB performance and visual baseline

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Acceptance ledger chưa cho phép nâng lên verified_source_test.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/superiority/deep/local-ui-certification-lab.mjs, tests/deep-superiority-ui-dogfood.test.mjs

### NOL-UI-030 — Meet WCAG 2.2 AA, keyboard, focus, live-region and reduced-motion requirements

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Acceptance ledger chưa cho phép nâng lên verified_source_test.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/superiority/deep/local-ui-certification-lab.mjs, tests/deep-superiority-ui-dogfood.test.mjs

### NOL-UI-031 — Meet responsive desktop layouts from 640 px through 1440 px and above

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Acceptance ledger chưa cho phép nâng lên verified_source_test.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/superiority/deep/local-ui-certification-lab.mjs, tests/deep-superiority-ui-dogfood.test.mjs

### NOL-UI-032 — Pass DOM, memory, idle CPU, long-task, latency and visual release budgets

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Acceptance ledger chưa cho phép nâng lên verified_source_test.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/superiority/deep/local-ui-certification-lab.mjs, tests/deep-superiority-ui-dogfood.test.mjs

## 2. Proof-driven audit

### NOL-AUDIT-012 — Run provider-real dogfooding on Windows with replayable receipts

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Acceptance ledger chưa cho phép nâng lên verified_source_test.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/superiority/deep/provider-dogfood-replay-lab.mjs, tests/deep-superiority-ui-dogfood.test.mjs
