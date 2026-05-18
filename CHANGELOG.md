# Sthirvaa Farms - Project Release & Version Changelog

This changelog serves as the single source of truth for all versioned releases, feature enhancements, and critical bug fixes in the Sthirvaa Farms project. It logs every Git commit, chronological version increment, and developer descriptions in one file as requested.

---

## 🚀 [v1.2.0] — Staff Directory Overhaul & DB Mappings
> **Release Date:** May 18, 2026  
> **Target Commit:** `bd3b3ab`  
> **Module Status:** Production-Ready & Responsive

### ➕ Added & Refactored
- **Split-Pane Master-Detail Directory:** Replaced separate tabs for operations/management with a sleek, unified desktop side-by-side directory.
- **Dynamic Database Mappings:** Connected directly to backend MySQL columns `employee_id` and `profile_pic`. Unmapped/null IDs gracefully fall back to detailed field views.
- **Strict Layout Heights & Widths:** Shrank the main layout container to `max-w-4xl` and height to `360px`, fitting exactly 5 records before engaging a smooth internal scrollbar.
- **Alphabetical Sorting:** Integrated client-side alphabetical list sorting ordered strictly by `employeeId`.
- **+91 Phone Prefixing:** Prepend India's country code prefix `+91 ` automatically to contact listings.
- **Mobile Swipe UX:** Implemented full viewport toggles for mobile devices. Users start with a listing view, and tapping an employee transitions to a full-screen profile page with a back-button.

---

## 🛠️ [v1.1.5] — Dashboard NPE Fixes & Proxy Bridge
> **Release Date:** May 18, 2026  
> **Target Commit:** `edbd4fd`  
> **Module Status:** Completed

### 🐛 Critical Bug Fixes
- **Dashboard NullPointerExceptions:** Added missing Java stream collection null guards to 6-month financial data and month-to-date income/expense metrics in `DashboardService.java`.
- **Local Dev Windows Address Mismatch:** Updated Next.js rewrites config to route proxy destination explicitly to IPv4 `127.0.0.1:8080` (resolving Windows IPv6 `[::1]` Connection Refused errors).
- **Axios Relative Endpoint Fix:** Corrected the hardcoded cloud URL in `lib/api.ts` to `/api`, ensuring local dev queries correctly route through the Next.js dev server proxy rules.
- **Emblem Refinement:** Integrated a custom dark green theme (`#1B4332`) and vector leaf branding assets.

---

## 🎨 [v1.1.0] — Mobile responsiveness & Modal Cleanup
> **Release Date:** May 5, 2026  
> **Target Commit:** `05a0b5b`  
> **Module Status:** Completed

### ➕ Added & Refactored
- **Form Modal Polish:** Overhauled product form inputs and tenure selections to eliminate overflow scrolling glitches on narrow viewports.
- **Tailwind Version Restructure:** Synchronized postcss/autoprefixer rules with Tailwind stable version 3 configuration.

---

## 📦 [v1.0.0] — Initial Core Release & Sales Engine
> **Release Date:** April 27, 2026  
> **Target Commit:** `74dcaac`  
> **Module Status:** Completed

### ➕ Added
- **Core Architecture:** Setup core multi-module project (Spring Boot back-end and React Next.js front-end).
- **Subscription Engines:** Integrated multi-tenure combo calculator for subscription packages.
