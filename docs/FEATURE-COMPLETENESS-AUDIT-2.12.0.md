# Forge Studio 2.12.0 — Kiểm toán checklist tính năng

- Checklist SHA-256: `0cf4fa71e36f2eb8c0a506cf1a241a00b1e40d2e578a2eedcd8f4516eeef7bd7`
- Tổng mục: **790**
- Có source + test: **704**
- Một phần: **30**
- Cổng bên ngoài: **56**
- Chưa triển khai: **0**

> “Có source + test” không đồng nghĩa đã vận hành production trên mọi OS, cloud hoặc tenant. JSON đi kèm chứa trạng thái và evidence cho toàn bộ 790 mục.

| # | Nhóm | Tổng | Source + test | Một phần | Cổng ngoài | Chưa có |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Nguyên tắc kiến trúc | 24 | 15 | 6 | 3 | 0 |
| 2 | Mục tiêu sản phẩm | 30 | 18 | 9 | 3 | 0 |
| 3 | Các chế độ sử dụng | 25 | 22 | 0 | 3 | 0 |
| 4 | Giao diện người dùng | 44 | 37 | 7 | 0 | 0 |
| 5 | Agent runtime cốt lõi | 33 | 31 | 2 | 0 | 0 |
| 6 | Trạng thái agent | 35 | 35 | 0 | 0 | 0 |
| 7 | Vòng đời tác vụ | 25 | 22 | 1 | 2 | 0 |
| 8 | Task specification | 20 | 20 | 0 | 0 | 0 |
| 9 | Bộ lập kế hoạch | 20 | 20 | 0 | 0 | 0 |
| 10 | Bộ quản lý context | 33 | 33 | 0 | 0 | 0 |
| 11 | Repository discovery | 30 | 30 | 0 | 0 | 0 |
| 12 | File hướng dẫn agent | 20 | 20 | 0 | 0 | 0 |
| 13 | Codebase intelligence | 40 | 39 | 0 | 1 | 0 |
| 14 | Công cụ đọc file | 20 | 19 | 1 | 0 | 0 |
| 15 | Công cụ tìm kiếm | 25 | 25 | 0 | 0 | 0 |
| 16 | Công cụ chỉnh sửa file | 30 | 30 | 0 | 0 | 0 |
| 17 | Patch engine | 20 | 20 | 0 | 0 | 0 |
| 18 | Terminal và shell tool | 34 | 34 | 0 | 0 | 0 |
| 19 | Phân loại lệnh nguy hiểm | 20 | 20 | 0 | 0 | 0 |
| 20 | Sandbox | 38 | 26 | 1 | 11 | 0 |
| 21 | Local sandbox | 20 | 10 | 3 | 7 | 0 |
| 22 | Cloud sandbox | 30 | 11 | 0 | 19 | 0 |
| 23 | Hệ thống quyền | 49 | 49 | 0 | 0 | 0 |
| 24 | Guardrails | 30 | 30 | 0 | 0 | 0 |
| 25 | Secret management | 25 | 24 | 0 | 1 | 0 |
| 26 | Git integration | 41 | 35 | 0 | 6 | 0 |
| 27 | Worktree và đa nhiệm | 20 | 20 | 0 | 0 | 0 |
| 28 | Test engine | 9 | 9 | 0 | 0 | 0 |

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
- **2.26 — Triển khai bản preview:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **2.27 — Theo dõi CI:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **2.29 — Chạy nhiều tác vụ song song:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **3.15 — Chế độ tạo pull request:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **3.24 — Chế độ cloud sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **3.25 — Chế độ doanh nghiệp:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **4.3 — IDE extension:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.22 — Trình xem ảnh:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.24 — Trình xem call graph:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.25 — Trình xem Git history:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.32 — Trình quản lý chi phí:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.43 — Nút sửa câu lệnh trước khi chạy:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.44 — Nút chuyển sang điều khiển thủ công:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.32 — Giải phóng sandbox:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.33 — Giữ sandbox khi cần tiếp tục:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.22 — Commit nếu được phép:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.23 — Tạo PR nếu được phép:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **7.25 — Đóng sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **13.27 — Hỗ trợ tree-sitter:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **14.18 — Làm sạch nội dung độc hại:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **20.3 — Filesystem riêng:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.4 — Process namespace riêng:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.5 — Network namespace riêng:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.8 — Home directory riêng:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.9 — Cache có kiểm soát:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **20.10 — CPU quota:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.11 — RAM quota:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.12 — Disk quota:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.13 — Process quota:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.14 — File descriptor quota:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.32 — Clone sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **20.34 — Thu gom sandbox lỗi:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.1 — Dùng OS process isolation:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.2 — Dùng container khi có thể:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.3 — Hỗ trợ Docker:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.4 — Hỗ trợ Podman:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.5 — Hỗ trợ WSL sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.6 — Hỗ trợ Windows Job Objects:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.7 — Hỗ trợ macOS sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **21.11 — Kiểm tra Docker daemon:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **21.12 — Kiểm tra quyền mount:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **21.14 — Kiểm tra socket escape:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **22.2 — Clone repository:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.3 — Checkout commit chính xác:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.4 — Cài dependency:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.5 — Khôi phục cache:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.7 — Chạy bootstrap script:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.8 — Kiểm tra bootstrap:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.9 — Lưu image môi trường:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.10 — Tái sử dụng image:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.11 — Gắn branch riêng:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.12 — Đồng bộ diff về client:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.13 — Stream log về client:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.14 — Hỗ trợ terminal từ xa:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.15 — Hỗ trợ browser từ xa:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.16 — Hỗ trợ preview URL:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.22 — Mã hóa disk:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.23 — Mã hóa network:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.24 — Cách ly tenant:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.28 — Có region selection:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **22.29 — Có data residency policy:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **25.6 — Dùng OS keychain:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
