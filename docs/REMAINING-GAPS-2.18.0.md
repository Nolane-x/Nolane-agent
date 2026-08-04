# Forge Studio 2.18.0 — Remaining Gaps Report

- Tổng yêu cầu: **790**
- Còn lại: **56**
- Hoàn thành một phần: **0**
- Cổng bên ngoài: **56**
- Chưa triển khai: **0**
- Audit SHA-256: `f189a4c4363edb31ea9708899c060f8fe59ba7308f36365ffa2ac658b44ca911`
- Receipt SHA-256: `6bf62232b3ac44dcba448383fb0f08e100e73ea6999217e345c3f4edad3ae0ad`

> Báo cáo này liệt kê toàn bộ item chưa ở trạng thái source + test. Không có item nào bị ẩn hoặc gộp mất.

## 1. Nguyên tắc kiến trúc

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

## 2. Mục tiêu sản phẩm

### 2.17 — Tạo pull request

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/git-inspector.mjs, src/execution/task-workspace.mjs, tests/git-inspector.test.mjs, tests/task-workspace.test.mjs

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

## 3. Các chế độ sử dụng

### 3.15 — Chế độ tạo pull request

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/enterprise/enterprise-service.mjs, src/enterprise/oidc-login-manager.mjs, src/enterprise/scim-service.mjs, tests/enterprise-cloud-recovery.test.mjs

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

## 7. Vòng đời tác vụ

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

## 13. Codebase intelligence

### 13.27 — Hỗ trợ tree-sitter

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/repository/tree-sitter-runtime-service.mjs, src/server/routes.mjs, src/server/http-server.mjs, src/app.mjs, tests/tree-sitter-runtime-service.test.mjs, tests/tree-sitter-http-api.test.mjs, tests/completion-runtime-app-wiring.test.mjs, tests/completion-release-gate.test.mjs

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

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/sandbox/podman-sandbox-driver.mjs, src/sandbox/windows-job-object-driver.mjs, src/sandbox/macos-sandbox-driver.mjs, src/sandbox/local-resource-sandbox-service.mjs, src/app.mjs, ui/sandbox-manager.js, tests/native-sandbox-drivers.test.mjs, tests/completion-runtime-app-wiring.test.mjs, tests/completion-release-gate.test.mjs

### 21.5 — Hỗ trợ WSL sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/cloud/cloud-queue.mjs, src/cloud/cloud-sandbox-service.mjs, src/cloud/kubernetes-sandbox-driver.mjs, tests/enterprise-cloud-recovery.test.mjs

### 21.6 — Hỗ trợ Windows Job Objects

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/sandbox/podman-sandbox-driver.mjs, src/sandbox/windows-job-object-driver.mjs, src/sandbox/macos-sandbox-driver.mjs, src/sandbox/local-resource-sandbox-service.mjs, src/app.mjs, ui/sandbox-manager.js, tests/native-sandbox-drivers.test.mjs, tests/completion-runtime-app-wiring.test.mjs, tests/completion-release-gate.test.mjs

### 21.7 — Hỗ trợ macOS sandbox

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/sandbox/podman-sandbox-driver.mjs, src/sandbox/windows-job-object-driver.mjs, src/sandbox/macos-sandbox-driver.mjs, src/sandbox/local-resource-sandbox-service.mjs, src/app.mjs, ui/sandbox-manager.js, tests/native-sandbox-drivers.test.mjs, tests/completion-runtime-app-wiring.test.mjs, tests/completion-release-gate.test.mjs

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

## 25. Secret management

### 25.6 — Dùng OS keychain

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/execution/tool-broker.mjs, src/terminal/terminal-manager.mjs, src/security/autonomy-policy.mjs, tests/tool-broker.test.mjs, tests/terminal-manager.test.mjs

## 26. Git integration

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
