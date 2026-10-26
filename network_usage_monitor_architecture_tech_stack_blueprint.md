# Modern PC Network Usage Monitor — Architecture & Tech Stack Blueprint

## 1. Project Overview & Core Goals
The goal is to build a lightweight, modern desktop application for Windows that runs quietly in the background and monitors **100% of device network traffic**. 

### Key Requirements:
* **Real-Time Monitoring:** Live upload and download speeds ($MB/s$ or $KB/s$) for the whole PC and broken down per application.
* **OS & System Service Tracking:** Track not just standard apps (Chrome, Discord, Steam), but also Windows system processes (`System`, `svchost.exe`, Windows Update, Background Intelligent Transfer Service).
* **45-Day Historical Analytics:** Save traffic history locally for 45 days to provide visual analytics (daily/weekly/monthly charts, top data-consuming apps, peak usage hours) without slowing down the PC.
* **Simple, Modern UI:** Clean dark-mode dashboard with smooth live graphs and a lightweight system tray mini-widget.

---

## 2. Best Existing Apps to Study (Inspiration & Open-Source References)
Before building from scratch, studying existing tools in this space helps clarify both the **UI design** and the **underlying Windows networking code**:

| Application | Type | Tech Stack | Why Study It? |
| :--- | :--- | :--- | :--- |
| **GlassWire** | Commercial | C++ / Qt | The gold standard for UI/UX. Great inspiration for how to display live graphs and per-app usage cleanly. |
| **Portmaster** | Open-Source | Go (Backend) + Web UI | The most popular open-source GlassWire alternative. Great reference for modern UI and system-level Windows monitoring. |
| **Fort Firewall** | Open-Source | C++ / Qt + WFP Driver | Ultra-lightweight Windows app that tracks per-app bandwidth and stores historical usage statistics in SQLite. |
| **Sniffnet** | Open-Source | Rust (`iced` GUI + `pcap`) | Cross-platform, modern, open-source network monitor built entirely in Rust. |
| **NetSpeedTray** | Open-Source | Python / Win32 | Great reference for building a clean Windows 11 taskbar/tray speed overlay and history monitor. |

---

## 3. How to Capture Per-App Network Traffic on Windows
Standard network counters only tell you the **total** bandwidth of your Wi-Fi or Ethernet card. To know *which app* used *which megabyte*, Windows offers three technical approaches. 

### Approach A: Event Tracing for Windows (ETW) — **HIGHLY RECOMMENDED**
Windows has a built-in kernel logger called **ETW** (`Microsoft-Windows-Kernel-Network`). This is the exact mechanism Windows **Task Manager** and **Resource Monitor (`resmon.exe`)** use.
* **How it works:** Your app subscribes to kernel TCP/IP send and receive events. Every time any app or Windows service sends or receives data, Windows emits an event containing `[Process ID (PID), Bytes Sent/Received, Source IP, Destination IP, Protocol]`.
* **Pros:** 
  * Requires **no custom drivers** or third-party installations (only Administrator privileges).
  * Extremely low CPU and RAM usage even on $1\text{ Gbps}+$ fiber connections.
  * Captures Windows internal traffic (`PID 4` / `System` and `svchost.exe` services) accurately.

### Approach B: WinDivert / Windows Filtering Platform (WFP)
* **How it works:** Uses a signed kernel driver (like the open-source `WinDivert` library) to intercept network packets directly at the Windows network stack level.
* **Pros:** Allows you to **block** an app from accessing the internet (Firewall functionality) or **limit** its speed.
* **Cons:** Slightly heavier than ETW if you only want monitoring and analytics.

### Approach C: Npcap (Packet Sniffing) + IP Helper API
* **How it works:** Captures raw packets using `Npcap` (like Wireshark) and matches port numbers to applications using Windows `GetExtendedTcpTable`.
* **Cons:** **Not recommended** for a 24/7 background app—it uses too much CPU during heavy downloads and requires users to install Npcap separately.

---

## 4. Best Tech Stack Options (Language & Platform)

Because this app must run **24/7 in the background** for 45 days at a time, you should avoid heavy frameworks like Electron (which uses $200\text{ MB}-400\text{ MB}$ of RAM just sitting idle). Below are the **top two modern choices**:

### Option 1: C# (.NET 8 / .NET 9) + WPF-UI or WinUI 3 *(Best All-Around for Windows)*
C# is deeply integrated with Windows and has an official Microsoft library (`Microsoft.Diagnostics.Tracing.TraceEvent`) that makes reading per-app network data via ETW remarkably simple.

* **Backend Language:** C# (.NET)
* **Network Capture Library:** `Microsoft.Diagnostics.Tracing.TraceEvent` (NuGet package)
* **UI Framework:** 
  * **WPF with `WPF-UI` library:** Gives you instant Windows 11 Fluent Design (Mica/Acrylic transparency, modern dark mode, rounded corners, navigation sidebar).
  * **Charts Library:** `LiveCharts2` (supports high-FPS real-time scrolling graphs and bar/pie charts for 45-day analytics).
* **Database:** `SQLite` (via `Microsoft.Data.Sqlite` or `Dapper`).
* **Why pick this?** Fastest development time, rock-solid Windows API access, native look and feel, and low resource usage ($\sim 30\text{ MB}$ RAM in background).

---

### Option 2: Tauri v2 (Rust Backend + React & Tailwind CSS Frontend) *(Best for Custom Web-Style UI)*
If you already know web development (HTML/CSS/JS/React) and want full creative freedom over the UI without Electron's bloat, **Tauri** is the best choice.

* **Backend Language:** **Rust** (runs the 24/7 background monitoring service using less than $15\text{ MB}$ of RAM).
* **Network Capture Library:** `ferrisetw` (Rust crate for Windows ETW) + `sysinfo` crate (to map PIDs to app names and icons).
* **Frontend UI:** **React (or Vue/Svelte) + Tailwind CSS + Shadcn UI**.
* **Charts Library:** `Recharts` or `Apache ECharts` (for rich, interactive 45-day analytics dashboards).
* **Database:** `SQLite` (via `rusqlite` or `sqlx`).
* **Why pick this?** Unbeatable memory efficiency when minimized to the system tray, paired with the easiest way to build a sleek, modern dashboard UI.

---

## 5. How to Store 45 Days of Data Without Filling the Hard Drive

If your app logs every single network packet to a database for 45 days, the database file will quickly grow to $50\text{ GB}+$ and slow down queries. Instead, use **Time-Series Aggregation (Bucketing)** in **SQLite**:

### The 3-Tier Data Pipeline:
1. **Tier 1: In-Memory Live Buffer ($1\text{-second}$ resolution)**
   * Kept in RAM only.
   * Tracks bytes sent/received per Process ID (PID) every second.
   * Powers the **Real-Time Live Graph** and active app list.
2. **Tier 2: Hourly Granular Storage (Saved to SQLite every 60 seconds)**
   * Every minute, the app adds the accumulated bytes into an `hourly_traffic` table in SQLite.
   * Keeps hourly breakdowns for the last **7 to 45 days** so you can see *what time of day* an app used your internet.
3. **Tier 3: Daily Summary Storage (45-Day Rollup)**
   * Stores one row per app per day: `[Date, App_ID, Total_Bytes_Sent, Total_Bytes_Received]`.
   * Even if you use 200 different apps over 45 days, that is at most $200 \times 45 = 9,000\text{ rows}$—meaning your SQLite database will stay **under $5\text{ MB}$**!

### SQLite Database Schema Design:
```sql
-- 1. Stores unique applications and Windows services discovered
CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exe_name TEXT NOT NULL,           -- e.g., "chrome.exe", "svchost.exe", "System"
    exe_path TEXT UNIQUE NOT NULL,    -- Full path to distinguish apps with same name
    display_name TEXT,                -- e.g., "Google Chrome", "Windows System"
    icon_base64 TEXT,                 -- Cached app icon for UI display
    is_system_Component BOOLEAN DEFAULT 0,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stores hourly usage per app (Kept for 45 days)
CREATE TABLE hourly_usage (
    app_id INTEGER NOT NULL,
    hour_timestamp DATETIME NOT NULL, -- Normalized to start of hour: '2026-10-26 14:00:00'
    bytes_received INTEGER DEFAULT 0,
    bytes_sent INTEGER DEFAULT 0,
    PRIMARY KEY (app_id, hour_timestamp),
    FOREIGN KEY (app_id) REFERENCES applications(id)
);

-- 3. Stores daily totals per app (Fast queries for 45-day analytics charts)
CREATE TABLE daily_usage (
    app_id INTEGER NOT NULL,
    usage_date DATE NOT NULL,         -- e.g., '2026-10-26'
    bytes_received INTEGER DEFAULT 0,
    bytes_sent INTEGER DEFAULT 0,
    PRIMARY KEY (app_id, usage_date),
    FOREIGN KEY (app_id) REFERENCES applications(id)
);
```

### Automatic 45-Day Cleanup Query (Runs Once a Day):
```sql
DELETE FROM hourly_usage WHERE hour_timestamp < datetime('now', '-45 days');
DELETE FROM daily_usage WHERE usage_date < date('now', '-45 days');
```

---

## 6. Core Logic Example: Capturing Per-App Traffic in C# (ETW)

To show how approachable this is in **C#**, below is the core logic using `Microsoft.Diagnostics.Tracing.TraceEvent` to capture every byte sent or received by every app and Windows service in real time:

```csharp
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.Diagnostics.Tracing.Parsers;
using Microsoft.Diagnostics.Tracing.Session;

public class NetworkMonitorService
{
    public class AppTraffic
    {
        public int ProcessId { get; set; }
        public string ProcessName { get; set; } = "";
        public long BytesSent { get; set; }
        public long BytesReceived { get; set; }
    }

    // Thread-safe dictionary holding live traffic per Process ID
    public ConcurrentDictionary<int, AppTraffic> LiveTraffic = new();
    private TraceEventSession? _etwSession;

    public void StartMonitoring()
    {
        // Requires running app as Administrator
        _etwSession = new TraceEventSession("MyModernNetworkMonitorSession");
        _etwSession.StopOnDispose = true;

        // Enable Windows Kernel Network Provider (TCP/IP & UDP)
        _etwSession.EnableKernelProvider(KernelTraceEventParser.Keywords.NetworkTCPIP);

        // Subscribe to Receive Events (Download)
        _etwSession.Source.Kernel.TcpIpRecv += data =>
        {
            UpdateTraffic(data.ProcessID, data.ProcessName, 0, data.size);
        };
        _etwSession.Source.Kernel.UdpIpRecv += data =>
        {
            UpdateTraffic(data.ProcessID, data.ProcessName, 0, data.size);
        };

        // Subscribe to Send Events (Upload)
        _etwSession.Source.Kernel.TcpIpSend += data =>
        {
            UpdateTraffic(data.ProcessID, data.ProcessName, data.size, 0);
        };
        _etwSession.Source.Kernel.UdpIpSend += data =>
        {
            UpdateTraffic(data.ProcessID, data.ProcessName, data.size, 0);
        };

        // Start listening on a background thread
        _etwSession.Source.Process();
    }

    private void UpdateTraffic(int pid, string processName, int sent, int received)
    {
        LiveTraffic.AddOrUpdate(pid,
            _ => new AppTraffic
            {
                ProcessId = pid,
                ProcessName = string.IsNullOrEmpty(processName) ? ResolveProcessName(pid) : processName,
                BytesSent = sent,
                BytesReceived = received
            },
            (_, existing) =>
            {
                existing.BytesSent += sent;
                existing.BytesReceived += received;
                return existing;
            });
    }

    private string ResolveProcessName(int pid)
    {
        if (pid == 4 || pid == 0) return "Windows System / OS Kernel";
        try { return Process.GetProcessById(pid).ProcessName; }
        catch { return $"Unknown Process ({pid})"; }
    }
}
```

---

## 7. Modern UI Design Layout (Screens to Build)

To keep the UI **simple and modern**, structure the app into **3 main views** plus a **System Tray Mini-Overlay**:

### View 1: Live Monitor (Real-Time Dashboard)
* **Top Cards:**
  * Current Download Speed (e.g., $14.2\text{ MB/s}$) + Today's Total Download.
  * Current Upload Speed (e.g., $1.8\text{ MB/s}$) + Today's Total Upload.
  * Active Apps Count (e.g., `12 apps currently using network`).
* **Center Live Graph:** Smooth 60-second scrolling area chart (Download in Cyan/Blue, Upload in Purple/Emerald).
* **Bottom Active Process Table:**
  * Columns: `App Icon + Name` | `Category (App vs Windows OS)` | `Live Down Speed` | `Live Up Speed` | `Session Total MB`.

### View 2: 45-Day Analytics & History
* **Time Filter Pills:** `Today` | `Last 7 Days` | `Last 30 Days` | `Full 45 Days`.
* **Daily Usage Bar Chart:** Interactive bar chart showing each day's total GB/MB used over the 45-day window. Clicking a day filters the app list below to that specific date.
* **User Apps vs. Windows OS Donut Chart:** Visual breakdown showing how much data was consumed by your apps vs. Windows Update & background system services.
* **Top Data Consumers Leaderboard:** Ranked list of apps with progress bars showing their percentage of total 45-day bandwidth (e.g., `1. Chrome (142.5 GB - 48%)`, `2. Steam (85.0 GB - 29%)`, `3. Windows System (18.2 GB - 6%)`).

### View 3: Data Caps & Alerts (Optional Bonus Feature)
* Set a monthly or 45-day data limit (e.g., $500\text{ GB}$).
* Get a Windows notification if total usage reaches $80\%$ or if a background app suddenly spikes in usage.

---

## 8. Step-by-Step Roadmap to Build It

1. **Phase 1: Choose Your Stack**
   * Choose **C# (.NET 8 + WPF-UI)** if you want the fastest path to a native Windows app.
   * Choose **Tauri (Rust + React/Tailwind)** if you prefer designing UIs with HTML/CSS/React.
2. **Phase 2: Build the Background Collector**
   * Implement the ETW listener to log per-process bytes in real time and verify that total speeds match Windows Task Manager.
3. **Phase 3: Add SQLite Persistence**
   * Create a timer that flushes the in-memory traffic dictionary to `SQLite` every 60 seconds using SQL `ON CONFLICT DO UPDATE` (Upsert) and runs the 45-day cleanup query on startup.
4. **Phase 4: Connect the Modern UI**
   * Build the Live Dashboard view (1-second refresh timer) and the 45-Day Analytics view (queries the `daily_usage` and `hourly_usage` tables).
