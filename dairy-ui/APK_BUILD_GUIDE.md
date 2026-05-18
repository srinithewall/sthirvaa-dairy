# 📱 Sthirvaa Farms Android APK Build Guide

This guide describes how to build, test, and run your **Sthirvaa Farms Portal** as a native Android App (APK) using **Ionic Capacitor**. 

We have already initialized Capacitor and added the native Android platform to your workspace!

---

## 🛠️ Step 1: Choose Your Wrapper Mode

### 🌟 Mode A: Web Wrapper Mode (Recommended)
This mode points the Android app directly to your hosted production web URL (e.g. `https://your-domain.com` or `http://192.168.1.100:9000`).
* **Why it's great:** Any updates you push to the website are **instantly updated** in the Android app without needing to rebuild or reinstall the APK!
* **How to configure:** Open [capacitor.config.ts](file:///c:/SpringBoot/WorkSpace/dairy/dairy-ui/capacitor.config.ts) and add the `server` block pointing to your web server:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sthirvaa.dairy',
  appName: 'Sthirvaa Farms',
  webDir: 'out',
  server: {
    // Replace with your live web app URL or local development server IP
    url: 'http://192.168.1.100:9000', 
    cleartext: true
  }
};

export default config;
```

---

### 📦 Mode B: Offline Static Export Mode
This mode bundles all frontend files directly inside the APK assets so the app runs offline locally without loading a URL.
1. Enable static export in your Next.js config: Open `next.config.ts` (or `next.config.js`) and add `output: 'export'`:
   ```javascript
   const nextConfig = {
     output: 'export',
     // ...
   };
   ```
2. Build and export the frontend:
   ```bash
   npm run build
   ```
3. Sync the compiled static assets into your Android app directory:
   ```bash
   npx cap sync
   ```

---

## 🚀 Step 2: Build the APK File

There are two easy ways to compile your Android project into an `.apk` file:

### Option 1: Using Android Studio (Visual)
1. Open **Android Studio**.
2. Click **Open an Existing Project** and navigate to your `dairy-ui/android` folder.
3. Wait for Gradle to finish indexing.
4. Go to the top menu and select:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. Once completed, a popup will appear at the bottom right. Click **Locate** to find your finished `app-debug.apk` file!

### Option 2: Using Command Line (Fastest)
If you have the Android SDK and Java installed on your machine, you can build the APK instantly using the Gradle Wrapper from your terminal:
1. Open PowerShell / Command Prompt inside the `dairy-ui/android` folder:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
2. Once the build finishes, your freshly compiled APK will be located at:
   `dairy-ui/android/app/build/outputs/apk/debug/app-debug.apk`

---

## ⚡ Step 3: Run the App on Your Phone

1. Transfer the `app-debug.apk` file to your Android phone (via USB, email, Google Drive, or WhatsApp).
2. Tap the APK file on your phone to install it (enable "Install from Unknown Sources" if prompted).
3. Open the **Sthirvaa Farms** app and enjoy a fully-integrated, responsive native experience!

---

## 🔧 Proactive Configurations Added
We have already pre-configured the following to save you from common Android packaging bugs:
* **Internet Permission:** Configured by default to allow standard network requests.
* **HTTP Cleartext Permitted:** Added `android:usesCleartextTraffic="true"` to your [AndroidManifest.xml](file:///c:/SpringBoot/WorkSpace/dairy/dairy-ui/android/app/src/main/AndroidManifest.xml) so the app can connect to standard local servers or cleartext IP addresses (non-HTTPS) without hitting connection errors!
