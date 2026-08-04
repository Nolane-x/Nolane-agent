# Forge Studio 1.9.0 — Remaining Gaps Report

- Tổng yêu cầu: **790**
- Còn lại: **213**
- Hoàn thành một phần: **142**
- Cổng bên ngoài: **52**
- Chưa triển khai: **19**
- Audit SHA-256: `ba6340e9084145aac6d61097c1b59d8ec4d10f47e5369e1e69af04679be4ca86`
- Receipt SHA-256: `fd2f4f9e5c221cb057677d0498cec69a51af37ad387583784603450ef454fc14`

> Báo cáo này liệt kê toàn bộ item chưa ở trạng thái source + test. Không có item nào bị ẩn hoặc gộp mất.

## 1. Nguyên tắc kiến trúc

### 1.2 — Thêm extension IDE sau khi lõi ổn định

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/app.mjs, src/agent/agent-loop.mjs, tests/app-forgeos-v061-wiring.test.mjs, tests/agent-loop.test.mjs

### 1.3 — Thêm desktop app khi cần đa agent

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/app.mjs, src/agent/agent-loop.mjs, tests/app-forgeos-v061-wiring.test.mjs, tests/agent-loop.test.mjs

### 1.4 — Thêm cloud agent ở giai đoạn cuối

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/app.mjs, src/agent/agent-loop.mjs, tests/app-forgeos-v061-wiring.test.mjs, tests/agent-loop.test.mjs

### 1.6 — Cho phép chuyển sang cloud sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 1.7 — Hỗ trợ Windows ngay từ kiến trúc

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 1.8 — Hỗ trợ Linux và macOS

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 1.14 — Mọi tác vụ phải có giới hạn tài nguyên

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/app.mjs, src/agent/agent-loop.mjs, tests/app-forgeos-v061-wiring.test.mjs, tests/agent-loop.test.mjs

### 1.18 — Tách phần suy nghĩ khỏi phần thực thi

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/app.mjs, src/agent/agent-loop.mjs, tests/app-forgeos-v061-wiring.test.mjs, tests/agent-loop.test.mjs

### 1.23 — Ưu tiên hệ thống đơn giản nhưng mở rộng được

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/app.mjs, src/agent/agent-loop.mjs, tests/app-forgeos-v061-wiring.test.mjs, tests/agent-loop.test.mjs

## 2. Mục tiêu sản phẩm

### 2.3 — Giải thích kiến trúc dự án

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.10 — Sửa test thất bại

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.14 — Sửa lỗi dependency

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.15 — Giải quyết conflict Git

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.16 — Tạo commit

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.17 — Tạo pull request

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 2.18 — Review pull request

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.19 — Kiểm tra bảo mật

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.20 — Cập nhật tài liệu

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 2.26 — Triển khai bản preview

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 2.27 — Theo dõi CI

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 2.29 — Chạy nhiều tác vụ song song

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

## 3. Các chế độ sử dụng

### 3.1 — Chế độ hỏi đáp codebase

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.2 — Chế độ chỉ đọc

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.3 — Chế độ lập kế hoạch

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.4 — Chế độ chỉnh sửa có phê duyệt

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.5 — Chế độ tự động chỉnh sửa

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.6 — Chế độ review code

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.7 — Chế độ debug

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.8 — Chế độ viết test

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.9 — Chế độ refactor

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.10 — Chế độ migration

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.11 — Chế độ thiết kế kiến trúc

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.12 — Chế độ tạo dự án

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.13 — Chế độ sửa CI

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.14 — Chế độ xử lý issue

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.15 — Chế độ tạo pull request

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/enterprise/enterprise-service.mjs, src/enterprise/oidc-login-manager.mjs, src/enterprise/scim-service.mjs, tests/enterprise-cloud-recovery.test.mjs

### 3.16 — Chế độ chạy nền

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.18 — Chế độ học codebase

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.20 — Chế độ giải thích từng bước

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.21 — Chế độ nhanh, ít token

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.22 — Chế độ sâu, nhiều bước

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.23 — Chế độ ngoại tuyến với model local

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 3.24 — Chế độ cloud sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/enterprise/enterprise-service.mjs, src/enterprise/oidc-login-manager.mjs, src/enterprise/scim-service.mjs, tests/enterprise-cloud-recovery.test.mjs

### 3.25 — Chế độ doanh nghiệp

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/enterprise/enterprise-service.mjs, src/enterprise/oidc-login-manager.mjs, src/enterprise/scim-service.mjs, tests/enterprise-cloud-recovery.test.mjs

## 4. Giao diện người dùng

### 4.3 — IDE extension

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** ui/index.html, ui/app.js, ui/workroom.js, tests/http-ui.test.mjs

### 4.21 — Trình duyệt tích hợp

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 4.22 — Trình xem ảnh

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/image-comparison-service.mjs, tests/image-comparison.test.mjs

### 4.23 — Trình xem dependency graph

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 4.24 — Trình xem call graph

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/lsp-client.mjs, src/repository/language-server-registry.mjs, src/repository/code-intelligence-service.mjs, tests/lsp-intelligence.test.mjs

### 4.25 — Trình xem Git history

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** ui/index.html, ui/app.js, ui/workroom.js, tests/http-ui.test.mjs

### 4.30 — Trình quản lý secrets

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 4.31 — Trình quản lý sandbox

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 4.32 — Trình quản lý chi phí

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** ui/index.html, ui/app.js, ui/workroom.js, tests/http-ui.test.mjs

### 4.43 — Nút sửa câu lệnh trước khi chạy

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** ui/index.html, ui/app.js, ui/workroom.js, tests/http-ui.test.mjs

### 4.44 — Nút chuyển sang điều khiển thủ công

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** ui/index.html, ui/app.js, ui/workroom.js, tests/http-ui.test.mjs

## 5. Agent runtime cốt lõi

### 5.19 — Kiểm tra giới hạn chi phí

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 5.22 — Kiểm tra tiến triển thực tế

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 5.23 — Yêu cầu người dùng khi cần

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 5.32 — Giải phóng sandbox

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 5.33 — Giữ sandbox khi cần tiếp tục

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

## 6. Trạng thái agent

### 6.3 — ID người dùng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.5 — ID repository

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.7 — Tiêu chí hoàn thành

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.16 — Danh sách giả thuyết

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.20 — Test đã chạy

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.21 — Test đã vượt qua

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.22 — Test còn thất bại

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.24 — Chi phí đã dùng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.31 — Trạng thái sandbox

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.32 — Trạng thái phê duyệt

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

### 6.33 — Trạng thái agent con

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/storage/studio-store.mjs, src/orchestration/run-coordinator.mjs, tests/storage.test.mjs, tests/run-coordinator.test.mjs

## 7. Vòng đời tác vụ

### 7.5 — Phát hiện thông tin thiếu

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 7.9 — Ước lượng phạm vi

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 7.18 — Kiểm tra lỗi bảo mật

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 7.19 — Kiểm tra tài liệu

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 7.22 — Commit nếu được phép

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 7.23 — Tạo PR nếu được phép

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 7.25 — Đóng sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

## 9. Bộ lập kế hoạch

### 9.8 — Xác định rủi ro từng bước

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

### 9.9 — Xác định file dự kiến sửa

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

### 9.10 — Xác định công cụ cần dùng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

### 9.11 — Xác định agent con cần gọi

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

### 9.16 — Lưu lý do thay đổi kế hoạch

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

### 9.17 — Không lập kế hoạch quá chi tiết

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

### 9.19 — Không cho phép bước mơ hồ

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/orchestration/mission-planner.mjs, src/orchestration/task-graph.mjs, vendor/forge-os/src/execution/execution-graph.mjs, tests/planner.test.mjs, tests/forgeos-v061-integration.test.mjs

## 10. Bộ quản lý context

### 10.5 — Ưu tiên lỗi hiện tại

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.9 — Giảm ưu tiên log cũ

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.11 — Tóm tắt hội thoại cũ

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.12 — Tóm tắt file dài

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.15 — Đánh dấu độ mới của context

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.16 — Đánh dấu context có thể lỗi thời

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.20 — Theo dõi token từng nguồn

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.21 — Có ngân sách context riêng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.22 — Có context dành cho planner

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.23 — Có context dành cho executor

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.24 — Có context dành cho reviewer

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.25 — Có context dành cho debugger

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.26 — Có context dành cho agent con

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.27 — Hỗ trợ context compaction

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.28 — Hỗ trợ context checkpoint

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.29 — Hỗ trợ context paging

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.31 — Hỗ trợ pin context quan trọng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 10.33 — Hỗ trợ phân quyền context

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

## 13. Codebase intelligence

### 13.15 — Lập chỉ mục inheritance graph

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 13.19 — Lập chỉ mục issue liên quan

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 13.21 — Hỗ trợ semantic search

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 13.26 — Hỗ trợ AST query

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 13.27 — Hỗ trợ tree-sitter

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 14. Công cụ đọc file

### 14.18 — Làm sạch nội dung độc hại

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

## 15. Công cụ tìm kiếm

### 15.10 — Tìm test liên quan

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 15.11 — Tìm config liên quan

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 15.19 — Tìm trong tài liệu

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

### 15.23 — Tóm tắt kết quả

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/context-builder.mjs, src/repository/repository-index.mjs, vendor/forge-os/src/context/work-unit-contexts.mjs, tests/context-intelligence.test.mjs, tests/forgeos-v061-integration.test.mjs

## 16. Công cụ chỉnh sửa file

### 16.3 — Patch theo AST

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 16.14 — Chỉnh nhiều file nguyên tử

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 16.22 — Chạy formatter sau sửa

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 16.23 — Không format toàn dự án vô cớ

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 16.26 — Không sửa generated code

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 16.27 — Không xóa comment quan trọng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 16.29 — Có giới hạn số file mỗi lượt

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 16.30 — Có giới hạn số dòng mỗi lượt

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

## 17. Patch engine

### 17.13 — Hỗ trợ conflict markers

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 17.18 — Sinh patch tối thiểu

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

### 17.20 — Đo độ lớn patch

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/execution/unified-patch.mjs, src/security/path-policy.mjs, tests/tool-broker.test.mjs, tests/patch-engine.test.mjs

## 18. Terminal và shell tool

### 18.10 — Hỗ trợ pseudo-terminal

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.12 — Hỗ trợ giới hạn CPU

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 18.13 — Hỗ trợ giới hạn RAM

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 18.14 — Hỗ trợ giới hạn process

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 18.15 — Hỗ trợ giới hạn disk

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 18.18 — Hỗ trợ argument filtering

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.19 — Hỗ trợ shell escaping

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.20 — Hỗ trợ Windows PowerShell

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.21 — Hỗ trợ CMD khi cần

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.22 — Hỗ trợ Bash

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.23 — Hỗ trợ WSL

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 18.28 — Không chạy server không quản lý PID

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

## 19. Phân loại lệnh nguy hiểm

### 19.6 — Lệnh thay đổi hệ thống

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.11 — Lệnh thay đổi quyền

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.12 — Lệnh chạy mã tải từ internet

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.14 — Lệnh chạy với administrator

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.15 — Lệnh thay đổi firewall

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.16 — Lệnh khởi động service

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.17 — Lệnh dừng service

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 19.18 — Lệnh gửi dữ liệu ra ngoài

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

## 20. Sandbox

### 20.3 — Filesystem riêng

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.4 — Process namespace riêng

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.5 — Network namespace riêng

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.8 — Home directory riêng

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.9 — Cache có kiểm soát

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.10 — CPU quota

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.11 — RAM quota

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.12 — Disk quota

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.13 — Process quota

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.14 — File descriptor quota

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.32 — Clone sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 20.34 — Thu gom sandbox lỗi

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

## 21. Local sandbox

### 21.1 — Dùng OS process isolation

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.2 — Dùng container khi có thể

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.3 — Hỗ trợ Docker

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.4 — Hỗ trợ Podman

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 21.5 — Hỗ trợ WSL sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.6 — Hỗ trợ Windows Job Objects

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 21.7 — Hỗ trợ macOS sandbox

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 21.11 — Kiểm tra Docker daemon

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.12 — Kiểm tra quyền mount

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.14 — Kiểm tra socket escape

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

## 22. Cloud sandbox

### 22.2 — Clone repository

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.3 — Checkout commit chính xác

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.4 — Cài dependency

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.5 — Khôi phục cache

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.7 — Chạy bootstrap script

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.8 — Kiểm tra bootstrap

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.9 — Lưu image môi trường

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.10 — Tái sử dụng image

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.11 — Gắn branch riêng

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.12 — Đồng bộ diff về client

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.13 — Stream log về client

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.14 — Hỗ trợ terminal từ xa

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.15 — Hỗ trợ browser từ xa

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.16 — Hỗ trợ preview URL

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.22 — Mã hóa disk

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.23 — Mã hóa network

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.24 — Cách ly tenant

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.28 — Có region selection

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 22.29 — Có data residency policy

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

## 23. Hệ thống quyền

### 23.48 — Chống approval fatigue

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/security/capability-registry.mjs, tests/capability-registry.test.mjs

## 24. Guardrails

### 24.15 — Chặn SQL nguy hiểm

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

### 24.16 — Chặn upload dữ liệu nhạy cảm

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/agent/agent-loop.mjs, src/agent/budget.mjs, src/orchestration/mission-runner.mjs, tests/agent-loop.test.mjs, tests/mission-runner.test.mjs

## 25. Secret management

### 25.1 — Không lưu API key trong chat

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

### 25.6 — Dùng OS keychain

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

## 26. Git integration

### 26.4 — Đọc remote

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.11 — Tạo checkpoint commit

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.15 — Commit thay đổi agent

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.16 — Viết commit message

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.17 — Stage file chọn lọc

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.18 — Không stage file bí mật

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.19 — Không commit artifact dư thừa

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.25 — Giải quyết conflict

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.26 — Hiển thị conflict cho người dùng

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.30 — Tạo pull request

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-gateway.mjs, src/repository/pull-request-providers.mjs, src/security/secret-scanner.mjs, tests/git-gateway.test.mjs

### 26.31 — Điền mô tả PR

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-gateway.mjs, src/repository/pull-request-providers.mjs, src/security/secret-scanner.mjs, tests/git-gateway.test.mjs

### 26.32 — Gắn issue

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-gateway.mjs, src/repository/pull-request-providers.mjs, src/security/secret-scanner.mjs, tests/git-gateway.test.mjs

### 26.33 — Ghi test đã chạy

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.34 — Ghi rủi ro còn lại

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 26.38 — Hỗ trợ GitHub

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-gateway.mjs, src/repository/pull-request-providers.mjs, src/security/secret-scanner.mjs, tests/git-gateway.test.mjs

### 26.39 — Hỗ trợ GitLab

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-gateway.mjs, src/repository/pull-request-providers.mjs, src/security/secret-scanner.mjs, tests/git-gateway.test.mjs

### 26.40 — Hỗ trợ Bitbucket

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-gateway.mjs, src/repository/pull-request-providers.mjs, src/security/secret-scanner.mjs, tests/git-gateway.test.mjs

## 27. Worktree và đa nhiệm

### 27.6 — Theo dõi thay đổi giữa các agent

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 27.7 — Phát hiện file bị nhiều agent sửa

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 27.8 — Phát hiện conflict sớm

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 27.10 — Review từng diff trước merge

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

### 27.15 — Hỗ trợ mở worktree trong IDE

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 27.16 — Hỗ trợ chuyển task sang local

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 1.9.0.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có
