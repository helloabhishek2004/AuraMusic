# AuraMusic 🎵

A cinematic Android-first music experience built with React Native (Expo SDK 55), React Native Track Player / Media3, and FastAPI backend.

---

## 📋 Prerequisites

- **Node.js**: >= 18
- **Python**: >= 3.10
- **Android SDK / ADB** (configured on system PATH)
- Connected Android device (with USB debugging enabled) or Android Emulator

---

## 🚀 Quick Start Guide

### 1. Install Dependencies

Install frontend dependencies (patches will apply automatically via `patch-package`):
```bash
npm install
```

Install backend dependencies (using the virtual environment):
```bash
# Windows
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# macOS / Linux
./backend/venv/bin/pip install -r backend/requirements.txt
```

---

### 2. Start the FastAPI Backend Server

Run the backend on port `8000`:

```bash
# Windows
.\backend\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend

# macOS / Linux
./backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend
```

---

### 3. Configure ADB Port Forwarding (For Connected Android Devices)

Forward ports so your connected device can reach both Metro (`8081`) and the backend (`8000`):

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000
```

---

### 4. Build & Run the Android App

Because AuraMusic uses native modules (`@rntp/player` / Media3), run the custom development build:

#### Option A: Run directly via Expo CLI
```bash
npx expo run:android
```

#### Option B: Build with Gradle & Start Metro
1. Build & install the debug APK:
   ```bash
   cd android
   .\gradlew installDebug
   cd ..
   ```
2. Start the Metro bundler:
   ```bash
   npx expo start
   ```
3. Launch the app on your device:
   ```bash
   adb shell am start -n com.anonymous.AuraMusic/.MainActivity
   ```

---

## 🛠 Useful Commands & Troubleshooting

- **Apply Patches manually**:
  ```bash
  npx patch-package
  ```
- **Clear Metro Cache**:
  ```bash
  npx expo start -c
  ```
- **Check Connected Devices**:
  ```bash
  adb devices
  ```

