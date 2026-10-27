<img width="2048" height="1332" alt="861905095_1135255525638784_5100116039852121752_n" src="https://github.com/user-attachments/assets/6684ef1f-160c-49e9-8a50-330668a16d47" />

# Wuwa Tappo Global · macOS

[English](#english) · [ภาษาไทย](#ภาษาไทย)

## English

Wuwa Tappo Global is a community-maintained macOS adaptation of the official
Global Wuwa Tappo client. It keeps the official Global frontend and services,
while replacing the Windows-only native layer with Rust + Tauri. It does not
require Windows, Wine, or a virtual machine.

This is an unofficial project and is not affiliated with Kuro Games. Official
client assets, names, trademarks, accounts, and services remain the property
of their respective owners.

### Download and use

Download the latest `.dmg` from [Releases](https://github.com/nucrasenaa/wuwa-tappo-mac/releases/latest), then drag **Wuwa Tappo Global Mac.app** into `/Applications`. A `.zip` build is also available.

- Apple Silicon (M-series), macOS 13 or later.
- The app includes the Global frontend and embedded runtime assets.
- Internet access is required for login, updates, and online features.
- The current build is ad-hoc/development signed and is not notarized. If macOS blocks the first launch, approve it in **System Settings → Privacy & Security**.
- Enable **Input Monitoring** for `/Applications/Wuwa Tappo Global Mac.app` so global keyboard and mouse tracking can work.
- Global login uses the official browser OAuth flow and the `wuwa-buddy://` callback.

The app's own macOS build version is `1.0.0`; the embedded official Global
Windows resources are pinned to `1.0.1`.

### Build from source

Requirements: macOS, Xcode Command Line Tools, Node.js 24, `rustup`, and
7-Zip.

```bash
xcode-select --install
brew install node@24 sevenzip
export PATH="$(brew --prefix node@24)/bin:$PATH"
git clone https://github.com/nucrasenaa/wuwa-tappo-mac.git
cd wuwa-tappo-mac
npm ci
npm run setup
npm test
npm run test:rust
npm run build
npm run package
```

`npm run setup` validates and extracts the pinned official Global installer
from [`upstream-global.json`](upstream-global.json). It never executes the
Windows installer. To use a local copy instead:

```bash
npm run assets:sync -- --region global --installer "$HOME/Downloads/WuwaTappo-global_1.0.1_x64-setup.exe"
npm run icons
npm run prepare:frontend
```

The app bundle is written to
`src-tauri/target/release/bundle/macos/`; ZIP and DMG packages are written to
`dist/`. Generated frontend resources and local build caches are not tracked.

### Verification

```bash
npm test
npm run test:rust
node scripts/network-smoke.mjs
```

The network smoke test checks the public Global configuration, asset indexes,
version manifest, CORS behavior, and the public SDK source. It does not perform
an authenticated login or use a personal account.

### Privacy and license

The application does not include maintainer credentials, account sessions,
keychain contents, click history, or logs. Input monitoring is used only for
keyboard/mouse interaction and click counting; typed text is not recorded.

The original macOS backend and adaptation tools are licensed under [MIT](LICENSE).
Official client assets and third-party dependencies retain their own licenses;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## ภาษาไทย

Wuwa Tappo Global เป็นโปรเจกต์ชุมชนสำหรับนำ Wuwa Tappo Global มาใช้งานบน
macOS โดยคง frontend และบริการ Global ของทางการไว้ และเปลี่ยน native layer
ที่เดิมรองรับเฉพาะ Windows เป็น Rust + Tauri จึงไม่ต้องใช้ Windows, Wine หรือ
virtual machine

โปรเจกต์นี้ไม่ใช่แอปทางการของ Kuro Games ทรัพย์สิน ชื่อ เครื่องหมายการค้า
บัญชีผู้ใช้ และบริการของทางการยังเป็นของเจ้าของสิทธิ์เดิม

### ดาวน์โหลดและใช้งาน

ดาวน์โหลด `.dmg` รุ่นล่าสุดจากหน้า [Releases](https://github.com/nucrasenaa/wuwa-tappo-mac/releases/latest)
แล้วลาก **Wuwa Tappo Global Mac.app** ไปที่ `/Applications` หรือใช้ไฟล์ `.zip`
เพื่อแตกไฟล์ก็ได้

- รองรับ Apple Silicon (ชิปตระกูล M) และ macOS 13 ขึ้นไป
- ภายในแอปมี frontend และ resource ของ Global แล้ว
- ต้องเชื่อมต่ออินเทอร์เน็ตสำหรับการ login, update และฟีเจอร์ออนไลน์
- รุ่นนี้ sign แบบ ad-hoc/development และยังไม่ได้ notarize หาก macOS บล็อกการเปิดครั้งแรก ให้กดยืนยันใน **System Settings → Privacy & Security**
- เพิ่ม `/Applications/Wuwa Tappo Global Mac.app` ใน **Input Monitoring** เพื่อให้ตรวจจับคีย์บอร์ดและเมาส์ทั่วระบบได้
- การ login ของ Global ใช้ browser OAuth ของทางการ และ callback ผ่าน `wuwa-buddy://`

เวอร์ชันของแอป macOS คือ `1.0.0` ส่วน resource ของ official Global Windows
ที่ฝังอยู่ในแอปถูกล็อกไว้ที่ `1.0.1`

### Build จาก source

ต้องมี macOS, Xcode Command Line Tools, Node.js 24, `rustup` และ 7-Zip

```bash
xcode-select --install
brew install node@24 sevenzip
export PATH="$(brew --prefix node@24)/bin:$PATH"
git clone https://github.com/nucrasenaa/wuwa-tappo-mac.git
cd wuwa-tappo-mac
npm ci
npm run setup
npm test
npm run test:rust
npm run build
npm run package
```

`npm run setup` จะตรวจสอบและแตก resource จาก installer Global ที่ระบุใน
[`upstream-global.json`](upstream-global.json) โดยไม่สั่งรัน Windows installer
หากมี installer อยู่ในเครื่องแล้ว สามารถใช้คำสั่งนี้แทนได้:

```bash
npm run assets:sync -- --region global --installer "$HOME/Downloads/WuwaTappo-global_1.0.1_x64-setup.exe"
npm run icons
npm run prepare:frontend
```

ไฟล์แอปจะอยู่ที่ `src-tauri/target/release/bundle/macos/` และไฟล์ ZIP/DMG
จะอยู่ที่ `dist/` โดย frontend ที่สร้างขึ้นและ cache ในเครื่องจะไม่ถูก commit

### การตรวจสอบ

```bash
npm test
npm run test:rust
node scripts/network-smoke.mjs
```

การทดสอบ network จะตรวจสอบ config, asset index, version manifest, CORS และ
public SDK ของ Global เท่านั้น ไม่ได้ login ด้วยบัญชีจริงหรือใช้ข้อมูลส่วนตัว

### ความเป็นส่วนตัวและลิขสิทธิ์

แอปไม่รวม credential ของผู้ดูแล, session, ข้อมูลใน Keychain, ประวัติการคลิก
หรือ log ส่วนตัว การอนุญาต Input Monitoring ใช้สำหรับการโต้ตอบกับคีย์บอร์ดและ
เมาส์ รวมถึงการนับคลิกเท่านั้น และไม่มีการบันทึกข้อความที่พิมพ์

ส่วน macOS backend และเครื่องมือ adaptation ที่เป็นผลงานของ repository นี้ใช้
ใบอนุญาต [MIT](LICENSE) ส่วน asset ของทางการและ dependency ภายนอกยังใช้สิทธิ์
ของแต่ละโครงการ ดูรายละเอียดใน [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
