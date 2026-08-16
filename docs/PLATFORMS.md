# Platform support

## 0.0.0 package matrix
| Platform | Architecture | Artifacts | Signing/notarization claim | In-app update handoff |
|---|---|---|---|---|
| Windows | x64 | NSIS EXE | Conditional; only claimed with verification receipt | Disabled in baseline configuration |
| macOS | x64 | DMG, ZIP | No notarization claim in baseline | Not claimed |
| Linux | x64 | AppImage, DEB | No package-signing claim in baseline | Not claimed |

GitHub-hosted CI/build success is not a substitute for real-machine validation. Real-machine performance, installer upgrade/recovery, and labelled low-memory testing are scheduled after 0.0.0.
