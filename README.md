<div align="center">

# 🎓 StudyHub
### Your entire academic life, in one place.

![React Native](https://img.shields.io/badge/React_Native-0.81-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-Hosting%20%7C%20API-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

### 🔗 [Live App](https://study-hub-coral-seven.vercel.app)

Open it in a mobile browser and add it to your home screen — StudyHub installs as a real app (PWA), icon and all.

---

## 📖 About The Project

**StudyHub** is a full student productivity app built for managing everything a student juggles in one place: grades, tasks, a class schedule, study materials, and focused study time.

It runs from a single React Native + Expo codebase across iOS, Android, and the web, and is deployed today as an installable Progressive Web App backed by Firebase.

## ✨ Key Features

* 🔐 **Secure auth** — Firebase Authentication with a custom-branded email verification flow (a Vercel serverless function + Nodemailer), protected by Firebase App Check (reCAPTCHA v3).
* 📊 **Dashboard** — daily overview, upcoming tasks and events, weighted grade average, a credit-progress ring, and a Pomodoro-style study timer.
* 📝 **Grades** — per-course tracking with automatic weighted-average and required-credits progress.
* ✅ **Tasks** — priorities, due dates, file attachments.
* 📅 **Schedule** — day / week / month / year calendar views, recurring events, and a per-event reminder picker.
* 🧠 **Learning tracker** — mark topics per course as known or needing review.
* 📚 **Study library** — Summaries, Glossary, Quiz Bank, Links, and Flashcards, all searchable.
* 🎨 **Personalization** — light/dark themes with custom accent colors and gradients.
* 🔒 **Face ID privacy lock** — an opt-in WebAuthn biometric gate (Face ID / Touch ID / Windows Hello) that locks an already-signed-in session on the same device.

## 💻 Tech Stack

* **App:** React Native, Expo, TypeScript
* **Navigation:** React Navigation
* **Backend:** Firebase (Authentication, Firestore, App Check)
* **Serverless API:** Vercel (Node.js) + firebase-admin + Nodemailer
* **Web:** react-native-web, WebAuthn, Web Notifications API

## 🚀 Getting Started

The [live app](https://study-hub-coral-seven.vercel.app) above needs nothing from you — just open it. The steps below are only for running the source code yourself.

### Prerequisites

* Node.js 18+
* npm
* [Expo Go](https://expo.dev/go) (optional, for testing on a physical device without building)

### Installation & Configuration

> ⚠️ **Security notice:** API keys and service credentials are **not** included in this repository. Configure your own before running the project.

1. Clone the repository:
   ```bash
   git clone https://github.com/OdelyaGil/StudyHub.git
   cd StudyHub
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Connect a Firebase project (the app talks directly to Firebase, so it needs one to run at all — this doesn't have to be a paid or pre-existing project):
   * Create a free project at the [Firebase console](https://console.firebase.google.com), then add a Web app to it.
   * Enable **Authentication** (Email/Password provider) and **Firestore** for the project.
   * Copy `.env.example` to `.env`, then fill in the web app config values Firebase gives you (Project Settings → General → Your apps).

4. *(Optional)* To run the custom email-verification API yourself, set these as environment variables on your own Vercel project:
   * `FIREBASE_SERVICE_ACCOUNT` — a Firebase service account JSON (Project Settings → Service Accounts → Generate new private key), as a single-line string.
   * `GMAIL_USER` / `GMAIL_APP_PASSWORD` — a Gmail account with an [app password](https://myaccount.google.com/apppasswords) for sending mail.
   * `EXPO_PUBLIC_VERCEL_URL` — your deployed app's URL.

5. Run it:
   ```bash
   npx expo start --web    # Web
   npx expo start --ios    # iOS simulator
   npx expo start --android # Android emulator
   npx expo start          # Scan the QR code with Expo Go
   ```

## 📂 Project Structure

```text
StudyHub/
├── App.tsx                    # Root: auth state, Face ID gate, navigation shell
├── DashboardScreen.tsx         # Bottom-tab navigator + custom sidebar wiring
├── LoginScreen.tsx             # Sign in / register / email verification
├── api/
│   └── send-verification.js    # Vercel serverless function (custom verification email)
├── src/
│   ├── screens/                 # Home, Tasks, Grades, Schedule, Profile, Summaries,
│   │                             # Glossary, QuizBank, Links, Flashcards, Chats, Learning...
│   ├── components/               # AppSidebar, SwipeBackEdge, FaceLockGate, ErrorBoundary...
│   ├── context/                  # ThemeContext, TabHistoryContext
│   ├── utils/                    # firestore.ts, notifications.ts, faceLock.ts, helpers.ts
│   ├── hooks/                    # useCustomAlert
│   └── config/                   # firebase.ts
├── public/                      # PWA manifest, icons, service worker
├── firestore.rules
└── storage.rules
```

## 🧠 What We Learned

Turning a client-only app into a real, publicly deployed product surfaced problems that never show up in local development. The Firebase Admin SDK's v14 rewrite dropped its old namespaced API (`admin.apps`, `admin.credential.cert`) for modular functions, which crashed the email-verification function in production in a way `npm install` never warned about. `expo-notifications` turned out to have no web implementation at all — every scheduled reminder was silently failing there, invisible until tested for real, which meant building a browser-native fallback instead.

The most useful lesson was platform honesty: a PWA behaves like an installed app most of the time, but iOS suspends it like any other backgrounded tab, which directly shaped decisions like the Face ID gate re-triggering on every reopen and reminder notifications being scoped to "while the app is alive" rather than promising delivery that the platform can't actually guarantee.

## 👩‍💻 Developed By

<div align="center">

**Odelya Gil**
<br>
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/odelyagil/) [![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/OdelyaGil)

</div>
