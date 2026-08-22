# Nolane Agent 0.0.1

<div align="center">
  <img src="build/icon.svg" width="112" alt="Biểu tượng Nolane Agent" />
  <h3>Trung tâm điều phối AI cục bộ cho công việc nghiêm túc.</h3>
  <p>Đưa AI agent vào đúng dự án thật — với model, công cụ, skill, trình duyệt, phê duyệt, bằng chứng và khôi phục trong cùng một ứng dụng desktop.</p>

  <a href="https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1"><img src="https://img.shields.io/github/v/release/Nolane-x/Nolane-agent?display_name=tag&sort=semver" alt="Phiên bản phát hành" /></a>
  <a href="https://github.com/Nolane-x/Nolane-agent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Nolane-x/Nolane-agent/ci.yml?label=verification" alt="Xác minh" /></a>
  <a href="https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1"><img src="https://img.shields.io/badge/nền%20tảng-Windows%20%7C%20macOS%20%7C%20Linux-7c6cf0" alt="Windows, macOS và Linux" /></a>
</div>

<p align="center">
  <a href="README.md">English</a> · <strong>Tiếng Việt</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.hi.md">हिन्दी</a>
</p>

Nolane Agent không phải một ô chat trống. Đây là **workspace AI hiểu dự án**: bạn chọn thư mục làm việc, runtime, model, effort, skill và mức phê duyệt; sau đó nhìn thấy AI lập kế hoạch, sử dụng công cụ, duyệt web, kiểm tra kết quả, lưu bằng chứng và sẵn sàng khôi phục khi cần.

## Tải Nolane Agent 0.0.1

| Nền tảng | Gói cài đặt |
| --- | --- |
| Windows | [NSIS installer (.exe)](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-Setup-0.0.1-x64.exe) |
| macOS | [DMG](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x64.dmg) hoặc [ZIP](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x64.zip) |
| Linux | [AppImage](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x86_64.AppImage) hoặc [gói Debian](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-amd64.deb) |

## Điều gì làm Nolane Agent khác biệt?

- **Làm việc trong dự án thật** — chọn thư mục cục bộ trước khi AI hành động; chuyển tự nhiên giữa hội thoại, file, terminal, diff, hoạt động trình duyệt và thực thi.
- **Dùng runtime bạn đã có** — phát hiện API và CLI provider được hỗ trợ, bao gồm các hệ sinh thái lớn như Codex, Claude, Gemini, OpenCode và runtime cục bộ/tương thích.
- **Chọn model một cách trung thực** — model chỉ được cho chọn khi provider có thể thực sự áp dụng lựa chọn đó; không dùng một giao diện “universal” giả tạo.
- **Điều chỉnh effort đúng nơi** — chọn effort theo từng model khi runtime hỗ trợ; khi không hỗ trợ, Nolane tôn trọng mặc định của provider.
- **Giữ quyền kiểm soát** — có ba chế độ Ask for approval, Approve for me và Full access; kế hoạch, công cụ, kết quả và receipt luôn có thể xem lại.
- **Skill có thể tích lũy** — tìm kiếm, kiểm tra, cài và gắn skill cục bộ hoặc Forge OS có provenance; plugin và MCP vẫn đi qua Control Plane.
- **Giao diện tăng dần theo nhu cầu** — Everyday, Workspace, Studio và Expert bày ra nhiều năng lực hơn nhưng không che giấu trạng thái thực tế.
- **Khôi phục có chủ đích** — checkpoint bền vững, lỗi có ngữ cảnh, snapshot trước restart và rào chắn khi mission đang chạy.

## Một vòng điều khiển hoàn chỉnh

```text
Ý định / hội thoại
  → dự án, provider, model, effort và skill được chọn
  → kế hoạch mission và tác vụ có thể quan sát
  → tool, terminal, browser và agent runtime có kiểm soát
  → review, xác minh, bằng chứng và khôi phục
```

| Bạn cần | Nolane Agent cung cấp |
| --- | --- |
| Không gian làm việc đáng tin | Một dự án cục bộ được chọn rõ ràng thay vì prompt bị tách rời. |
| AI mạnh nhưng không mù mờ | Model, effort và khả năng của provider được hiển thị theo năng lực thực. |
| Tự động hóa có ranh giới | Chế độ phê duyệt, receipt, checkpoint và recovery thay vì giao toàn bộ quyền kiểm soát. |
| Hệ thống ngày càng hữu ích | Skill, plugin và MCP có provenance, được quản trị qua Control Plane. |
| Ứng dụng desktop cập nhật được | Installer native, metadata update, checksum, nâng cấp Windows tại chỗ và giữ lại dữ liệu ứng dụng. |

## Bắt đầu trong năm phút

1. Tải gói phù hợp với hệ điều hành.
2. Chọn hoặc tạo dự án cục bộ mà AI sẽ làm việc trong đó.
3. Kết nối provider hoặc CLI runtime có sẵn; chọn model và effort nếu runtime hỗ trợ.
4. Mô tả mission. Nolane giữ kế hoạch, trạng thái hoạt động, điểm phê duyệt và đường khôi phục hiển thị xuyên suốt quá trình.

## Phát hành desktop và cập nhật

Mỗi bản phát hành được đóng gói hoàn toàn bởi GitHub Actions. Bản `v0.0.1` có installer Windows, DMG/ZIP cho macOS, AppImage/DEB cho Linux, metadata cập nhật, checksum SHA-256 và provenance attestation.

Khi có GitHub Release mới, ứng dụng hiển thị **Tải bản cập nhật** rồi **Cập nhật và khởi động lại**. Cập nhật không tự chạy; mission đang hoạt động sẽ chặn restart cho đến khi an toàn. NSIS thay thế bản cài Windows tại chỗ nhưng giữ lại thư mục dữ liệu ứng dụng.

Các artifact hiện chưa ký code: Windows có thể hiện **Unknown Publisher** và macOS Gatekeeper có thể yêu cầu xác nhận mở ứng dụng. Đây là giới hạn được công khai, không phải lỗi bị che giấu.

## Phạm vi trung thực

Nolane Agent có source, test và bằng chứng CI cho các năng lực đã nêu, nhưng không tuyên bố mọi môi trường bên ngoài đã được chứng minh. Credential provider thật, accessibility độc lập, mọi hành trình phần cứng/nền tảng và replay public release đều có yêu cầu bằng chứng riêng.

## Tài liệu phát hành

- [Release notes](docs/RELEASE-0.0.1.md)
- [Giới hạn đã biết](docs/LIMITATIONS-0.0.1.md)
- [Phạm vi xác minh](docs/VERIFICATION-REPORT-0.0.1.md)
- [Các khoảng trống còn lại](docs/REMAINING-GAPS-0.0.1.md)

Các checkpoint, beta, audit và tài liệu forensic trong `docs/`, `docs/checkpoints/`, `requirements/` và `evidence/` là provenance lịch sử, không phải thương hiệu hiện tại của sản phẩm.
