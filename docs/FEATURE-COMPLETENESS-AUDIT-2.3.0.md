# Forge Studio 2.3.0 — Kiểm toán checklist tính năng

- Checklist SHA-256: `0cf4fa71e36f2eb8c0a506cf1a241a00b1e40d2e578a2eedcd8f4516eeef7bd7`
- Tổng mục: **790**
- Có source + test: **630**
- Một phần: **91**
- Cổng bên ngoài: **52**
- Chưa triển khai: **17**

> “Có source + test” không đồng nghĩa đã vận hành production trên mọi OS, cloud hoặc tenant. JSON đi kèm chứa trạng thái và evidence cho toàn bộ 790 mục.

| # | Nhóm | Tổng | Source + test | Một phần | Cổng ngoài | Chưa có |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Nguyên tắc kiến trúc | 24 | 15 | 6 | 3 | 0 |
| 2 | Mục tiêu sản phẩm | 30 | 18 | 9 | 3 | 0 |
| 3 | Các chế độ sử dụng | 25 | 22 | 0 | 3 | 0 |
| 4 | Giao diện người dùng | 44 | 34 | 7 | 0 | 3 |
| 5 | Agent runtime cốt lõi | 33 | 30 | 3 | 0 | 0 |
| 6 | Trạng thái agent | 35 | 35 | 0 | 0 | 0 |
| 7 | Vòng đời tác vụ | 25 | 18 | 5 | 2 | 0 |
| 8 | Task specification | 20 | 20 | 0 | 0 | 0 |
| 9 | Bộ lập kế hoạch | 20 | 13 | 7 | 0 | 0 |
| 10 | Bộ quản lý context | 33 | 33 | 0 | 0 | 0 |
| 11 | Repository discovery | 30 | 30 | 0 | 0 | 0 |
| 12 | File hướng dẫn agent | 20 | 20 | 0 | 0 | 0 |
| 13 | Codebase intelligence | 40 | 36 | 0 | 0 | 4 |
| 14 | Công cụ đọc file | 20 | 19 | 1 | 0 | 0 |
| 15 | Công cụ tìm kiếm | 25 | 21 | 4 | 0 | 0 |
| 16 | Công cụ chỉnh sửa file | 30 | 22 | 7 | 0 | 1 |
| 17 | Patch engine | 20 | 17 | 3 | 0 | 0 |
| 18 | Terminal và shell tool | 34 | 22 | 8 | 0 | 4 |
| 19 | Phân loại lệnh nguy hiểm | 20 | 12 | 8 | 0 | 0 |
| 20 | Sandbox | 38 | 26 | 1 | 11 | 0 |
| 21 | Local sandbox | 20 | 10 | 3 | 4 | 3 |
| 22 | Cloud sandbox | 30 | 11 | 0 | 19 | 0 |
| 23 | Hệ thống quyền | 49 | 48 | 1 | 0 | 0 |
| 24 | Guardrails | 30 | 28 | 2 | 0 | 0 |
| 25 | Secret management | 25 | 23 | 1 | 1 | 0 |
| 26 | Git integration | 41 | 24 | 11 | 6 | 0 |
| 27 | Worktree và đa nhiệm | 20 | 14 | 4 | 0 | 2 |
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
- **4.21 — Trình duyệt tích hợp:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 2.3.0.
- **4.22 — Trình xem ảnh:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.24 — Trình xem call graph:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.25 — Trình xem Git history:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.30 — Trình quản lý secrets:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 2.3.0.
- **4.31 — Trình quản lý sandbox:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 2.3.0.
- **4.32 — Trình quản lý chi phí:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.43 — Nút sửa câu lệnh trước khi chạy:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **4.44 — Nút chuyển sang điều khiển thủ công:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.23 — Yêu cầu người dùng khi cần:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.32 — Giải phóng sandbox:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **5.33 — Giữ sandbox khi cần tiếp tục:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.5 — Phát hiện thông tin thiếu:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.9 — Ước lượng phạm vi:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.18 — Kiểm tra lỗi bảo mật:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.19 — Kiểm tra tài liệu:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.22 — Commit nếu được phép:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **7.23 — Tạo PR nếu được phép:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **7.25 — Đóng sandbox:** external_gate — Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.
- **9.8 — Xác định rủi ro từng bước:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **9.9 — Xác định file dự kiến sửa:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **9.10 — Xác định công cụ cần dùng:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **9.11 — Xác định agent con cần gọi:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **9.16 — Lưu lý do thay đổi kế hoạch:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **9.17 — Không lập kế hoạch quá chi tiết:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **9.19 — Không cho phép bước mơ hồ:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **13.15 — Lập chỉ mục inheritance graph:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **13.19 — Lập chỉ mục issue liên quan:** not_implemented — Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source 2.3.0.
- **13.26 — Hỗ trợ AST query:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **13.27 — Hỗ trợ tree-sitter:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **14.18 — Làm sạch nội dung độc hại:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **15.10 — Tìm test liên quan:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **15.11 — Tìm config liên quan:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **15.19 — Tìm trong tài liệu:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **15.23 — Tóm tắt kết quả:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.3 — Patch theo AST:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **16.14 — Chỉnh nhiều file nguyên tử:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.22 — Chạy formatter sau sửa:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.23 — Không format toàn dự án vô cớ:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.26 — Không sửa generated code:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.27 — Không xóa comment quan trọng:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.29 — Có giới hạn số file mỗi lượt:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **16.30 — Có giới hạn số dòng mỗi lượt:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **17.13 — Hỗ trợ conflict markers:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **17.18 — Sinh patch tối thiểu:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **17.20 — Đo độ lớn patch:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **18.10 — Hỗ trợ pseudo-terminal:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **18.12 — Hỗ trợ giới hạn CPU:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **18.13 — Hỗ trợ giới hạn RAM:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **18.14 — Hỗ trợ giới hạn process:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **18.15 — Hỗ trợ giới hạn disk:** not_implemented — Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source 2.3.0.
- **18.18 — Hỗ trợ argument filtering:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **18.19 — Hỗ trợ shell escaping:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **18.20 — Hỗ trợ Windows PowerShell:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
- **18.21 — Hỗ trợ CMD khi cần:** partial — Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.
