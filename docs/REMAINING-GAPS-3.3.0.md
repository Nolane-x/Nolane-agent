# Forge Studio 3.3.0 — Remaining Gaps Report

- Tổng yêu cầu: **1150**
- Còn lại: **154**
- Hoàn thành một phần: **91**
- Cổng bên ngoài: **63**
- Chưa triển khai: **0**
- Audit SHA-256: `135b40c70e196ccb8b8fecb053a07963baf47f722fac32b7c6a37e8e015d8efc`
- Receipt SHA-256: `16828cd0299dc961935e1081cb7b22b23d90bcc60a1d0da3550ac7878a95756c`

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

## 30. Context Engine V3 và Evidence Cards

### 30.2 — Dùng tokenizer thật của harness/model thay cho ước lượng ký tự chia bốn.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/context/token-cost-adapter.mjs, src/context/evidence-card.mjs, src/context/context-utility-selector.mjs, src/context/context-escalation-controller.mjs, src/context/hybrid-evidence-retrieval-service.mjs, src/agent/context-orchestration-kernel.mjs, src/agent/agent-loop.mjs, tests/token-cost-adapter.test.mjs, tests/evidence-card.test.mjs, tests/context-utility-selector.test.mjs, tests/context-escalation-controller.test.mjs, tests/agent-loop-context-escalation.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 30.17 — Vô hiệu cache context khi source hash, branch, tool schema hoặc harness revision đổi.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/context/token-cost-adapter.mjs, src/context/evidence-card.mjs, src/context/context-utility-selector.mjs, src/context/context-escalation-controller.mjs, src/context/hybrid-evidence-retrieval-service.mjs, src/agent/context-orchestration-kernel.mjs, src/agent/agent-loop.mjs, tests/token-cost-adapter.test.mjs, tests/evidence-card.test.mjs, tests/context-utility-selector.test.mjs, tests/context-escalation-controller.test.mjs, tests/agent-loop-context-escalation.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

## 31. Semantic retrieval local thực

### 31.2 — Tích hợp code embedding ONNX quantized INT8 chạy local trên máy 8 GB.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có contract lazy cho ONNX INT8, integrity/model digest và test bằng runtime adapter; Core chưa đóng gói hoặc vận hành model ONNX production nên yêu cầu vẫn partial.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.4 — Batch embedding với giới hạn RAM, cancellation và backpressure.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.5 — Cache vector theo content hash, model hash, tokenizer hash và chunk schema.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.6 — Lưu vector quantized dưới dạng binary blob có version và checksum.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.9 — Ưu tiên exact symbol, caller, test và type trước semantic similarity rộng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.11 — Unload embedding/reranker worker sau idle TTL hoặc khi resource pressure.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.16 — Quarantine model/vector lỗi, phát hiện NaN, dimension mismatch và corruption.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.17 — Đặt budget peak RSS và rssMbSeconds riêng cho semantic indexing.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-3.3.0.json

### 31.18 — Đo retrieval recall, answer accuracy và retained-patch gain trên repository thật.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

## 33. Code intelligence đa ngôn ngữ và runtime

### 33.1 — Vận hành Tree-sitter grammar pack thật với version pin và parse receipt.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.2 — Vận hành LSP definition, reference, rename, hover, type và diagnostics có timeout.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.3 — Hỗ trợ sâu JavaScript, TypeScript, Python, Rust, Go và Java theo capability matrix.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.4 — Mở rộng C, C++, C#, Kotlin, Swift, PHP và Ruby theo grammar/LSP pack độc lập.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.5 — Tạo call graph đa ngôn ngữ có confidence và ambiguous edge rõ ràng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.8 — Kết hợp type graph, inheritance, interface implementation và dynamic dispatch evidence.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.9 — Hợp nhất build graph từ package manager, compiler và workspace metadata.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.10 — Hợp nhất test graph và coverage vào symbol relationship.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.11 — Quan sát runtime call trace và exception path trong sandbox.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.12 — Quan sát request, event, state transition và database query khi được phép.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

### 33.13 — Gắn file/network/process access runtime vào symbol hoặc task gây ra.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-3.3.0.json

## 34. Cognitive Decision Kernel

### 34.16 — Hỗ trợ causal intervention nhỏ trong sandbox trước khi sửa bug khó.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-3.3.0.json

## 35. Long-Horizon Construction Engine

### 35.6 — Áp dụng contract-first cho type, interface, error, state và compatibility.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 35.7 — Xây feature theo vertical slice nhỏ, có parse/type/test checkpoint sau mỗi slice.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 35.11 — Cho phép thu hồi task trở nên không cần thiết sau replan.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 35.12 — Gắn bounded file ownership và contract ownership trong milestone.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 35.13 — Tạo 2–3 candidate worktree cho thay đổi khó và chạy cùng verification.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 35.15 — Khôi phục chính xác sau reboot từ receipt, checkpoint và state capsule.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

## 36. Patch Intelligence và Change Safety

### 36.4 — Tạo Semantic API Diff cho signature, type, error, default, event và side effect.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 36.5 — Mô phỏng blast radius trước apply bằng caller, test, schema và runtime graph.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 36.6 — So sánh nhiều candidate patch trong worktree sạch khi risk cao.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 36.11 — Tìm duplicate logic và existing abstraction trước khi tạo function mới.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

### 36.14 — Phát hiện schema/config/migration impact và rollback requirement.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

### 36.16 — Bắt buộc independent review khi đổi public API, security hoặc multi-module contract.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-3.3.0.json

## 37. Verification và Independent Review

### 37.4 — Tạo temporary mutation probe cho boundary, validation và branch logic.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 37.5 — Dùng reviewer khác model hoặc provider cho thay đổi vượt risk threshold.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 37.11 — Yêu cầu browser/API journey receipt khi behavior phụ thuộc runtime surface.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 37.15 — Duy trì hidden regression set không cho executor đọc đáp án.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

## 38. Learned Routing, Harness và Calibration

### 38.2 — Dùng feature task type, language, repo size, risk, symbols, context và tools.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.6 — Đánh giá candidate trên held-out tasks không dùng trực tiếp để tune.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.7 — Canary theo cohort xác định và tự disable khi regression.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.10 — Học reasoning effort, tool budget, retry và context strategy theo task.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.12 — Hiệu chỉnh confidence theo domain và task type từ outcome thật.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.13 — Duy trì domain-conditioned trust cho executor, reviewer và tool.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.14 — Học patch survival, revert và human rewrite sau 7–30 ngày.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

### 38.18 — Hỗ trợ mid-session model switch với state capsule và harness translation.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/verification/verification-pyramid-planner.mjs, src/verification/test-integrity-guard.mjs, src/verification/api-existence-gate.mjs, src/verification/adversarial-review-coordinator.mjs, src/verification/failure-injection-lab.mjs, src/verification/trajectory-confidence-calibrator.mjs, src/verification/semantic-completion-gate.mjs, src/verification/verification-control-plane.mjs, src/providers/verified-outcome-bandit.mjs, src/orchestration/verification-runner.mjs, src/construction/completion-proof-builder.mjs, tests/verification-pyramid-planner.test.mjs, tests/test-integrity-guard.test.mjs, tests/api-existence-gate.test.mjs, tests/adversarial-review-coordinator.test.mjs, tests/failure-injection-lab.test.mjs, tests/trajectory-confidence-calibrator.test.mjs, tests/verified-outcome-bandit.test.mjs, tests/verification-control-plane.test.mjs, tests/verification-runner-pyramid.test.mjs, docs/verification-learned-routing-measurement-3.3.0.json

## 39. Memory OS, Replay và Skill Induction

### 39.4 — Học thao tác ADD/UPDATE/DELETE/RETRIEVE/SUMMARIZE/NOOP dưới governance.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/memory/memory-operating-system.mjs, src/memory/memory-policy-controller.mjs, src/memory/model-time-clock.mjs, src/memory/replay-scheduler.mjs, src/skills/compositional-skill-compiler.mjs, src/skills/skill-registry.mjs, src/skills/stability-plasticity-guard.mjs, src/runtime/memory-skill-resource-plane.mjs, tests/memory-operating-system.test.mjs, tests/memory-policy-controller.test.mjs, tests/replay-scheduler.test.mjs, tests/compositional-skill-compiler.test.mjs, tests/stability-plasticity-guard.test.mjs, tests/memory-skill-resource-plane.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

### 39.15 — Cho người dùng xem, sửa, invalidate, archive và xóa memory/skill.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/memory/memory-operating-system.mjs, src/memory/memory-policy-controller.mjs, src/memory/model-time-clock.mjs, src/memory/replay-scheduler.mjs, src/skills/compositional-skill-compiler.mjs, src/skills/skill-registry.mjs, src/skills/stability-plasticity-guard.mjs, src/runtime/memory-skill-resource-plane.mjs, tests/memory-operating-system.test.mjs, tests/memory-policy-controller.test.mjs, tests/replay-scheduler.test.mjs, tests/compositional-skill-compiler.test.mjs, tests/stability-plasticity-guard.test.mjs, tests/memory-skill-resource-plane.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

### 39.16 — Lưu Repository Causal Memory giải thích vì sao quyết định kiến trúc tồn tại.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/memory/memory-operating-system.mjs, src/memory/memory-policy-controller.mjs, src/memory/model-time-clock.mjs, src/memory/replay-scheduler.mjs, src/skills/compositional-skill-compiler.mjs, src/skills/skill-registry.mjs, src/skills/stability-plasticity-guard.mjs, src/runtime/memory-skill-resource-plane.mjs, tests/memory-operating-system.test.mjs, tests/memory-policy-controller.test.mjs, tests/replay-scheduler.test.mjs, tests/compositional-skill-compiler.test.mjs, tests/stability-plasticity-guard.test.mjs, tests/memory-skill-resource-plane.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

## 40. Resource Fabric và Admission Control

### 40.3 — Enforce process-tree CPU, RSS, process và FD budget trên target platform.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/runtime/resource-admission-controller.mjs, src/runtime/viability-region-controller.mjs, src/runtime/local-device-doctor.mjs, src/runtime/resource-lifecycle-coordinator.mjs, src/storage/content-addressed-artifact-store.mjs, src/runtime/mission-resource-fabric.mjs, tests/resource-admission-controller.test.mjs, tests/content-addressed-artifact-store.test.mjs, tests/memory-skill-resource-plane.test.mjs, tests/mission-resource-fabric.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

### 40.5 — Unload resource idle theo TTL và pressure state.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/runtime/resource-admission-controller.mjs, src/runtime/viability-region-controller.mjs, src/runtime/local-device-doctor.mjs, src/runtime/resource-lifecycle-coordinator.mjs, src/storage/content-addressed-artifact-store.mjs, src/runtime/mission-resource-fabric.mjs, tests/resource-admission-controller.test.mjs, tests/content-addressed-artifact-store.test.mjs, tests/memory-skill-resource-plane.test.mjs, tests/mission-resource-fabric.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

### 40.8 — Tái sử dụng browser context trong mission nhưng reset state theo journey contract.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/runtime/resource-admission-controller.mjs, src/runtime/viability-region-controller.mjs, src/runtime/local-device-doctor.mjs, src/runtime/resource-lifecycle-coordinator.mjs, src/storage/content-addressed-artifact-store.mjs, src/runtime/mission-resource-fabric.mjs, tests/resource-admission-controller.test.mjs, tests/content-addressed-artifact-store.test.mjs, tests/memory-skill-resource-plane.test.mjs, tests/mission-resource-fabric.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

### 40.9 — Unload embedding model trước browser/test demand dự đoán.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/runtime/resource-admission-controller.mjs, src/runtime/viability-region-controller.mjs, src/runtime/local-device-doctor.mjs, src/runtime/resource-lifecycle-coordinator.mjs, src/storage/content-addressed-artifact-store.mjs, src/runtime/mission-resource-fabric.mjs, tests/resource-admission-controller.test.mjs, tests/content-addressed-artifact-store.test.mjs, tests/memory-skill-resource-plane.test.mjs, tests/mission-resource-fabric.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

### 40.17 — Giữ startup/idle RSS budget bằng release measurement trên cold và warm start.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/runtime/resource-admission-controller.mjs, src/runtime/viability-region-controller.mjs, src/runtime/local-device-doctor.mjs, src/runtime/resource-lifecycle-coordinator.mjs, src/storage/content-addressed-artifact-store.mjs, src/runtime/mission-resource-fabric.mjs, tests/resource-admission-controller.test.mjs, tests/content-addressed-artifact-store.test.mjs, tests/memory-skill-resource-plane.test.mjs, tests/mission-resource-fabric.test.mjs, docs/memory-skill-resource-os-measurement-3.3.0.json

## 41. Multi-Agent Blackboard và Coordination

### 41.9 — Giữ reviewer context độc lập với executor để tránh đồng hóa.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/collaboration/shared-blackboard.mjs, src/collaboration/joint-commitment-ledger.mjs, src/collaboration/adaptive-topology-selector.mjs, src/collaboration/semantic-merge-analyzer.mjs, src/runtime/collaboration-experience-plane.mjs, tests/shared-blackboard.test.mjs, tests/joint-commitment-ledger.test.mjs, tests/adaptive-topology-selector.test.mjs, tests/semantic-merge-analyzer.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 41.11 — Gắn symbol/path ownership từ AST/LSP/build graph, không chỉ khai báo task.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/collaboration/shared-blackboard.mjs, src/collaboration/joint-commitment-ledger.mjs, src/collaboration/adaptive-topology-selector.mjs, src/collaboration/semantic-merge-analyzer.mjs, src/runtime/collaboration-experience-plane.mjs, tests/shared-blackboard.test.mjs, tests/joint-commitment-ledger.test.mjs, tests/adaptive-topology-selector.test.mjs, tests/semantic-merge-analyzer.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 41.14 — Đặt communication budget và chỉ broadcast workspace coalition thắng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/collaboration/shared-blackboard.mjs, src/collaboration/joint-commitment-ledger.mjs, src/collaboration/adaptive-topology-selector.mjs, src/collaboration/semantic-merge-analyzer.mjs, src/runtime/collaboration-experience-plane.mjs, tests/shared-blackboard.test.mjs, tests/joint-commitment-ledger.test.mjs, tests/adaptive-topology-selector.test.mjs, tests/semantic-merge-analyzer.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 41.18 — Đo routing regret, coordination overhead, conflict rate và useful parallelism.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/collaboration/shared-blackboard.mjs, src/collaboration/joint-commitment-ledger.mjs, src/collaboration/adaptive-topology-selector.mjs, src/collaboration/semantic-merge-analyzer.mjs, src/runtime/collaboration-experience-plane.mjs, tests/shared-blackboard.test.mjs, tests/joint-commitment-ledger.test.mjs, tests/adaptive-topology-selector.test.mjs, tests/semantic-merge-analyzer.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

## 42. Browser, Computer Use và Product Evidence

### 42.3 — Ghi screenshot/video before-after bằng artifact hash.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 42.4 — Thực hiện visual regression với tolerance và vùng ignore được review.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 42.5 — Yêu cầu human-approved baseline cho visual oracle quan trọng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 42.8 — Tái sử dụng browser process/context khi an toàn để giảm warm-up.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 42.9 — Kiểm thử desktop/Electron app bằng computer-use driver có receipt.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

### 42.10 — Xuất demo artifact cho reviewer thay vì chỉ nói UI hoạt động.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 42.14 — Chứng minh runtime trên Windows, macOS và Linux trước cross-platform claim.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

### 42.15 — Gắn accessibility acceptance criteria vào feature UI.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 42.16 — Hiển thị Artifact Playback để xem journey và rewind checkpoint.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/browser/deterministic-journey-replayer.mjs, src/browser/browser-injection-guard.mjs, src/experience/artifact-playback-service.mjs, tests/deterministic-journey-replayer.test.mjs, tests/browser-injection-guard.test.mjs, tests/artifact-playback-service.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

## 43. Security, Supply Chain và Failure Injection

### 43.9 — Inject mất mạng, timeout, DNS lỗi và provider overload.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/security/taint-analysis-engine.mjs, src/security/contextual-injection-detector.mjs, src/security/prompt-injection-quarantine.mjs, src/security/dependency-risk-intelligence.mjs, src/security/sbom-provenance-service.mjs, src/security/integrity-quarantine.mjs, src/security/exfiltration-guard.mjs, src/security/mission-capability-token-service.mjs, src/security/audit-hash-chain.mjs, src/security/protected-boundary-guard.mjs, src/security/sandbox-escape-adversarial-suite.mjs, src/verification/extended-failure-scenario-lab.mjs, tests/taint-analysis-engine.test.mjs, tests/contextual-injection-security.test.mjs, tests/supply-chain-security.test.mjs, tests/security-boundary-protection.test.mjs, tests/security-adversarial-runtime.test.mjs, docs/security-certification-measurement-3.3.0.json

### 43.10 — Inject hết RAM, process chết, orphan child và FD exhaustion.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/security/taint-analysis-engine.mjs, src/security/contextual-injection-detector.mjs, src/security/prompt-injection-quarantine.mjs, src/security/dependency-risk-intelligence.mjs, src/security/sbom-provenance-service.mjs, src/security/integrity-quarantine.mjs, src/security/exfiltration-guard.mjs, src/security/mission-capability-token-service.mjs, src/security/audit-hash-chain.mjs, src/security/protected-boundary-guard.mjs, src/security/sandbox-escape-adversarial-suite.mjs, src/verification/extended-failure-scenario-lab.mjs, tests/taint-analysis-engine.test.mjs, tests/contextual-injection-security.test.mjs, tests/supply-chain-security.test.mjs, tests/security-boundary-protection.test.mjs, tests/security-adversarial-runtime.test.mjs, docs/security-certification-measurement-3.3.0.json

### 43.11 — Inject DB lock, disk full và file đổi giữa transaction.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/security/taint-analysis-engine.mjs, src/security/contextual-injection-detector.mjs, src/security/prompt-injection-quarantine.mjs, src/security/dependency-risk-intelligence.mjs, src/security/sbom-provenance-service.mjs, src/security/integrity-quarantine.mjs, src/security/exfiltration-guard.mjs, src/security/mission-capability-token-service.mjs, src/security/audit-hash-chain.mjs, src/security/protected-boundary-guard.mjs, src/security/sandbox-escape-adversarial-suite.mjs, src/verification/extended-failure-scenario-lab.mjs, tests/taint-analysis-engine.test.mjs, tests/contextual-injection-security.test.mjs, tests/supply-chain-security.test.mjs, tests/security-boundary-protection.test.mjs, tests/security-adversarial-runtime.test.mjs, docs/security-certification-measurement-3.3.0.json

### 43.13 — Chạy child-process, environment leakage và socket/credential escape tests.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/security/taint-analysis-engine.mjs, src/security/contextual-injection-detector.mjs, src/security/prompt-injection-quarantine.mjs, src/security/dependency-risk-intelligence.mjs, src/security/sbom-provenance-service.mjs, src/security/integrity-quarantine.mjs, src/security/exfiltration-guard.mjs, src/security/mission-capability-token-service.mjs, src/security/audit-hash-chain.mjs, src/security/protected-boundary-guard.mjs, src/security/sandbox-escape-adversarial-suite.mjs, src/verification/extended-failure-scenario-lab.mjs, tests/taint-analysis-engine.test.mjs, tests/contextual-injection-security.test.mjs, tests/supply-chain-security.test.mjs, tests/security-boundary-protection.test.mjs, tests/security-adversarial-runtime.test.mjs, docs/security-certification-measurement-3.3.0.json

## 44. Agent-native UI và IDE Experience

### 44.2 — Hiển thị code, diff, terminal, browser, test và timeline trong cùng work surface.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.8 — Tích hợp command palette để truy cập advanced centers không làm navigation nặng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.9 — Có role view cho builder, reviewer và operator trên cùng state source.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.10 — Tích hợp VS Code inline diff, diagnostics, symbol, tests và mission state.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.11 — Tạo JetBrains integration đạt capability parity theo matrix.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

### 44.12 — Hiển thị cross-repository workspace và dependency-aware change chain.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

### 44.13 — Virtualize list, logs, graph và diff lớn để giữ frame budget.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.14 — Tự giảm effects theo resource pressure và prefers-reduced-motion.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.16 — Hiển thị Local Device Doctor và tác động dự kiến trước khi bật subsystem nặng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/frontier/cross-repository-workspace-map.mjs, src/frontier/transactional-change-planner.mjs, src/frontier/synchronized-commit-chain.mjs, src/frontier/post-merge-sentinel.mjs, src/frontier/change-survival-ledger.mjs, src/frontier/self-healing-coordinator.mjs, src/frontier/cultural-lineage-ledger.mjs, src/frontier/self-improvement-constitution.mjs, src/runtime/frontier-governance-plane.mjs, tests/cross-repository-workspace-map.test.mjs, tests/transactional-change-planner.test.mjs, tests/synchronized-commit-chain.test.mjs, tests/post-merge-sentinel.test.mjs, tests/change-survival-ledger.test.mjs, tests/self-healing-coordinator.test.mjs, tests/cultural-lineage-ledger.test.mjs, tests/self-improvement-constitution.test.mjs, tests/frontier-governance-plane.test.mjs, docs/frontier-governance-measurement-3.3.0.json

### 44.17 — Đặt performance budget cho startup, input latency, scroll và panel switch.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

### 44.18 — Giữ design system đẹp, nhất quán, không dùng blur/animation để che trạng thái thiếu.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/experience/review-queue-service.mjs, src/experience/mission-steering-service.mjs, ui/collaboration-experience-center.js, ui/collaboration-experience-center.css, extensions/vscode/src/mission-state.ts, extensions/vscode/src/client.ts, extensions/vscode/src/extension.ts, tests/collaboration-experience-ui.test.mjs, tests/vscode-mission-state-bridge.test.mjs, tests/collaboration-experience-http-api.test.mjs, docs/collaboration-experience-measurement-3.3.0.json

## 45. Benchmark repository thật và Comparative Certification

### 45.1 — Dùng repository chưa từng thấy và khóa contamination/leakage.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.2 — Bao phủ bug thật, feature thật, refactor thật, migration và review.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.3 — Chạy Forge Studio và đối thủ với cùng model, máy, token, time và permissions.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.8 — Có public benchmark reproducible và private held-out suite.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.13 — So với Codex, Claude Code, Cursor và Copilot theo version cụ thể.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.16 — Chạy platform matrix Windows/Linux/macOS khi claim liên quan.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.17 — Có long-horizon, browser/UI, multi-agent và security task.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

### 45.18 — Chỉ tuyên bố vượt đối thủ sau independent review/certification của raw evidence.

- **Trạng thái:** `external_gate`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.
- **Bằng chứng hiện có:** src/benchmark/benchmark-schema.mjs, src/benchmark/comparability-contract.mjs, src/benchmark/contamination-guard.mjs, src/benchmark/benchmark-runner.mjs, src/benchmark/benchmark-scorer.mjs, src/benchmark/run-evidence-journal.mjs, src/benchmark/failure-taxonomy.mjs, src/benchmark/independent-attestation.mjs, src/benchmark/comparative-certification-service.mjs, tests/benchmark-comparability-contract.test.mjs, tests/benchmark-certified-evidence.test.mjs, tests/comparative-certification-service.test.mjs, docs/security-certification-measurement-3.3.0.json

## 46. World Models, Simulation và Counterfactual

### 46.9 — Mô phỏng API, dependency, state, test và user-visible behavior trước patch.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/world-model/world-model-registry.mjs, src/world-model/foresight-controller.mjs, src/world-model/counterfactual-simulator.mjs, src/world-model/simulation-receipt-ledger.mjs, src/runtime/world-development-plane.mjs, tests/world-model-portfolio.test.mjs, tests/counterfactual-simulator.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json

### 46.11 — Chạy Causal Intervention Lab giữ biến khác cố định.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/world-model/world-model-registry.mjs, src/world-model/foresight-controller.mjs, src/world-model/counterfactual-simulator.mjs, src/world-model/simulation-receipt-ledger.mjs, src/runtime/world-development-plane.mjs, tests/world-model-portfolio.test.mjs, tests/counterfactual-simulator.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json

### 46.13 — Tách Imagine, Verify và Execute thành ba state có gate.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/world-model/world-model-registry.mjs, src/world-model/foresight-controller.mjs, src/world-model/counterfactual-simulator.mjs, src/world-model/simulation-receipt-ledger.mjs, src/runtime/world-development-plane.mjs, tests/world-model-portfolio.test.mjs, tests/counterfactual-simulator.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json

### 46.16 — Đo khi simulation cải thiện decision và khi làm kết quả tệ hơn.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/world-model/world-model-registry.mjs, src/world-model/foresight-controller.mjs, src/world-model/counterfactual-simulator.mjs, src/world-model/simulation-receipt-ledger.mjs, src/runtime/world-development-plane.mjs, tests/world-model-portfolio.test.mjs, tests/counterfactual-simulator.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json

## 47. Self-model và Developmental Learning

### 47.6 — Hiệu chỉnh trajectory confidence qua nhiều lượt và tool types.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/development/verified-self-model.mjs, src/development/developmental-goal-engine.mjs, src/development/developmental-stage-controller.mjs, src/runtime/world-development-plane.mjs, tests/verified-self-model.test.mjs, tests/developmental-learning.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json

### 47.10 — Tạo Teacher–Student tasks để phân biệt hiểu cấu trúc và học bề mặt.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/development/verified-self-model.mjs, src/development/developmental-goal-engine.mjs, src/development/developmental-stage-controller.mjs, src/runtime/world-development-plane.mjs, tests/verified-self-model.test.mjs, tests/developmental-learning.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json

### 47.11 — Dùng mutation, rename, distractor, platform và prompt injection làm teacher challenge.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 3.3.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/development/verified-self-model.mjs, src/development/developmental-goal-engine.mjs, src/development/developmental-stage-controller.mjs, src/runtime/world-development-plane.mjs, tests/verified-self-model.test.mjs, tests/developmental-learning.test.mjs, tests/world-development-plane.test.mjs, docs/world-development-measurement-3.3.0.json
