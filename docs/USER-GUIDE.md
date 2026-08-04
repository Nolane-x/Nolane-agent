# Hướng dẫn Forge Studio 0.6.0

## 1. Bắt đầu

1. Giải nén gói Windows.
2. Chạy `ForgeStudio.exe`.
3. Chọn thư mục repository.
4. Kết nối một AI provider.
5. Bật Workspace Autopilot nếu muốn Forge tự thực hiện các thao tác phát triển có thể hoàn tác.
6. Nhập kết quả mong muốn vào ô chat.

## 2. Goal và task khác nhau thế nào?

- **Goal** là mục tiêu dài hạn, có tiêu chí thành công, ngân sách, lịch chạy và lịch sử đổi kế hoạch.
- **Mission** là một lần Forge cố gắng đạt goal.
- **Task** là một bước hữu hạn trong mission.

Có thể dùng giao diện Goal OS hoặc lệnh:

```text
/goal new "Ổn định đăng nhập" --project PROJECT_ID --objective "Sửa toàn bộ lỗi refresh token" --max-tokens 200000
/goal run GOAL_ID
/status GOAL_ID
```

## 3. Khi Forge phát hiện điều mới

Forge ghi phát hiện kèm nguồn và độ ảnh hưởng. Nếu phát hiện làm giả định cũ không còn đúng, Forge đề xuất một bản vá kế hoạch. Khi goal bật auto-replan, bản vá hợp lệ được áp dụng tại checkpoint an toàn; giao diện hiển thị lý do, task được thêm hoặc đổi, và revision trước đó vẫn được giữ.

## 4. Browser Agent

Mở Goal OS → Browser → **Cài Browser Runtime**. Forge cài phiên bản Playwright CLI đã ghim và Chromium vào cache riêng.

Các thao tác đọc như mở trang, snapshot, tìm nội dung, xem console/network và chụp ảnh không đồng nghĩa với quyền ghi. Để cho phép agent thao tác trang:

```text
/permissions grant --goal GOAL_ID --browser click,fill,type,press
/permissions show --goal GOAL_ID
/permissions revoke --goal GOAL_ID --browser fill,type
```

Không cấp quyền nhập secret vào domain lạ, thanh toán hoặc xuất bản tự động.

## 5. Plugin cộng đồng

Trong Plugin Center:

1. Thêm marketplace bằng thư mục local hoặc URL GitHub/Git HTTPS.
2. Chọn plugin và cài đặt.
3. Xem capability review.
4. Chọn chính xác MCP/LSP server cần dùng.
5. Kích hoạt cho một project.

Forge không chạy hook khi cài. Plugin được khóa theo commit và content hash. Cập nhật nguồn tạo cache entry mới thay vì sửa entry cũ.

## 6. Quan sát agent

Live Mission Graph hiển thị:

- agent và vai trò;
- task đang chạy và dependency;
- model/provider;
- file, command hoặc URL hiện tại;
- discovery mới;
- plan revision;
- token, thời gian và blocker;
- kết quả test/review.

Nhấn **Dừng**, **Tạm dừng**, **Tiếp tục**, **Thử lại** hoặc gửi hướng dẫn mới trong khi Forge chạy. Hướng dẫn được áp dụng ở checkpoint an toàn kế tiếp.

## 7. Khôi phục

Khi verification thất bại, Forge giữ worktree, checkpoint, lỗi gốc và bằng chứng. Tin nhắn “tiếp tục” hoặc `/resume` chuyển task về trạng thái có thể chạy và khởi động lại Autopilot từ checkpoint thay vì mất toàn bộ tiến trình.

## 8. Những việc Forge vẫn phải dừng

Autopilot không tự deploy production, xuất credential, mua hàng, gửi dữ liệu ra ngoài, xóa dữ liệu ngoài worktree, chạy quyền administrator hoặc thay đổi hệ thống mà không có quyền rõ ràng.
