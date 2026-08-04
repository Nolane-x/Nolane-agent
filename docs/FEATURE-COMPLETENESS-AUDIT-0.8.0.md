# Forge Studio 0.8.0 — Kiểm toán checklist tính năng

- Checklist SHA-256: `0cf4fa71e36f2eb8c0a506cf1a241a00b1e40d2e578a2eedcd8f4516eeef7bd7`
- Tổng mục: **790**
- Có source + test: **405**
- Một phần: **209**
- Cổng bên ngoài: **52**
- Chưa triển khai: **124**

> “Có source + test” không đồng nghĩa đã vận hành production trên mọi OS, cloud hoặc tenant. JSON đi kèm chứa trạng thái và evidence cho toàn bộ 790 mục.

| # | Nhóm | Tổng | Source + test | Một phần | Cổng ngoài | Chưa có |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Nguyên tắc kiến trúc | 24 | 15 | 6 | 3 | 0 |
| 2 | Mục tiêu sản phẩm | 30 | 17 | 9 | 3 | 1 |
| 3 | Các chế độ sử dụng | 25 | 0 | 22 | 3 | 0 |
| 4 | Giao diện người dùng | 44 | 20 | 10 | 0 | 14 |
| 5 | Agent runtime cốt lõi | 33 | 26 | 5 | 0 | 2 |
| 6 | Trạng thái agent | 35 | 19 | 11 | 0 | 5 |
| 7 | Vòng đời tác vụ | 25 | 18 | 5 | 2 | 0 |
| 8 | Task specification | 20 | 7 | 4 | 0 | 9 |
| 9 | Bộ lập kế hoạch | 20 | 13 | 7 | 0 | 0 |
| 10 | Bộ quản lý context | 33 | 15 | 18 | 0 | 0 |
| 11 | Repository discovery | 30 | 7 | 23 | 0 | 0 |
| 12 | File hướng dẫn agent | 20 | 10 | 10 | 0 | 0 |
| 13 | Codebase intelligence | 40 | 20 | 13 | 0 | 7 |
| 14 | Công cụ đọc file | 20 | 16 | 1 | 0 | 3 |
| 15 | Công cụ tìm kiếm | 25 | 11 | 4 | 0 | 10 |
| 16 | Công cụ chỉnh sửa file | 30 | 13 | 7 | 0 | 10 |
| 17 | Patch engine | 20 | 12 | 3 | 0 | 5 |
| 18 | Terminal và shell tool | 34 | 22 | 8 | 0 | 4 |
| 19 | Phân loại lệnh nguy hiểm | 20 | 12 | 8 | 0 | 0 |
| 20 | Sandbox | 38 | 15 | 1 | 11 | 11 |
| 21 | Local sandbox | 20 | 10 | 3 | 4 | 3 |
| 22 | Cloud sandbox | 30 | 11 | 0 | 19 | 0 |
| 23 | Hệ thống quyền | 49 | 24 | 9 | 2 | 14 |
| 24 | Guardrails | 30 | 19 | 2 | 0 | 9 |
| 25 | Secret management | 25 | 18 | 1 | 1 | 5 |
| 26 | Git integration | 41 | 19 | 11 | 4 | 7 |
| 27 | Worktree và đa nhiệm | 20 | 11 | 4 | 0 | 5 |
| 28 | Test engine | 9 | 5 | 4 | 0 | 0 |

## Các giới hạn chưa đóng (trích yếu)

- **1.2 — Thêm extension IDE sau khi lõi ổn định:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **1.3 — Thêm desktop app khi cần đa agent:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **1.4 — Thêm cloud agent ở giai đoạn cuối:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **1.6 — Cho phép chuyển sang cloud sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **1.7 — Hỗ trợ Windows ngay từ kiến trúc:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **1.8 — Hỗ trợ Linux và macOS:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **1.14 — Mọi tác vụ phải có giới hạn tài nguyên:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **1.18 — Tách phần suy nghĩ khỏi phần thực thi:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **1.23 — Ưu tiên hệ thống đơn giản nhưng mở rộng được:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.3 — Giải thích kiến trúc dự án:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.10 — Sửa test thất bại:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.14 — Sửa lỗi dependency:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.15 — Giải quyết conflict Git:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.16 — Tạo commit:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.17 — Tạo pull request:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **2.18 — Review pull request:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.19 — Kiểm tra bảo mật:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.20 — Cập nhật tài liệu:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **2.25 — So sánh ảnh trước và sau:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **2.26 — Triển khai bản preview:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **2.27 — Theo dõi CI:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **2.29 — Chạy nhiều tác vụ song song:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.1 — Chế độ hỏi đáp codebase:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.2 — Chế độ chỉ đọc:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.3 — Chế độ lập kế hoạch:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.4 — Chế độ chỉnh sửa có phê duyệt:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.5 — Chế độ tự động chỉnh sửa:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.6 — Chế độ review code:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.7 — Chế độ debug:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.8 — Chế độ viết test:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.9 — Chế độ refactor:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.10 — Chế độ migration:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.11 — Chế độ thiết kế kiến trúc:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.12 — Chế độ tạo dự án:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.13 — Chế độ sửa CI:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.14 — Chế độ xử lý issue:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.15 — Chế độ tạo pull request:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **3.16 — Chế độ chạy nền:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.17 — Chế độ nhiều agent:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.18 — Chế độ học codebase:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.19 — Chế độ khôi phục sự cố:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.20 — Chế độ giải thích từng bước:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.21 — Chế độ nhanh, ít token:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.22 — Chế độ sâu, nhiều bước:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.23 — Chế độ ngoại tuyến với model local:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.24 — Chế độ cloud sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **3.25 — Chế độ doanh nghiệp:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **4.1 — CLI tương tác:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 0.8.0.
- **4.2 — CLI không tương tác:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 0.8.0.
- **4.3 — IDE extension:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.7 — SDK cho Python:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 0.8.0.
- **4.8 — SDK cho TypeScript:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 0.8.0.
- **4.16 — Trình sửa diff:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.19 — Trình xem trace:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.21 — Trình duyệt tích hợp:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.22 — Trình xem ảnh:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.23 — Trình xem dependency graph:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 0.8.0.
- **4.24 — Trình xem call graph:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 0.8.0.
- **4.25 — Trình xem Git history:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.26 — Trình quản lý quyền:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.27 — Trình quản lý model:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.28 — Trình quản lý công cụ:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.29 — Trình quản lý MCP:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.30 — Trình quản lý secrets:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.31 — Trình quản lý sandbox:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **4.32 — Trình quản lý chi phí:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.33 — Trình quản lý context:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.34 — Trình quản lý bộ nhớ:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.35 — Trình quản lý agent con:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.43 — Nút sửa câu lệnh trước khi chạy:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.44 — Nút chuyển sang điều khiển thủ công:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.19 — Kiểm tra giới hạn chi phí:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.21 — Kiểm tra hành động trùng lặp:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **5.22 — Kiểm tra tiến triển thực tế:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.23 — Yêu cầu người dùng khi cần:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.27 — Ghi usage:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 0.8.0.
- **5.32 — Giải phóng sandbox:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.33 — Giữ sandbox khi cần tiếp tục:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **6.3 — ID người dùng:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **6.5 — ID repository:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
