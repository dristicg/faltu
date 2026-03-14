# PresencePulse 📱

> **Detect. Reflect. Reconnect.**

PresencePulse is a React Native Android app that detects **unconscious phone habits** — those tiny 5-second screen pickups you don't even realize you're doing. Instead of just tracking total screen time, it tracks **behavior**, classifies interactions as **micro-checks**, calculates a real-time **Presence Score**, and coaches you toward healthier digital habits.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Guide (Step by Step)](#setup-guide-step-by-step)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Node.js](#2-install-nodejs)
  - [3. Install JDK 17](#3-install-jdk-17)
  - [4. Install Android Studio & SDK](#4-install-android-studio--sdk)
  - [5. Set Environment Variables](#5-set-environment-variables)
  - [6. Install Project Dependencies](#6-install-project-dependencies)
  - [7. Start Metro Bundler](#7-start-metro-bundler)
  - [8. Build & Run on Device](#8-build--run-on-device)
- [Phone Setup After Installation](#phone-setup-after-installation)
  - [Grant Usage Access Permission](#grant-usage-access-permission)
  - [Grant Bluetooth Permissions](#grant-bluetooth-permissions)
  - [Keep the App Running](#keep-the-app-running)
- [All Implemented Phases](#all-implemented-phases)
  - [Phase 1 — Real Phone Interaction Tracking](#phase-1--real-phone-interaction-tracking)
  - [Phase 2 — Behavioral Data Persistence (SQLite)](#phase-2--behavioral-data-persistence-sqlite)
  - [Phase 3 — Bluetooth Social Context Detection](#phase-3--bluetooth-social-context-detection)
  - [Phase 4 — AI Coaching Insights](#phase-4--ai-coaching-insights)
  - [Phase 5 — Attention Timeline Visualization](#phase-5--attention-timeline-visualization)
  - [Phase 6 — Intervention & Nudge Engine](#phase-6--intervention--nudge-engine)
  - [Phase 7 — Behavioral Pattern Intelligence](#phase-7--behavioral-pattern-intelligence)
- [App Screens Overview](#app-screens-overview)
- [Database Schema](#database-schema)
- [Working with Native Code](#working-with-native-code)
- [Troubleshooting](#troubleshooting)

---

## How It Works

```
Phone interactions tracked via Android UsageStats API
        ↓
Raw events parsed into sessions by the Behavior Engine
        ↓
Sessions classified (micro-check / normal / burst)
        ↓
Data persisted in local SQLite database
        ↓
Bluetooth detects social context (phubbing risk)
        ↓
AI generates personalized coaching insights
        ↓
Nudge engine intervenes on drift bursts
        ↓
Pattern analysis reveals weekly trends & vulnerable hours
        ↓
Visual dashboard: heatmap, timeline, insights
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.84.0 |
| **Language (JS)** | TypeScript / JavaScript |
| **Language (Native)** | Java (Android native modules) |
| **Runtime** | React 19.2.3, Hermes Engine |
| **Database** | SQLite via `react-native-sqlite-storage` |
| **AI/LLM** | Axios HTTP calls to external LLM API |
| **Bluetooth** | Android BLE (Bluetooth Low Energy) |
| **Build** | Gradle, Metro Bundler |
| **Min Node** | v22.11.0+ |
| **JDK** | JDK 17 (Eclipse Adoptium recommended) |
| **Target Android** | API 34+ (Android 14) |

---

## Project Structure

```
PresencePulse/
├── App.tsx                         # Main app — all screens, navigation, state
├── index.js                        # React Native entry point
├── package.json                    # Dependencies & scripts
├── setup.md                        # This file
│
├── src/
│   ├── components/
│   │   ├── ReflectionModal.js      # Tier 2 nudge: reflection prompt modal
│   │   └── WeeklyHeatmap.js        # Phase 7: 7-day presence heatmap grid
│   │
│   ├── constants/
│   │   └── apiKeys.js              # API keys for LLM service
│   │
│   ├── database/
│   │   └── databaseService.js      # SQLite DB init, CRUD, pattern queries
│   │
│   ├── engine/
│   │   ├── nudgeEngine.js          # Drift burst → nudge tier escalation
│   │   └── patternAnalyzer.js      # Phubbing trigger & vulnerable hour analysis
│   │
│   ├── screens/
│   │   ├── ReconnectScreen.js      # Tier 3 nudge: guided reconnection activity
│   │   └── TimelineScreen.js       # Vertical attention timeline for the day
│   │
│   └── services/
│       ├── aiInsightService.js     # Orchestrates AI insight generation
│       ├── bluetoothProximityService.js  # BLE social context detection
│       ├── bluetoothService.js     # Low-level Bluetooth scanning
│       ├── contextEngine.js        # Core behavior engine (sessions, scoring)
│       ├── llmService.js           # HTTP calls to LLM API
│       ├── nudgeEngine.js          # Nudge state management (service layer)
│       └── usageTrackingService.js # Bridge to Android UsageStats native module
│
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml     # Permissions (UsageStats, Bluetooth, etc.)
│       └── java/com/presencepulse/
│           ├── UsageStatsModule.java   # Native: reads Android UsageStats events
│           └── UsageStatsPackage.java  # Native: registers the module with RN
│
└── scripts/
    └── patch-sqlite.js             # Post-install patch for SQLite compatibility
```

---

## Prerequisites

You need the following installed on your computer **before** starting setup:

| Tool | Version | Download Link |
|---|---|---|
| **Node.js** | v22.11.0 or higher | [nodejs.org](https://nodejs.org/) |
| **JDK** | JDK 17 | [adoptium.net](https://adoptium.net/) |
| **Android Studio** | Latest stable | [developer.android.com](https://developer.android.com/studio) |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com/) |

You also need one of:
- A **physical Android phone** (recommended) connected via USB with **Developer Mode** and **USB Debugging** enabled
- An **Android Emulator** created inside Android Studio (API 34+)

---

## Setup Guide (Step by Step)

### 1. Clone the Repository

Open a terminal (Command Prompt, PowerShell, or Git Bash on Windows):

```bash
git clone <your-repo-url>
cd PresencePulse/PresencePulse
```

> **Note:** The project lives inside a nested `PresencePulse/PresencePulse` folder. Make sure you `cd` into the inner directory where `package.json` is located.

---

### 2. Install Node.js

1. Download Node.js **v22.11.0 or newer** from [nodejs.org](https://nodejs.org/).
2. Run the installer — accept all defaults.
3. Verify installation:

```bash
node --version
# Should print v22.11.0 or higher

npm --version
# Should print 10.x or higher
```

---

### 3. Install JDK 17

React Native for Android requires JDK 17 to compile.

1. Download **Eclipse Adoptium JDK 17** (Temurin) from [adoptium.net](https://adoptium.net/).
2. Run the installer — during installation, check the option to **set JAVA_HOME automatically**.
3. Verify:

```bash
java -version
# Should print: openjdk version "17.x.x"
```

If `JAVA_HOME` was not set automatically, set it manually:

**Windows (PowerShell as Admin):**
```powershell
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot", "Machine")
```

---

### 4. Install Android Studio & SDK

1. Download **Android Studio** from [developer.android.com/studio](https://developer.android.com/studio).
2. Run the installer — accept all defaults.
3. On first launch, Android Studio will download the default SDK. Let it complete.
4. Open **Tools → SDK Manager** inside Android Studio:
   - Under **SDK Platforms** tab: make sure **Android 14 (API 34)** is checked and installed.
   - Under **SDK Tools** tab: make sure these are installed:
     - Android SDK Build-Tools
     - Android SDK Command-line Tools
     - Android SDK Platform-Tools
     - Android Emulator (if using emulator)

---

### 5. Set Environment Variables

React Native needs `ANDROID_HOME` to find the SDK.

**Windows:**

1. Open **System Properties → Environment Variables** (search "environment variables" in Start).
2. Under **System Variables**, click **New**:
   - Variable name: `ANDROID_HOME`
   - Variable value: `C:\Users\<YOUR_USERNAME>\AppData\Local\Android\Sdk`
3. Edit the **Path** variable and add these two entries:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`
4. Click OK to save.

**Verify:**
```bash
adb --version
# Should print "Android Debug Bridge version 1.x.x"
```

---

### 6. Install Project Dependencies

Navigate to the project directory and install all npm dependencies:

```bash
cd PresencePulse/PresencePulse
npm install
```

This will:
- Install all packages listed in `package.json`
- Automatically run the `postinstall` script (`scripts/patch-sqlite.js`) to patch the SQLite library for compatibility

> **If you see errors**, try deleting `node_modules` and `package-lock.json`, then run `npm install` again.

---

### 7. Start Metro Bundler

Metro is the JavaScript bundler for React Native. **Keep this running in its own terminal:**

```bash
npx react-native start
```

You should see the Metro bundler UI showing "Welcome to Metro". Leave this terminal **open and running**.

---

### 8. Build & Run on Device

Open a **second terminal** window (keep Metro running in the first one).

**Connect your Android phone via USB** or **start an Android emulator** from Android Studio.

Verify your device is detected:
```bash
adb devices
# Should list your device, e.g.:
# RF8N30XXXXX    device
```

Build and install the app:
```bash
npx react-native run-android
```

This will:

1. Compile all Java native code (including `UsageStatsModule`)
2. Bundle the JavaScript code
3. Build the debug APK
4. Install it on your connected device
5. Launch the app automatically

> **First build takes 3–8 minutes.** Subsequent builds are faster due to caching.

---

## Phone Setup After Installation

After the app is installed and running on your phone, you **must** configure these permissions for it to work properly.

### Grant Usage Access Permission

This is the **most important step**. Without it, the app cannot track any phone usage.

1. Open the **PresencePulse** app on your phone.
2. Tap the **Settings** button (top-right corner on the Home screen).
3. Tap **App Usage Permission** — this will open Android Settings.
4. Find **PresencePulse** in the list of apps.
5. Toggle the switch to **Allow usage tracking**.

**Alternative manual path:**
> Android Settings → Apps → Special app access → Usage access → PresencePulse → Allow

> ⚠️ **Without this permission:** The app will open normally but will show 0 micro-checks and 0 burst events because it cannot read any usage data. The app will not crash — it safely handles missing permissions.

---

### Grant Bluetooth Permissions

For the social context detection feature (detecting when you're around other people):

1. When the app asks for Bluetooth permissions, tap **Allow**.
2. If prompted for **Location** permission (needed for BLE scanning on Android), tap **Allow** or **While using the app**.

**Manual path if you accidentally denied:**
> Android Settings → Apps → PresencePulse → Permissions → Nearby devices → Allow

> **Note:** Bluetooth permissions are optional. Without them, the app still works fully — it just won't detect "phubbing" (phone use in social settings).

---

### Keep the App Running

For continuous tracking:

1. **Do NOT force-stop the app** from the app switcher. Just press the home button to minimize it.
2. Some Android phones aggressively kill background apps. If tracking stops:
   - Go to Android Settings → Apps → PresencePulse → Battery → Set to **Unrestricted**.
   - On Samsung: Settings → Battery → Background usage limits → Remove PresencePulse from sleeping/deep sleeping apps.
   - On Xiaomi: Settings → Apps → PresencePulse → Battery Saver → No restrictions.

---

## All Implemented Phases

### Phase 1 — Real Phone Interaction Tracking

**Goal:** Track exactly when apps are opened and closed on the phone.

| Component | File | Role |
|---|---|---|
| Native Module | `UsageStatsModule.java` | Reads Android's `UsageStatsManager` API |
| Native Package | `UsageStatsPackage.java` | Registers native module with React Native |
| JS Service | `usageTrackingService.js` | Bridge function `getRecentUsageEvents()` |
| Behavior Engine | `contextEngine.js` | Parses events → sessions, detects micro-checks |

**How it works:**
- A polling loop in `App.tsx` runs every **5 seconds**, pulling recent usage events from Android.
- The behavior engine matches foreground/background events and calculates session durations.
- Sessions under **20 seconds** are classified as **micro-checks**.
- Multiple micro-checks within 10 minutes trigger an **Attention Drift Burst**.
- The **Presence Score** (0–100%) decreases with each micro-check and burst.

---

### Phase 2 — Behavioral Data Persistence (SQLite)

**Goal:** Store all behavioral data locally so nothing is lost when the app restarts.

| Component | File | Role |
|---|---|---|
| Database Service | `databaseService.js` | SQLite init, CRUD operations |

**What it stores:**
- Every session (app name, start/end time, duration, type)
- Daily aggregated metrics (micro-check count, burst count, presence score)
- Auto-restores state from database on app launch
- Auto-deletes session data older than 30 days

---

### Phase 3 — Bluetooth Social Context Detection

**Goal:** Detect when the user is around other people to identify "phubbing" (phone use in social settings).

| Component | File | Role |
|---|---|---|
| BLE Scanner | `bluetoothService.js` | Low-level Bluetooth LE scanning |
| Proximity Service | `bluetoothProximityService.js` | Detects nearby devices → social context flag |

**How it works:**
- Scans for nearby Bluetooth devices every 60 seconds.
- If devices are detected, sets a `socialContext` flag.
- Micro-checks during social context are flagged as **phubbing** behavior.
- Phubbing events carry heavier penalties on the Presence Score.

---

### Phase 4 — AI Coaching Insights

**Goal:** Generate personalized daily coaching tips based on the user's behavior.

| Component | File | Role |
|---|---|---|
| AI Service | `aiInsightService.js` | Orchestrates insight generation |
| LLM Service | `llmService.js` | HTTP calls to external LLM API |
| API Keys | `apiKeys.js` | Stores API credentials |

**How it works:**
- Once per day, the app sends today's metrics + patterns to an LLM API.
- The LLM returns a personalized coaching insight.
- The insight is cached in the `ai_insights` database table (no redundant API calls).
- Displayed on the Insights screen under **"✨ AI Coaching Insight"**.

---

### Phase 5 — Attention Timeline Visualization

**Goal:** Visualize the entire day's phone usage as a vertical timeline.

| Component | File | Role |
|---|---|---|
| Timeline Screen | `TimelineScreen.js` | Vertical scrollable day timeline |

**Features:**
- 24-hour vertical grid with hour labels.
- Color-coded session bars:
  - 🟢 Green = Normal session
  - 🟠 Orange = Micro-check
  - 🔴 Red = Phubbing
  - 🔴 Dark Red = Burst
- Red horizontal line showing current time.
- Tap any bar to see details (app name, duration, context).

---

### Phase 6 — Intervention & Nudge Engine

**Goal:** Actively intervene when the user is drifting into compulsive phone use.

| Component | File | Role |
|---|---|---|
| Nudge Engine | `nudgeEngine.js` | Escalating intervention tiers |
| Reflection Modal | `ReflectionModal.js` | Tier 2: reflection prompt popup |
| Reconnect Screen | `ReconnectScreen.js` | Tier 3: guided reconnection activity |
| Nudge DB Tables | `databaseService.js` | `nudges` and `reflections` tables |

**3-Tier escalation:**

| Tier | Trigger | Action |
|---|---|---|
| **Tier 1** | First drift burst | Haptic vibration feedback |
| **Tier 2** | Continued drift | Reflection modal ("What are you looking for?") |
| **Tier 3** | Severe drift | Full-screen reconnect activity (breathing exercise) |

---

### Phase 7 — Behavioral Pattern Intelligence

**Goal:** Analyze stored data to detect long-term behavioral patterns.

| Component | File | Role |
|---|---|---|
| Pattern Queries | `databaseService.js` | 4 new SQL analysis functions |
| Pattern Analyzer | `patternAnalyzer.js` | Trigger & vulnerable hour analysis |
| Weekly Heatmap | `WeeklyHeatmap.js` | 7-day color-coded presence grid |
| Insights UI | `App.tsx` | Pattern cards in insights view |

**Features:**

| Function | What It Returns |
|---|---|
| `getVulnerableHour()` | The hour of day with the most micro-checks |
| `getTopTriggerApps()` | Top 3 apps causing the most micro-checks |
| `getWeeklyScores()` | Last 7 days of presence scores |
| `getImprovementStreak()` | Consecutive days with score ≥ 70 |

**Heatmap colors:**

| Score Range | Color |
|---|---|
| ≥ 80 | 🟢 Dark green (`#2D9E5F`) |
| ≥ 65 | 🟢 Light green (`#7BC47F`) |
| ≥ 50 | 🟡 Amber (`#FFB347`) |
| ≥ 35 | 🟠 Orange (`#FF7043`) |
| < 35 | 🔴 Red (`#E94560`) |
| No data | ⚪ Grey (`#EEEEEE`) |

---

## App Screens Overview

| Screen | Access | What It Shows |
|---|---|---|
| **Home** | Default screen | Presence Score ring, micro-check/burst counts, Social Mode button |
| **Social Mode** | Tap "Start Social Mode" | Active session tracking indicator |
| **Drift Alert** | Auto-triggered | Warning when drift burst detected |
| **Insights** | Navigation from Home | Weekly heatmap, pattern cards, AI coaching, metrics |
| **Timeline** | From Insights screen | Vertical 24-hour color-coded usage timeline |
| **Reconnect** | Auto-triggered (Tier 3) | Guided breathing exercise & reconnection |
| **Settings** | Tap "Settings" on Home | Usage permission, sensitivity mode (Strict/Normal/Relaxed) |

---

## Database Schema

The app uses a local SQLite database (`PresencePulse.db`) with these tables:

**`sessions`** — Every app usage event
| Column | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| packageName | TEXT | App package name (e.g. `com.instagram.android`) |
| startTime | INTEGER | Epoch milliseconds |
| endTime | INTEGER | Epoch milliseconds |
| duration | INTEGER | Duration in seconds |
| type | TEXT | `micro-check` or `session` |
| socialContext | INTEGER | 1 if Bluetooth detected nearby devices |
| triggerType | TEXT | What triggered the check |
| isPhubbing | INTEGER | 1 if micro-check during social context |
| is_social_context | INTEGER | Social context flag |

**`daily_metrics`** — Aggregated daily scores
| Column | Type | Description |
|---|---|---|
| date | TEXT (PK) | `YYYY-MM-DD` format |
| microChecks | INTEGER | Total micro-checks for the day |
| burstEvents | INTEGER | Total burst events for the day |
| presenceScore | INTEGER | Calculated presence score (0–100) |

**`ai_insights`** — Cached AI coaching tips
| Column | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| date | TEXT (UNIQUE) | `YYYY-MM-DD` format |
| insight_text | TEXT | The AI-generated coaching tip |
| generated_at | TEXT | ISO timestamp of generation |

**`nudges`** — Intervention log
| Column | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| type | TEXT | Nudge type (haptic, reflection, reconnect) |
| timestamp | INTEGER | Epoch milliseconds |
| dismissed | INTEGER | 1 if user dismissed |
| engaged | INTEGER | 1 if user engaged |

**`reflections`** — User reflection responses
| Column | Type | Description |
|---|---|---|
| id | INTEGER (PK) | Auto-increment |
| timestamp | INTEGER | Epoch milliseconds |
| trigger_type | TEXT | What prompted the reflection |
| session_id | TEXT | Related session ID |

---

## Working with Native Code

If you need to edit the Android native Java code:

1. Open **Android Studio**.
2. Select **Open an existing project** → navigate to the `android/` folder.
3. Wait for Gradle sync to complete.
4. Native source files are at:
   ```
   android/app/src/main/java/com/presencepulse/
   ├── UsageStatsModule.java     # Reads usage events from Android
   └── UsageStatsPackage.java    # Registers the module
   ```
5. After editing Java files, rebuild with:
   ```bash
   npx react-native run-android
   ```

---

## Troubleshooting

### "Command `run-android` failed"
- Make sure `ANDROID_HOME` is set correctly.
- Run `adb devices` to verify your device is connected.
- Try `cd android && ./gradlew clean && cd ..` then rebuild.

### App shows 0 micro-checks / no data
- **You forgot to grant Usage Access permission.** See [Grant Usage Access Permission](#grant-usage-access-permission).

### Metro bundler crashes or shows red error screen
- Stop Metro (`Ctrl+C`), delete the cache, and restart:
  ```bash
  npx react-native start --reset-cache
  ```

### Build fails with JDK error
- Ensure JDK 17 is installed and `JAVA_HOME` points to it:
  ```bash
  java -version
  echo %JAVA_HOME%
  ```

### SQLite errors on build
- The `postinstall` script should auto-patch. If not, run manually:
  ```bash
  node scripts/patch-sqlite.js
  ```

### Phone kills the app in the background
- Disable battery optimization for PresencePulse (see [Keep the App Running](#keep-the-app-running)).

---

*Built with ❤️ for intentional digital wellbeing.*
