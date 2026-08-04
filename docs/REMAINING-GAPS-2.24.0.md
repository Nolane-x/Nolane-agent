# Forge Studio 2.24.0 — Remaining Gaps Report

- Tổng yêu cầu: **1150**
- Còn lại: **345**
- Hoàn thành một phần: **54**
- Cổng bên ngoài: **56**
- Chưa triển khai: **235**
- Audit SHA-256: `0620b6d90810a5ead463c5c107fb3bb6e23ef9c6328dedcb4552c47d18370aaa`
- Receipt SHA-256: `58e8f3ad431f743ca9c3c511a9a45999f31bbfea6a6468904a5b3a60c1a7fe12`

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

## 29. Hàm mục tiêu và Decision Efficiency

### 29.3 — Ghi verifiedCriteriaScore cho từng task, milestone và mission.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/decision/acceptance-criteria-ledger.mjs, src/decision/decision-receipt-service.mjs, src/decision/decision-efficiency-metrics.mjs, src/decision/decision-plane.mjs, src/orchestration/verification-runner.mjs, src/security/verification-claim-guard.mjs, tests/acceptance-criteria-ledger.test.mjs, tests/decision-receipt-service.test.mjs, tests/decision-efficiency-metrics.test.mjs, tests/verification-criteria-binding.test.mjs, tests/decision-plane-app-wiring.test.mjs, tests/decision-efficiency-ui.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 29.8 — Ghi contextTokensActuallyUseful bằng tín hiệu khách quan sau verification.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/decision/acceptance-criteria-ledger.mjs, src/decision/decision-receipt-service.mjs, src/decision/decision-efficiency-metrics.mjs, src/decision/decision-plane.mjs, src/orchestration/verification-runner.mjs, src/security/verification-claim-guard.mjs, tests/acceptance-criteria-ledger.test.mjs, tests/decision-receipt-service.test.mjs, tests/decision-efficiency-metrics.test.mjs, tests/verification-criteria-binding.test.mjs, tests/decision-plane-app-wiring.test.mjs, tests/decision-efficiency-ui.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 29.13 — Tối ưu theo thứ tự đúng yêu cầu, không regression, rồi mới tối ưu tài nguyên.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/decision/acceptance-criteria-ledger.mjs, src/decision/decision-receipt-service.mjs, src/decision/decision-efficiency-metrics.mjs, src/decision/decision-plane.mjs, src/orchestration/verification-runner.mjs, src/security/verification-claim-guard.mjs, tests/acceptance-criteria-ledger.test.mjs, tests/decision-receipt-service.test.mjs, tests/decision-efficiency-metrics.test.mjs, tests/verification-criteria-binding.test.mjs, tests/decision-plane-app-wiring.test.mjs, tests/decision-efficiency-ui.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 29.14 — Chặn reward hacking như giảm token bằng cách bỏ verification hoặc làm yếu test.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/decision/acceptance-criteria-ledger.mjs, src/decision/decision-receipt-service.mjs, src/decision/decision-efficiency-metrics.mjs, src/decision/decision-plane.mjs, src/orchestration/verification-runner.mjs, src/security/verification-claim-guard.mjs, tests/acceptance-criteria-ledger.test.mjs, tests/decision-receipt-service.test.mjs, tests/decision-efficiency-metrics.test.mjs, tests/verification-criteria-binding.test.mjs, tests/decision-plane-app-wiring.test.mjs, tests/decision-efficiency-ui.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 29.16 — Quy chi phí context, tool, model và process về đúng decisionId.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/decision/acceptance-criteria-ledger.mjs, src/decision/decision-receipt-service.mjs, src/decision/decision-efficiency-metrics.mjs, src/decision/decision-plane.mjs, src/orchestration/verification-runner.mjs, src/security/verification-claim-guard.mjs, tests/acceptance-criteria-ledger.test.mjs, tests/decision-receipt-service.test.mjs, tests/decision-efficiency-metrics.test.mjs, tests/verification-criteria-binding.test.mjs, tests/decision-plane-app-wiring.test.mjs, tests/decision-efficiency-ui.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 29.17 — So sánh baseline và candidate bằng cùng acceptance criteria và môi trường.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 30. Context Engine V3 và Evidence Cards

### 30.2 — Dùng tokenizer thật của harness/model thay cho ước lượng ký tự chia bốn.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/context/token-cost-adapter.mjs, src/context/evidence-card.mjs, src/context/context-utility-selector.mjs, src/context/context-escalation-controller.mjs, src/context/hybrid-evidence-retrieval-service.mjs, src/agent/context-orchestration-kernel.mjs, src/agent/agent-loop.mjs, tests/token-cost-adapter.test.mjs, tests/evidence-card.test.mjs, tests/context-utility-selector.test.mjs, tests/context-escalation-controller.test.mjs, tests/agent-loop-context-escalation.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

### 30.13 — Tự động query expansion từ symbol, stack trace, test, Git và dependency graph.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 30.14 — Học file và evidence type hữu ích theo loại task nhưng không học từ kết quả chưa verify.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 30.15 — Chạy context ablation replay để phát hiện token context không tạo giá trị.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 30.17 — Vô hiệu cache context khi source hash, branch, tool schema hoặc harness revision đổi.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/context/token-cost-adapter.mjs, src/context/evidence-card.mjs, src/context/context-utility-selector.mjs, src/context/context-escalation-controller.mjs, src/context/hybrid-evidence-retrieval-service.mjs, src/agent/context-orchestration-kernel.mjs, src/agent/agent-loop.mjs, tests/token-cost-adapter.test.mjs, tests/evidence-card.test.mjs, tests/context-utility-selector.test.mjs, tests/context-escalation-controller.test.mjs, tests/agent-loop-context-escalation.test.mjs, docs/decision-efficiency-loop-measurement-2.20.0.json

## 31. Semantic retrieval local thực

### 31.2 — Tích hợp code embedding ONNX quantized INT8 chạy local trên máy 8 GB.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có contract lazy cho ONNX INT8, integrity/model digest và test bằng runtime adapter; Core chưa đóng gói hoặc vận hành model ONNX production nên yêu cầu vẫn partial.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.4 — Batch embedding với giới hạn RAM, cancellation và backpressure.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.5 — Cache vector theo content hash, model hash, tokenizer hash và chunk schema.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.6 — Lưu vector quantized dưới dạng binary blob có version và checksum.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.9 — Ưu tiên exact symbol, caller, test và type trước semantic similarity rộng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.11 — Unload embedding/reranker worker sau idle TTL hoặc khi resource pressure.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.12 — Hỗ trợ mmap hoặc đọc vector theo trang để không giữ toàn index trong RAM.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 31.16 — Quarantine model/vector lỗi, phát hiện NaN, dimension mismatch và corruption.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.17 — Đặt budget peak RSS và rssMbSeconds riêng cho semantic indexing.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/embedding-provider.mjs, src/repository/embedding-model-pack.mjs, src/repository/onnx-code-embedding-provider.mjs, src/repository/quantized-vector-codec.mjs, src/repository/hybrid-code-reranker.mjs, src/repository/secure-semantic-index.mjs, src/repository/merkle-index.mjs, src/repository/repository-intelligence-fabric.mjs, tests/embedding-provider-registry.test.mjs, tests/onnx-code-embedding-provider.test.mjs, tests/quantized-vector-codec.test.mjs, tests/hybrid-code-reranker.test.mjs, tests/merkle-chunk-index.test.mjs, tests/repository-intelligence-fabric.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 31.18 — Đo retrieval recall, answer accuracy và retained-patch gain trên repository thật.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 32. Repository Digital Twin

### 32.2 — Mô hình hóa public API, internal API, database schema, configuration và build target.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.3 — Mô hình hóa Test, Runtime Service và External Dependency cùng provenance.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.4 — Lưu quan hệ calls, imports, references, verifies, reads, writes và controls.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.5 — Lưu quan hệ commit changed architecture và issue referenced code với non-claim rõ ràng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 32.6 — Duy trì Workspace Map cho nhiều repository và dependency giữa chúng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 32.7 — Duy trì Architecture Map cho service, layer, domain boundary và public surface.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.8 — Duy trì Module Map cho trách nhiệm, dependency direction và owner.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 32.9 — Duy trì Symbol Map cho definition, reference, caller, type và test.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.10 — Duy trì Runtime Map cho request, event, process, state và data flow.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 32.11 — Nhận biết branch, worktree, uncommitted change và file chưa lưu trong editor.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.12 — Không dùng fact từ branch khác nếu citation không còn đúng trên branch hiện tại.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.13 — Tự phát hiện architecture pattern, convention, legacy và security-critical zone.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 32.15 — Gắn mọi inference kiến trúc với citation và tự invalidation theo source hash.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.16 — Theo dõi ownership, churn, hotspot, recent regressions và vùng dễ lỗi từ Git.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 32.17 — Hỗ trợ query planner exact→lexical→AST/LSP→graph→Git→test→semantic→runtime.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

### 32.18 — Cung cấp viewer và API zoom từ workspace xuống source span mà không tải toàn graph.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/repository-digital-twin-service.mjs, src/repository/repository-intelligence-fabric.mjs, tests/repository-digital-twin-service.test.mjs, tests/repository-intelligence-fabric-app-wiring.test.mjs, docs/repository-intelligence-fabric-measurement-2.24.0.json

## 33. Code intelligence đa ngôn ngữ và runtime

### 33.1 — Vận hành Tree-sitter grammar pack thật với version pin và parse receipt.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.2 — Vận hành LSP definition, reference, rename, hover, type và diagnostics có timeout.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.3 — Hỗ trợ sâu JavaScript, TypeScript, Python, Rust, Go và Java theo capability matrix.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.4 — Mở rộng C, C++, C#, Kotlin, Swift, PHP và Ruby theo grammar/LSP pack độc lập.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.5 — Tạo call graph đa ngôn ngữ có confidence và ambiguous edge rõ ràng.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.6 — Tạo control-flow graph cho function/method được hỗ trợ.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 33.7 — Tạo interprocedural data-flow graph trong phạm vi budget.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 33.8 — Kết hợp type graph, inheritance, interface implementation và dynamic dispatch evidence.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.9 — Hợp nhất build graph từ package manager, compiler và workspace metadata.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.10 — Hợp nhất test graph và coverage vào symbol relationship.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.11 — Quan sát runtime call trace và exception path trong sandbox.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.12 — Quan sát request, event, state transition và database query khi được phép.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

### 33.13 — Gắn file/network/process access runtime vào symbol hoặc task gây ra.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/repository/language-capability-matrix.mjs, src/repository/grammar-pack-registry.mjs, src/repository/lsp-session-pool.mjs, src/repository/relationship-graph-fusion-service.mjs, src/repository/runtime-observation-store.mjs, src/repository/source-classifier.mjs, src/repository/framework-capability-registry.mjs, src/repository/architecture-drift-sentinel.mjs, src/repository/polyglot-intelligence-plane.mjs, tests/code-intelligence-v2.test.mjs, tests/relationship-graph-fusion-service.test.mjs, tests/runtime-observation-store.test.mjs, tests/architecture-drift-sentinel.test.mjs, tests/polyglot-intelligence-plane.test.mjs, docs/polyglot-runtime-intelligence-measurement-2.24.0.json

## 34. Cognitive Decision Kernel

### 34.9 — Phát hiện tool success giả khi actual effect không khớp expected effect.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-2.24.0.json

### 34.11 — Hiệu chỉnh confidence riêng cho requirement, retrieval, hypothesis, plan, execution, patch và verification.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-2.24.0.json

### 34.12 — Tính final confidence theo mắt xích yếu nhất cộng independent evidence.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-2.24.0.json

### 34.13 — Biểu diễn plan và decision flow dưới dạng state machine có verifier.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-2.24.0.json

### 34.14 — Phát hiện no-progress bằng semantic progress, test delta, diff delta và information gain.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-2.24.0.json

### 34.16 — Hỗ trợ causal intervention nhỏ trong sandbox trước khi sửa bug khó.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/cognition/context-posterior-manager.mjs, src/cognition/hypothesis-population.mjs, src/cognition/epistemic-action-selector.mjs, src/cognition/structured-error-router.mjs, src/cognition/episodic-binder.mjs, src/cognition/agency-ledger.mjs, src/cognition/cognitive-policy-gates.mjs, src/cognition/cognitive-kernel.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/context-posterior-manager.test.mjs, tests/hypothesis-population.test.mjs, tests/epistemic-action-selector.test.mjs, tests/structured-error-router.test.mjs, tests/episodic-binder.test.mjs, tests/agency-ledger.test.mjs, tests/cognitive-policy-gates.test.mjs, tests/cognitive-kernel.test.mjs, tests/cognitive-decision-plane-integration.test.mjs, tests/agent-loop-cognitive-mode.test.mjs, docs/cognitive-decision-kernel-measurement-2.24.0.json

## 35. Long-Horizon Construction Engine

### 35.6 — Áp dụng contract-first cho type, interface, error, state và compatibility.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 35.7 — Xây feature theo vertical slice nhỏ, có parse/type/test checkpoint sau mỗi slice.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 35.11 — Cho phép thu hồi task trở nên không cần thiết sau replan.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 35.12 — Gắn bounded file ownership và contract ownership trong milestone.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 35.13 — Tạo 2–3 candidate worktree cho thay đổi khó và chạy cùng verification.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 35.15 — Khôi phục chính xác sau reboot từ receipt, checkpoint và state capsule.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

## 36. Patch Intelligence và Change Safety

### 36.4 — Tạo Semantic API Diff cho signature, type, error, default, event và side effect.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 36.5 — Mô phỏng blast radius trước apply bằng caller, test, schema và runtime graph.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 36.6 — So sánh nhiều candidate patch trong worktree sạch khi risk cao.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 36.7 — Rollback về baseline sạch trước candidate mới, không chồng lên patch thất bại.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 36.11 — Tìm duplicate logic và existing abstraction trước khi tạo function mới.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 36.12 — Theo dõi variable rename, type, nullability, scope, serialization và DB mapping.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 36.13 — Duy trì Temporal Variable Binding khi symbol đổi tên hoặc di chuyển.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 36.14 — Phát hiện schema/config/migration impact và rollback requirement.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 36.16 — Bắt buộc independent review khi đổi public API, security hoặc multi-module contract.

- **Trạng thái:** `partial`
- **Vì sao chưa hoàn tất:** Có một phần hành vi và test liên quan trong 2.24.0, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.
- **Điều kiện hoàn tất:** Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.
- **Bằng chứng hiện có:** src/construction/specification-compiler.mjs, src/construction/requirement-traceability-ledger.mjs, src/construction/invariant-ledger.mjs, src/construction/executable-plan-engine.mjs, src/construction/state-capsule-store.mjs, src/construction/prospective-obligation-ledger.mjs, src/construction/goal-conflict-resolver.mjs, src/construction/semantic-patch-analyzer.mjs, src/construction/dynamic-patch-budget.mjs, src/construction/test-impact-selector.mjs, src/construction/candidate-patch-selector.mjs, src/construction/completion-proof-builder.mjs, src/construction/construction-control-plane.mjs, src/decision/decision-plane.mjs, src/agent/agent-loop.mjs, tests/specification-compiler.test.mjs, tests/requirement-traceability-ledger.test.mjs, tests/invariant-ledger.test.mjs, tests/executable-plan-engine.test.mjs, tests/state-capsule-store.test.mjs, tests/prospective-obligation-ledger.test.mjs, tests/goal-conflict-resolver.test.mjs, tests/semantic-patch-analyzer.test.mjs, tests/dynamic-patch-budget.test.mjs, tests/test-impact-selector.test.mjs, tests/candidate-patch-selector.test.mjs, tests/completion-proof-builder.test.mjs, tests/construction-control-plane.test.mjs, tests/construction-decision-plane-integration.test.mjs, tests/agent-loop-construction-mode.test.mjs, docs/long-horizon-construction-measurement-2.24.0.json

### 36.17 — Chạy counterfactual patch ablation để thử bỏ phần không cần thiết.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 36.18 — Phát hiện semantic merge conflict dù Git không có textual conflict.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 37. Verification và Independent Review

### 37.1 — Tạo Test Impact Map changed symbol→caller→module→related test→historical failure.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.2 — Chọn verification pyramid theo risk thay vì full suite hoặc một test cố định.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.3 — Chạy parse/type trước targeted, module, integration và full suite có điều kiện.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.4 — Tạo temporary mutation probe cho boundary, validation và branch logic.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.5 — Dùng reviewer khác model hoặc provider cho thay đổi vượt risk threshold.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.6 — Reviewer không nhận rationale dài của executor để giảm anchoring.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.7 — Reviewer nhận requirement, evidence, diff, test receipts và residual risks.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.8 — Bắt buộc giải quyết disagreement high/critical trước completion.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.9 — Gắn từng verification receipt trực tiếp vào acceptance criterion.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.10 — Tạo Semantic Completion Gate cho requirement, UX, compatibility và side effect.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.11 — Yêu cầu browser/API journey receipt khi behavior phụ thuộc runtime surface.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.12 — Chạy performance check khi patch chạm hot path hoặc resource budget.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.13 — Chạy security scan khi patch chạm input, shell, network, secret hoặc auth.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.14 — Chạy backward compatibility contract khi public interface liên quan.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.15 — Duy trì hidden regression set không cho executor đọc đáp án.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.16 — Phát hiện flaky test và không dùng một lần pass làm bằng chứng duy nhất.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.17 — Chặn xóa, skip, mock quá mức hoặc làm yếu assertion để test xanh giả.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 37.18 — Xuất proof bundle machine-readable và human-readable trước completion claim.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 38. Learned Routing, Harness và Calibration

### 38.1 — Thay scoring tĩnh bằng contextual bandit nhẹ dưới hard constraints.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.2 — Dùng feature task type, language, repo size, risk, symbols, context và tools.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.3 — Chỉ cập nhật reward sau verification, không học từ response chưa chạy test.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.4 — Reward gồm criteria, first-patch, retained patch, token, RAM, correction và human intervention.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.5 — Chạy policy candidate ở shadow mode trước khi nhận traffic.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.6 — Đánh giá candidate trên held-out tasks không dùng trực tiếp để tune.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.7 — Canary theo cohort xác định và tự disable khi regression.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.8 — Rollback chính xác router/harness profile bằng version và SHA-256.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.9 — Chọn provider và harness profile như một cặp, không độc lập giả tạo.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.10 — Học reasoning effort, tool budget, retry và context strategy theo task.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.11 — Đưa latency, peak RSS và rssMbSeconds vào routing decision.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.12 — Hiệu chỉnh confidence theo domain và task type từ outcome thật.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.13 — Duy trì domain-conditioned trust cho executor, reviewer và tool.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.14 — Học patch survival, revert và human rewrite sau 7–30 ngày.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.15 — Không xem Accept click là bằng chứng duy nhất về chất lượng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.16 — Giới hạn exploration bằng safety, budget và reversibility.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.17 — Giữ lineage của profile, policy, benchmark và reason promote/rollback.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 38.18 — Hỗ trợ mid-session model switch với state capsule và harness translation.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 39. Memory OS, Replay và Skill Induction

### 39.1 — Hỗ trợ memory operation suppress, deprioritize, invalidate, archive, abstract và delete.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.2 — Giữ version history và validity interval thay vì ghi đè memory cũ.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.3 — Tách Subconscious Buffer, Episodic Memory, Semantic Schema và Exception Store.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.4 — Học thao tác ADD/UPDATE/DELETE/RETRIEVE/SUMMARIZE/NOOP dưới governance.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.5 — Chỉ consolidate khi recurrence, surprise, verified value hoặc commitment yêu cầu.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.6 — Lập Scheduled Replay theo prediction error, conflict, revert và transfer value.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.7 — Tính model-time từ policy drift, schema change và correction rate thay vì số bước.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.8 — Biên dịch workflow thành skill có precondition, parameter, effect, invariant và verifier.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.9 — Mỗi skill có failure signature, cost estimate, rollback và decomposition.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.10 — Chỉ promote skill sau transfer test trên repository/vocabulary khác.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.11 — Giữ skill lineage, parent, fork, merge, rejection và benchmark evidence.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.12 — Kết hợp skill cũ sau type/precondition/effect compatibility check.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.13 — Chạy Stability–Plasticity Guard trước khi promote memory/skill policy.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.14 — Đo forward transfer, backward transfer, negative transfer và memory growth.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.15 — Cho người dùng xem, sửa, invalidate, archive và xóa memory/skill.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.16 — Lưu Repository Causal Memory giải thích vì sao quyết định kiến trúc tồn tại.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.17 — Giữ Schema–Exception Dual Store để bảo vệ legacy và platform exception.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 39.18 — Gắn memory/skill write vào public receipt, không lưu hidden reasoning.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 40. Resource Fabric và Admission Control

### 40.1 — Gắn lease cho model, browser, terminal, LSP, embedding worker, indexer và test runner.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.2 — Admission control theo expected utility trên MB tăng thêm và time cost.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.3 — Enforce process-tree CPU, RSS, process và FD budget trên target platform.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.4 — Tính rssMbSeconds cho từng resource, task và mission.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.5 — Unload resource idle theo TTL và pressure state.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.6 — Pool provider process chỉ khi protocol hỗ trợ session thực.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.7 — Pool LSP theo language/workspace và đóng server không còn consumer.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.8 — Tái sử dụng browser context trong mission nhưng reset state theo journey contract.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.9 — Unload embedding model trước browser/test demand dự đoán.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.10 — Lazy-init SQLite store và subsystem chỉ ở first use.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.11 — Dùng content-addressed artifact store để tránh sao chép dữ liệu giữa DB.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.12 — Lưu log thô trên disk; RAM chỉ giữ summary, cursor và offset.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.13 — Bound tool output trước context/memory và giữ raw artifact bằng hash.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.14 — Dự đoán pressure trước khi host vượt viability region.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.15 — Định nghĩa Viability Region cho RAM, disk, error, agent và irreversible action.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.16 — Local Device Doctor đo máy và chọn Lite/Balanced/Performance có giải thích.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.17 — Giữ startup/idle RSS budget bằng release measurement trên cold và warm start.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 40.18 — Phát hiện orphan/leaked process và kill toàn cây khi mission dừng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 41. Multi-Agent Blackboard và Coordination

### 41.1 — Tạo Shared Blackboard cho facts, assumptions, blockers, artifacts và ownership.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.2 — Version hóa entry và giải quyết conflict bằng provenance/confidence.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.3 — Duy trì belief riêng theo agent, time, source, confidence và domain.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.4 — Duy trì Joint Commitment Ledger cho goal, role, interface và handoff.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.5 — Yêu cầu renegotiation khi public contract thay đổi.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.6 — Chọn topology thích ứng: solo, planner-executor, reviewer, candidates, debate, hierarchy hoặc blackboard.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.7 — Dùng domain-conditioned trust khi chọn agent/reviewer.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.8 — Gán causal credit bằng counterfactual contribution thay vì agent cuối cùng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.9 — Giữ reviewer context độc lập với executor để tránh đồng hóa.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.10 — Phát hiện semantic merge conflict và incompatible API assumption giữa agents.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.11 — Gắn symbol/path ownership từ AST/LSP/build graph, không chỉ khai báo task.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.12 — Bàn giao bằng structured receipt có artifact hash và verification state.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.13 — Từ chối stale worker bằng lease, heartbeat và fencing token.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.14 — Đặt communication budget và chỉ broadcast workspace coalition thắng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.15 — Phát hiện deadlock, circular wait và stalled commitment.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.16 — Cho phép revoke, reassign và reconcile task sau mỗi wave.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.17 — Giữ cultural skill lineage qua các thế hệ agent.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 41.18 — Đo routing regret, coordination overhead, conflict rate và useful parallelism.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 42. Browser, Computer Use và Product Evidence

### 42.1 — Replay browser journey xác định từ versioned action script.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.2 — Ghi DOM, accessibility tree, console, network và assertion receipts.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.3 — Ghi screenshot/video before-after bằng artifact hash.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.4 — Thực hiện visual regression với tolerance và vùng ignore được review.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.5 — Yêu cầu human-approved baseline cho visual oracle quan trọng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.6 — Hỗ trợ click, type, select, drag, upload và keyboard action có bounded scope.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.7 — Reset cookie/storage/service worker theo journey isolation contract.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.8 — Tái sử dụng browser process/context khi an toàn để giảm warm-up.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.9 — Kiểm thử desktop/Electron app bằng computer-use driver có receipt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.10 — Xuất demo artifact cho reviewer thay vì chỉ nói UI hoạt động.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.11 — Chặn prompt injection từ page, DOM, clipboard và downloaded content.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.12 — Không đưa cookie, authorization header, password hoặc secret vào prompt/receipt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.13 — Áp dụng network allowlist và download execution deny mặc định.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.14 — Chứng minh runtime trên Windows, macOS và Linux trước cross-platform claim.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.15 — Gắn accessibility acceptance criteria vào feature UI.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.16 — Hiển thị Artifact Playback để xem journey và rewind checkpoint.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.17 — Phát hiện flaky journey bằng replay lặp và state fingerprint.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 42.18 — Không coi ảnh giống là bằng chứng duy nhất về product correctness.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 43. Security, Supply Chain và Failure Injection

### 43.1 — Tạo taint analysis từ input tới shell, SQL, network, filesystem và template sink.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.2 — Phát hiện command, SQL, path, template và code injection theo ngữ cảnh.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.3 — Chống prompt injection từ repository, website, terminal và tool output.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.4 — Đánh giá dependency theo CVE, license, abandonment và malicious package signal.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.5 — Xuất SBOM và provenance cho source, dependency, model pack và artifact.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.6 — Không tự nâng dependency khi compatibility chưa được chứng minh.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.7 — Đảm bảo secret không đi vào prompt, context, memory, trace hoặc receipt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.8 — Dùng capability theo mission và token ngắn hạn có revoke.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.9 — Inject mất mạng, timeout, DNS lỗi và provider overload.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.10 — Inject hết RAM, process chết, orphan child và FD exhaustion.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.11 — Inject DB lock, disk full và file đổi giữa transaction.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.12 — Chạy sandbox escape suite cho symlink, junction, traversal và mount escape.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.13 — Chạy child-process, environment leakage và socket/credential escape tests.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.14 — Chặn agent tự sửa policy, verifier, audit log hoặc capability boundary.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.15 — Phát hiện data exfiltration qua network, logs, artifacts và error messages.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.16 — Ký receipt và phát hiện audit tampering bằng hash chain.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.17 — Áp dụng evidence threshold theo reversibility và impact.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 43.18 — Quarantine dependency/model/plugin không qua integrity và policy checks.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 44. Agent-native UI và IDE Experience

### 44.1 — Giữ ba shell Mission, Work, Evidence làm navigation chính.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.2 — Hiển thị code, diff, terminal, browser, test và timeline trong cùng work surface.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.3 — Hiển thị decision, evidence và reason công khai mà không lộ chain-of-thought.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.4 — Tạo Review Queue nhóm theo risk và dependency thay vì thời gian đơn thuần.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.5 — Cho approve/reject theo hunk, file, command, capability và mission stage.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.6 — Hiển thị Artifact Playback và rewind tới checkpoint bất kỳ.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.7 — Cho steer, pause, redirect, reprioritize và revoke agent khi đang chạy.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.8 — Tích hợp command palette để truy cập advanced centers không làm navigation nặng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.9 — Có role view cho builder, reviewer và operator trên cùng state source.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.10 — Tích hợp VS Code inline diff, diagnostics, symbol, tests và mission state.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.11 — Tạo JetBrains integration đạt capability parity theo matrix.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.12 — Hiển thị cross-repository workspace và dependency-aware change chain.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.13 — Virtualize list, logs, graph và diff lớn để giữ frame budget.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.14 — Tự giảm effects theo resource pressure và prefers-reduced-motion.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.15 — Đạt keyboard navigation, screen reader labels và contrast acceptance.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.16 — Hiển thị Local Device Doctor và tác động dự kiến trước khi bật subsystem nặng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.17 — Đặt performance budget cho startup, input latency, scroll và panel switch.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 44.18 — Giữ design system đẹp, nhất quán, không dùng blur/animation để che trạng thái thiếu.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 45. Benchmark repository thật và Comparative Certification

### 45.1 — Dùng repository chưa từng thấy và khóa contamination/leakage.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.2 — Bao phủ bug thật, feature thật, refactor thật, migration và review.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.3 — Chạy Forge Studio và đối thủ với cùng model, máy, token, time và permissions.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.4 — Đo pass@1, verified criteria, test pass và regression rate.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.5 — Đo latency, peak RSS, rssMbSeconds và process count.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.6 — Đo correction cycles, reverted lines và human interventions.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.7 — Đo first-patch success và retained-patch/keep rate.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.8 — Có public benchmark reproducible và private held-out suite.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.9 — Không dùng fake provider làm bằng chứng comparative chính.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.10 — Đóng environment bằng lockfile, image/manifest và exact commit.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.11 — Chặn benchmark-specific prompt, rule hoặc hardcoded answer.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.12 — Ghi raw command, artifacts, receipts và failures cho từng run.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.13 — So với Codex, Claude Code, Cursor và Copilot theo version cụ thể.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.14 — Version hóa benchmark; không so score giữa distribution khác mà không ghi rõ.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.15 — Báo confidence interval, variance và failure taxonomy.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.16 — Chạy platform matrix Windows/Linux/macOS khi claim liên quan.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.17 — Có long-horizon, browser/UI, multi-agent và security task.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 45.18 — Chỉ tuyên bố vượt đối thủ sau independent review/certification của raw evidence.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 46. World Models, Simulation và Counterfactual

### 46.1 — Tạo Foresight Controller quyết định khi nào simulation đáng chi phí.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.2 — Chọn world model theo repository, build, test, runtime, browser, resource hoặc security.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.3 — Mỗi world model có domain, version, reliability, cost và failure signature.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.4 — Chọn rollout horizon theo uncertainty và reliability.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.5 — Tạo nhiều rollout khi quyết định có nhiều candidate đáng kể.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.6 — Score rollout reliability và loại state xa dữ liệu thực.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.7 — Rút decision-relevant delta thay vì đưa toàn simulation vào prompt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.8 — Fallback sang real probe khi simulation không đủ tin cậy.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.9 — Mô phỏng API, dependency, state, test và user-visible behavior trước patch.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.10 — Mô phỏng blast radius và rollback feasibility.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.11 — Chạy Causal Intervention Lab giữ biến khác cố định.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.12 — Hỗ trợ counterfactual không sửa, sửa một phần và dùng abstraction sẵn có.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.13 — Tách Imagine, Verify và Execute thành ba state có gate.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.14 — Kết hợp rollout mâu thuẫn bằng provenance và calibrated confidence.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.15 — Cache simulation theo state hash nhưng invalidate khi environment đổi.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.16 — Đo khi simulation cải thiện decision và khi làm kết quả tệ hơn.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.17 — Giới hạn world model không được tự COMMIT file hoặc memory.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 46.18 — Ghi Simulation Receipt gồm input state, model, horizon, confidence và observed validation.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 47. Self-model và Developmental Learning

### 47.1 — Duy trì self-model năng lực theo domain từ verified outcomes.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.2 — Duy trì self-model giới hạn, permission, context, RAM, time và stale evidence.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.3 — Đánh giá tool trust từ expected-vs-actual effect.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.4 — Gắn responsibility của agent với patch, commitment và residual risk.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.5 — Không cho agent tự khai capability nếu không có benchmark/receipt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.6 — Hiệu chỉnh trajectory confidence qua nhiều lượt và tool types.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.7 — Tạo autotelic learning goal chỉ trong sandbox nghiên cứu có budget.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.8 — Chấm goal theo learning progress, reuse, relevance, compute và risk.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.9 — Chọn curriculum trong Zone of Proximal Development.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.10 — Tạo Teacher–Student tasks để phân biệt hiểu cấu trúc và học bề mặt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.11 — Dùng mutation, rename, distractor, platform và prompt injection làm teacher challenge.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.12 — Chia developmental stages với capability gate và autonomy ceiling.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.13 — Điều chỉnh metaplasticity: replay, memory threshold, exploration và promote rate.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.14 — Mô phỏng future-self trước policy/skill update.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.15 — Duy trì prospective memory cho obligation và cleanup còn mở.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.16 — Giải quyết goal conflict mà không âm thầm hy sinh hard constraint.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.17 — Chặn novelty addiction và exploration khi mission completion bị trì hoãn.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 47.18 — Chỉ mở stage mới sau held-out transfer và regression suite.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

## 48. Cross-repository, Self-healing và Self-improvement Safety

### 48.1 — Lập transactional change plan qua frontend, backend, SDK và docs repository.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.2 — Xác định dependency order, compatibility window và intermediate contract.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.3 — Tạo commit chain có provenance và rollback đồng bộ.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.4 — Không coi multi-root workspace là transactional nếu không có all-or-rollback plan.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.5 — Theo dõi CI, crash, log, performance và security alert sau merge.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.6 — Truy incident về decision, patch, test và agent receipt nguồn.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.7 — Tạo self-healing worktree và regression proposal khi lỗi liên quan trực tiếp.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.8 — Đo Change Survival sau 7–30 ngày: revert, rewrite, bug và technical debt.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.9 — Cập nhật router/skill credit từ patch survival, không chỉ test ngay lập tức.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.10 — Duy trì cultural lineage cho skill và architecture decision qua nhiều release.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.11 — Ban hành Self-Improvement Constitution cho phép và cấm self-update rõ ràng.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.12 — Mọi self-update phải qua candidate→sandbox→held-out→regression→red-team→shadow→canary.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.13 — Áp dụng evidence threshold tăng theo irreversibility của action.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.14 — Enforce Viability Region trước promote, merge, delete hoặc policy change.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.15 — Giữ human merge gate và không tự mở rộng autonomy/capability.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.16 — Cấm self-update thay acceptance criteria, tắt verifier, xóa audit hoặc mở filesystem/network.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.17 — Mọi policy/skill/memory update phải có provenance, exact version và rollback.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có

### 48.18 — Giữ explicit non-claims và không tuyên bố frontier superiority thiếu independent evidence.

- **Trạng thái:** `not_implemented`
- **Vì sao chưa hoàn tất:** Yêu cầu frontier mới sau khi loại trùng với 790 mục gốc và các năng lực đã được 2.19.0 đóng bằng test. Chưa có source nên giữ not_implemented.
- **Điều kiện hoàn tất:** Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.
- **Bằng chứng hiện có:** Chưa có
