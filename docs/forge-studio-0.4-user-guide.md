# Forge Studio 0.4 — Hướng dẫn nhanh

## Quy trình 30 giây

1. Chọn repository.
2. Bật **Workspace Autopilot**.
3. Mô tả kết quả mong muốn.
4. Nhấn **Bắt đầu**.
5. Theo dõi timeline, Preview và Tests.
6. Gửi thêm yêu cầu khi cần.
7. Review rồi giữ hoặc hoàn tác kết quả.

## Ví dụ yêu cầu tốt

> Sửa lỗi đăng nhập bị mất phiên sau khi refresh. Giữ nguyên API hiện tại, thêm regression test và không thay đổi giao diện ngoài thông báo lỗi.

Yêu cầu nên nói rõ kết quả, giới hạn và tiêu chí thành công. Không cần chỉ định file hay câu lệnh.

## Ý nghĩa trạng thái

- **Đang hiểu yêu cầu:** đọc instruction và tìm phần code liên quan.
- **Đang lập kế hoạch:** tạo task DAG và chọn provider.
- **Đang xây dựng:** sửa code trong worktree riêng.
- **Đang kiểm thử:** chạy test/build/lint và tự sửa lỗi có thể xử lý.
- **Đang review:** agent độc lập kiểm tra diff và evidence.
- **Cần quyết định:** gặp hành động không thể tự suy luận hoặc hard stop.
- **Hoàn thành:** completion gate đã nhận bằng chứng hợp lệ.
