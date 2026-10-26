# Modern PC Network Usage Monitor

<p align="center">
  <img src="public/app-icon.png" width="128" height="128" alt="Network Usage Monitor Icon" />
</p>

<p align="center">
  <strong>A lightweight, modern Windows desktop application that monitors 100% of device network traffic, captures system services, and provides 45-day analytics under 5 MB of local database storage.</strong>
</p>

---

## ⚡ Highlights & Features

* **100% Device Traffic Capture:** Uses Windows Kernel **ETW (Event Tracing for Windows)** to capture every byte sent and received by any application or Windows system service (`System` PID 4, `svchost.exe`, Windows Update, BITS).
* **Ultra-Low Memory Footprint:** Built with **Tauri v2 + Rust**, using only **$\sim 15\text{ MB}$ of RAM** while running quietly in the background (compared to 200–400 MB for Electron monitors).
* **45-Day Historical Analytics:** 3-tier rolling time-series storage engine in **SQLite (WAL mode)** keeping database size **under $5\text{ MB}$** over 45 days.
* **Modern Dark-Mode Dashboard:**
  * **Live Monitor:** 60-second real-time scrolling dual-stream area chart (Download in Cyan, Upload in Emerald), speed stat cards, and active process table with executable icons.
  * **45-Day Analytics:** Interactive daily usage stacked bar chart, OS vs User Apps donut breakdown, and top data consumer leaderboard with expandable 24-hour activity profiles.
  * **Data Caps & Alerts:** Monthly gigabyte quota progress bar with 80% threshold warnings and sudden bandwidth spike detection.
  * **Settings & Storage:** In-depth view of database metrics and storage tier health.
* **Windows System Tray Mini-Widget:** Dynamic tooltip displaying live speeds (`↓ 14.2 MB/s  ↑ 1.8 MB/s`) and right-click context menu.
* **Smart UAC Elevation:** Runs smoothly in standard mode or elevated mode, with a one-click in-app **"Restart as Administrator"** button.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Engine** | **Rust** + **Tauri v2** (`src-tauri`) |
| **Kernel Capture** | **Windows ETW** (`ferrisetw`) + IP Helper API fallback |
| **Storage Engine** | **SQLite** (`rusqlite`) with 3-tier time-series bucketing |
| **Frontend UI** | **React 19** + **TypeScript** + **Vite** |
| **Styling** | **Tailwind CSS** (Obsidian dark theme, glassmorphism) |
| **Charts** | **Apache ECharts** (`echarts-for-react`) |
| **Icons** | **Lucide React** + Win32 GDI icon extractor |

---

## 🚀 Quick Start & Development

### Prerequisites
* Windows 10 / 11
* Node.js (v18+) & npm
* Rust & Cargo (MSVC toolchain)

### 1. Install Dependencies
```powershell
npm.cmd install
```

### 2. Run in Development Mode
```powershell
npm.cmd run tauri dev
```
> **Tip:** Running PowerShell as Administrator allows the ETW kernel monitor to activate immediately. If run normally, you can click the **"Restart as Administrator"** button in the header anytime.

### 3. Run Automated Tests
```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

### 4. Build Production Desktop Release (.exe)
```powershell
npm.cmd run tauri build
```
The compiled standalone executable will be generated at:
`src-tauri/target/release/Network Usage Monitor.exe`

---

## 📁 Project Structure

```
├── src-tauri/                 # Rust Backend Engine
│   ├── src/
│   │   ├── monitor/           # ETW packet capture, buffer, Win32 icon extractor
│   │   ├── db/                # SQLite schema, repository, 60s aggregator worker
│   │   ├── commands/          # Tauri IPC command handlers
│   │   ├── tray.rs            # Windows system tray integration
│   │   ├── lib.rs             # Application coordinator and event tick timer
│   │   └── main.rs            # Tauri Windows subsystem entrypoint
│   ├── icons/                 # Generated app icons (ico, png, icns)
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri v2 window and app configuration
├── src/                       # Frontend Dashboard (React 19 + Tailwind CSS)
│   ├── components/
│   │   ├── layout/            # Sidebar navigation and header
│   │   ├── live/              # Live speed cards, 60s scrolling chart, process table
│   │   ├── analytics/         # Daily bar chart, donut breakdown, leaderboard
│   │   ├── caps/              # Data cap quota card and alert rules
│   │   ├── settings/          # Storage architecture view and admin controls
│   │   └── common/            # Cached Win32 app icon component
│   ├── types/                 # TypeScript interfaces
│   ├── utils/                 # Speed and byte formatters
│   ├── App.tsx                # Main view router and live event subscriber
│   ├── index.css              # Obsidian dark theme and glassmorphism tokens
│   └── main.tsx               # React mount root
├── public/                    # Static assets (app icon)
├── PROJECT_DOCUMENTATION.md   # Complete technical documentation
└── package.json               # NPM configuration
```

---

## 📜 License
MIT License. Built with ❤️ for Windows network transparency.
