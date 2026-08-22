# Nolane Agent 0.0.1

<div align="center">
  <img src="build/icon.svg" width="112" alt="Nolane Agent चिह्न" />
  <h3>गंभीर AI कार्य के लिए local-first command centre।</h3>
  <p>AI agent को वास्तविक प्रोजेक्ट में चलाइए — मॉडल, टूल, skills, browser, approval, evidence और recovery एक ही desktop workspace में।</p>

  <a href="https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1"><img src="https://img.shields.io/github/v/release/Nolane-x/Nolane-agent?display_name=tag&sort=semver" alt="रिलीज़" /></a>
  <a href="https://github.com/Nolane-x/Nolane-agent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Nolane-x/Nolane-agent/ci.yml?label=verification" alt="सत्यापन" /></a>
  <a href="https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1"><img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-7c6cf0" alt="Windows, macOS और Linux" /></a>
</div>

<p align="center">
  <a href="README.md">English</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.zh-CN.md">简体中文</a> · <strong>हिन्दी</strong>
</p>

Nolane Agent केवल एक खाली chat box नहीं है। यह एक **project-aware AI workspace** है: पहले local folder, runtime, model, effort, skill और approval boundary चुनें; फिर देखें कि agent कैसे योजना बनाता है, tools चलाता है, web पर काम करता है, परिणाम जाँचता है, evidence रखता है और ज़रूरत पड़ने पर recovery करता है।

## Nolane Agent 0.0.1 डाउनलोड करें

| Platform | Package |
| --- | --- |
| Windows | [NSIS installer (.exe)](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-Setup-0.0.1-x64.exe) |
| macOS | [DMG](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x64.dmg) या [ZIP](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x64.zip) |
| Linux | [AppImage](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x86_64.AppImage) या [Debian package](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-amd64.deb) |

## Nolane Agent को अलग क्या बनाता है?

- **वास्तविक प्रोजेक्ट में काम** — agent के काम शुरू करने से पहले local folder चुनें; chat, files, terminal, diffs, browser activity और execution के बीच सहज रूप से जाएँ।
- **अपना पसंदीदा runtime इस्तेमाल करें** — समर्थित API और CLI providers खोजें, जिनमें Codex, Claude, Gemini, OpenCode तथा local/compatible ecosystems शामिल हैं।
- **ईमानदार model control** — model विकल्प तभी दिखते हैं जब provider वास्तव में उन्हें लागू कर सकता है; झूठे universal controls नहीं।
- **effort सही जगह पर** — जब runtime समर्थन करता है तब model-specific effort चुनें; अन्यथा provider के native defaults बरकरार रहते हैं।
- **हर जोखिम स्तर पर नियंत्रण** — Ask for approval, Approve for me और Full access modes; plan, tool activity, results और receipts की समीक्षा संभव रहती है।
- **दोबारा इस्तेमाल होने वाली skills** — provenance-bound local और Forge OS skills को खोजें, जाँचें, install करें और जोड़ें; plugins व MCP को Control Plane govern करता है।
- **सरल chat से expert workspace तक** — Everyday, Workspace, Studio और Expert स्तर, वास्तविक runtime state को छिपाए बिना क्षमता बढ़ाते हैं।
- **सोच-समझकर recovery** — durable checkpoints, contextual errors, restart से पहले snapshot और active mission के लिए सुरक्षा।

## एक पूरा control loop

```text
Intent / conversation
  → चुना हुआ project, provider, model, effort और skills
  → दिखाई देने वाली mission plan और tasks
  → governed tools, terminal, browser और agent runtime
  → review, verification, evidence और recovery
```

| आपको क्या चाहिए | Nolane Agent क्या देता है |
| --- | --- |
| भरोसेमंद कार्यस्थल | स्पष्ट रूप से चुना हुआ local project, न कि प्रोजेक्ट से अलग prompt। |
| शक्तिशाली पर पारदर्शी AI | वास्तविक क्षमताओं के आधार पर model, effort और provider controls। |
| सीमाओं वाली automation | approval modes, receipts, checkpoints और recovery — पूरी तरह अंधा नियंत्रण नहीं। |
| समय के साथ बेहतर होने वाला system | provenance-bound skills, plugins और MCP, Control Plane द्वारा governed। |
| अपडेट होने वाला desktop app | native installers, update metadata, checksums, in-place Windows upgrade और app data preservation। |

## पाँच मिनट में शुरुआत

1. अपने operating system के लिए सही package डाउनलोड करें।
2. वह local project चुनें या बनाएँ जिसमें agent काम करेगा।
3. उपलब्ध provider या CLI runtime जोड़ें; समर्थन होने पर model और effort चुनें।
4. mission लिखें। काम के दौरान Nolane plan, operation state, approval boundary और recovery path दिखाता रहता है।

## Desktop delivery और updates

हर release पूरी तरह GitHub Actions से package होती है। `v0.0.1` में Windows installer, macOS DMG/ZIP, Linux AppImage/DEB, update metadata, SHA-256 checksums और provenance attestation हैं।

नई GitHub Release मिलने पर application **Download update** और फिर **Update and restart** दिखाता है। Update अपने-आप install नहीं होते; चल रही mission restart को तब तक रोकेगी जब तक वह सुरक्षित न हो। NSIS Windows installation को in place बदलता है और application data directory सुरक्षित रखता है।

Artifacts अभी code-signed नहीं हैं: Windows पर **Unknown Publisher** दिख सकता है और macOS Gatekeeper को खोलने के लिए स्पष्ट पुष्टि की ज़रूरत हो सकती है। यह खुलकर बताया गया सीमा-क्षेत्र है, छिपाया हुआ दोष नहीं।

## ईमानदार scope

Nolane Agent बताई गई क्षमताओं के लिए source, tests और CI evidence रखता है, लेकिन हर बाहरी environment को पहले से सिद्ध होने का दावा नहीं करता। वास्तविक provider credentials, स्वतंत्र accessibility, हर hardware/platform journey और public-release replay की अपनी evidence requirements हैं।

## Release दस्तावेज़

- [Release notes](docs/RELEASE-0.0.1.md)
- [ज्ञात सीमाएँ](docs/LIMITATIONS-0.0.1.md)
- [Verification scope](docs/VERIFICATION-REPORT-0.0.1.md)
- [Remaining gaps](docs/REMAINING-GAPS-0.0.1.md)

`docs/`, `docs/checkpoints/`, `requirements/` और `evidence/` में मौजूद checkpoint, beta, audit और forensic सामग्री historical provenance है, वर्तमान उत्पाद branding नहीं।
