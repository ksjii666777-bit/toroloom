# 🧑‍⚖️ Toroloom — Advisory Marketplace (Skeleton Plan)

> **Kya hai:** SEBI-registered investment advisors (RIA) aur research analysts (RA)
> ko platform par list karne ka marketplace. Users advisors ko search karke dekhen,
> unke paas consultation/book kar sakte hain, review de sakte hain.
>
> **Status:** ✅ Phase 1 (MVP skeleton) implemented — see checklists below. Sirf
> Razorpay checkout UI pending hai (Phase 1.5).
> **Companion docs:** [`FUTURE.md`](../FUTURE.md) §9.3 (Long-term) · [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md)

---

## 🎯 1. Vision & Scope

Advisory marketplace = Toroloom ka **community + subscription + payments** ka natural
extension. Users ko vishwas hai ki platform par aane wala har advisor **verified +
SEBI-compliant** hai.

| Scope | Detail |
|-------|--------|
| **In (Phase 1 MVP)** | Advisor directory (search/filter), Advisor detail page, Consultation booking (slot + fee), My consultations, Ratings & reviews, Admin approval workflow |
| **Out (Phase 2+)** | Video call (in-app), Chat consultation, Advisor payouts dashboard, SEBI registration auto-verify API, Revenue share billing, Public advisor profiles (web) |

> ⚠️ **Compliance non-negotiable:** India mein advisory = regulated activity.
> Platform par sirf **SEBI RIA/RA registration number wale advisors** hi list honge.
> Har advisor page par registration no. + regulator disclaimer mandatory.
> Legal review before launch zaroori (see §6).

---

## 🗄️ 2. Data Models

`src/types/index.ts` mein add (existing domain types ke pattern par):

```ts
export type AdvisorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type AdvisorType = 'RIA' | 'RA';  // Registered Investment Advisor / Research Analyst

export interface Advisor {
  id: string;
  name: string;
  photoUrl?: string;
  type: AdvisorType;
  sebiRegNo: string;            // e.g. INA000012345
  firmName?: string;
  bio: string;
  specialties: string[];        // ['Equity', 'Mutual Funds', 'Tax Planning']
  experienceYears: number;
  rating: number;               // 0–5 (avg)
  reviewCount: number;
  consultationFee: number;      // INR per slot
  availableSlots: AdvisorSlot[]; // next N slots
  isVerified: boolean;          // SEBI check done by admin
  status: AdvisorStatus;
  createdAt: string;
}

export interface AdvisorSlot {
  id: string;
  advisorId: string;
  startTime: string;   // ISO
  endTime: string;     // ISO
  booked: boolean;
}

export interface Consultation {
  id: string;
  advisorId: string;
  userId: string;
  slotId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';
  meetingLink?: string;      // Phase 2 — video
  notes?: string;
  createdAt: string;
}

export interface AdvisorReview {
  id: string;
  advisorId: string;
  userId: string;
  rating: number;      // 1–5
  comment: string;
  createdAt: string;
}
```

> **Storage:** Existing storage abstraction (`STORAGE_BACKEND`: in-memory / PG / Mongo)
> follow karna — advisors collection in-memory array + optional PG/Mongo repository
> (pattern: `backend/src/services/` ke existing repositories).

---

## 🔌 3. Backend API

**Naya file:** `backend/src/routes/advisors.ts` → Express Router.

| Method | Route | Auth | Kya karta hai |
|--------|-------|------|---------------|
| `GET` | `/api/advisors` | optionalAuth | List (search `?q=`, filter `?type=&specialty=&minRating=`, pagination `?page=&limit=`) — sirf `status: approved` |
| `GET` | `/api/advisors/:id` | optionalAuth | Detail + slots (next 7 din) |
| `GET` | `/api/advisors/:id/reviews` | public | Reviews list |
| `POST` | `/api/advisors/:id/reviews` | authMiddleware | Review submit (sirf completed consultation ke baad) |
| `GET` | `/api/advisors/:id/slots` | public | Available slots |
| `POST` | `/api/consultations` | authMiddleware + inputSanitizer | Booking — slot lock, Razorpay order create |
| `GET` | `/api/consultations` | authMiddleware | Meri consultations (upcoming/past) |
| `GET` | `/api/consultations/:id` | authMiddleware | Consultation detail |
| `POST` | `/api/consultations/:id/cancel` | authMiddleware | Cancel + refund (policy per advisor) |
| `POST` | `/api/consultations/:id/complete` | authMiddleware | Mark complete (advisor ya user) |
| `GET` | `/api/advisors/admin` | adminMiddleware | All advisors incl. pending (admin panel) |
| `POST` | `/api/advisors/admin/:id/approve` | adminMiddleware | Approve / reject / suspend |
| `POST` | `/api/advisors/admin` | adminMiddleware | Admin se advisor add/edit |

**Registration** — `backend/src/server.ts` mein (`social.ts` jaisa):
```ts
app.use('/api/advisors', readLimiter, advisorsRoutes);          // public read
// consultations auth server.ts level par ya router mein lagao
```

**Conventions follow karna:**
- `authMiddleware` (JWT) · `adminMiddleware` · `inputSanitizer` · rate limiters (`readLimiter`/`writeLimiter`)
- Error handler + consistent response shape (existing routes dekho)
- Booking par **idempotency key** (orders.ts ka pattern) — double-booking prevent
- Slot lock: `booked: true` set + `createdAt` TTL (stale release, 10 min) — `idempotency.ts` jaise claim-based dedup
- Unit + integration tests: `backend/src/__tests__/advisors.test.ts`

---

## 📱 4. Frontend

### 4.1 Screens (`src/screens/advisory/` — naya folder)

| File | Screen | Contents |
|------|--------|----------|
| `AdvisorListScreen.tsx` | `AdvisorList` | Search bar, filter chips (type/specialty/rating), advisor cards (photo, rating, fee, "Book" CTA), skeleton loaders |
| `AdvisorDetailScreen.tsx` | `AdvisorDetail` | Profile header, SEBI reg badge, bio, specialties, reviews list, **slot picker + fee summary + Razorpay checkout** |
| `MyConsultationsScreen.tsx` | `MyConsultations` | Upcoming / past tabs, status badges, cancel CTA, "Join" (Phase 2) |
| `ConsultationDetailScreen.tsx` | `ConsultationDetail` | Booking summary, advisor contact, cancel/refund, leave review CTA |
| `ReviewFormScreen.tsx` | `ReviewForm` | Star rating + comment, submit |
| `AdminAdvisorScreen.tsx` | `AdminAdvisor` | Pending approvals list, approve/reject/suspend, add/edit advisor form |

### 4.2 Store — `src/store/advisoryStore.ts`

Zustand, existing pattern (`referralStore.ts` jaisa — API fail par mock fallback):
```ts
interface AdvisoryState {
  advisors: Advisor[];
  filters: { type?: AdvisorType; specialty?: string; minRating?: number; query: string };
  selectedAdvisor: Advisor | null;
  myConsultations: Consultation[];
  isLoading: boolean;
  error: string | null;
  loadAdvisors: () => Promise<void>;
  loadAdvisor: (id: string) => Promise<void>;
  loadMyConsultations: () => Promise<void>;
  bookConsultation: (advisorId: string, slotId: string) => Promise<boolean>;
  cancelConsultation: (id: string) => Promise<boolean>;
  submitReview: (advisorId: string, rating: number, comment: string) => Promise<boolean>;
}
```

### 4.3 Service — `src/services/api/advisory.ts`

```ts
export const advisoryApi = {
  listAdvisors: (params) => api.get<Advisor[]>('/advisors', { params }),
  getAdvisor: (id) => api.get<Advisor>(`/advisors/${id}`),
  getReviews: (id) => api.get<AdvisorReview[]>(`/advisors/${id}/reviews`),
  getSlots: (id) => api.get<AdvisorSlot[]>(`/advisors/${id}/slots`),
  bookConsultation: (body) => api.post<Consultation>('/consultations', body),
  myConsultations: () => api.get<Consultation[]>('/consultations'),
  cancelConsultation: (id) => api.post(`/consultations/${id}/cancel`),
  submitReview: (advisorId, body) => api.post(`/advisors/${advisorId}/reviews`, body),
};
```

### 4.4 Navigation — `src/navigation/AppNavigator.tsx`

- `RootStackParamList` (types/index.ts) mein 6 naye screen names
- Imports + `<Stack.Screen name=...>` registration (Referral/RetirementPlanner pattern)
- Entry point: Profile/More menu se "Advisors" link (ProfileScreen mein row)

### 4.5 i18n — `src/i18n/locales/{en,hi}/advisory.ts`

- Namespace `advisory` + `adminAdvisory` (AdminAdvisor screen)
- Dono `index.ts` mein register karna
- All strings `useT()` + `t('advisory.key')` se (I18N_PATTERN.md follow)

---

## 💳 5. Payments

Consultation fee = Razorpay order (existing `payments.ts` pattern):

| Step | Kya |
|------|-----|
| 1 | Book API → slot lock + `payments/create-order` (amount = fee) |
| 2 | Client → Razorpay checkout (UPI/card) |
| 3 | `payments/verify` → consultation `confirmed` |
| 4 | Payment fail → slot auto-release (TTL) |

> **Phase 2:** Payouts to advisors (RazorpayX / bank transfer), platform commission
> %, GST invoicing.

---

## ⚖️ 6. Compliance Guardrails (Launch se pehle)

| # | Item | Owner |
|---|------|-------|
| 1 | Sirf valid SEBI RIA/RA reg. no. wale advisors approve karna (admin manual verify first, API auto-verify Phase 2) | Admin |
| 2 | Har advisor page par: reg no. + "Investments are subject to market risks" + advisor disclaimer | Dev (hardcoded) |
| 3 | Advisory disclaimer in onboarding/booking flow (checkbox) | Dev |
| 4 | Privacy policy + ToS update (advisor data, booking terms, refund policy) | Legal |
| 5 | No performance-return promises allowed in bio/specialties (admin review) | Admin |

---

## 🧪 7. Testing Plan

| Layer | Files | Kya test karna |
|-------|-------|----------------|
| Frontend unit | `advisoryStore.test.ts` (20) + `AdvisorListScreen.test.tsx` (5) + `AdvisorDetailScreen.test.tsx` (6) + `MyConsultationsScreen.test.tsx` (4) ✅ | Store actions, filters, search/chips, booking flow + alerts, tabs, navigation, empty states, mock fallback |
| Backend unit | `backend/src/__tests__/advisors.test.ts` ✅ (24 tests) | List filters, slot lock, review rules, admin approval |
| Backend integration | `backend/src/__tests__/advisors.int.test.ts` ✅ (25 tests) | Real-JWT auth guards, booking → confirm → complete → review lifecycle, ownership isolation, cancel + slot release (in-memory service — Docker ki zaroorat nahi) |
| E2E (Maestro) | `.maestro/flows/advisory/advisoryJourney.yaml` ✅ | Login → More → Advisors → search/filter → profile → back |

> **CI:** Existing workflows add hona chahiye — `ci.yml` automatically picks backend/
> frontend tests; calculator-broker-chat jaise path-filtered workflow advisory files
> ke liye optional hai.

---

## 🗺️ 8. Phases

### Phase 1 — MVP Skeleton (implemented ✅)
- [x] Types + mock data (`constants/mockData.ts` mein 5–6 sample advisors)
- [x] Backend `routes/advisors.ts` + server.ts registration + tests
- [x] Frontend: 6 screens + store + service + navigation + i18n
- [ ] Razorpay booking flow (existing payments integration reuse) — **pending**: booking → pending consultation → `POST /consultations/:id/confirm` wired; Razorpay checkout UI (order create → checkout → verify) abhi baki hai
- [x] Unit + integration tests green; typecheck pass

### Phase 2 — Trust & Scale
- [ ] SEBI reg. auto-verify (public API scrape/manual upload)
- [ ] In-app video/chat consultation (WebRTC/Meet embed)
- [ ] Admin dashboard: payouts, commission, GST invoices
- [ ] Reviews moderation + verified-buyer badge

### Phase 3 — Ecosystem
- [ ] Advisor public profiles (web/PWA) + SEO
- [ ] Revenue share tiers (free tier: 1 free session/mo etc.)
- [ ] Recommendation engine ("aapke portfolio ke liye suitable advisors")

---

## 📄 9. File Checklist (exact)

**Backend:**
- [x] `backend/src/routes/advisors.ts` — **naya**
- [x] `backend/src/server.ts` — route registration (+`readLimiter`)
- [x] `backend/src/__tests__/advisors.test.ts` — **naya** (unit, 24 tests)
- [x] `backend/src/__tests__/advisors.int.test.ts` — **naya** (integration, 25 tests — real JWT auth, full booking lifecycle)

**Frontend:**
- [x] `src/types/index.ts` — models + `RootStackParamList` (6 screens)
- [x] `src/constants/mockData.ts` — sample advisors/slots/reviews
- [x] `src/services/api/advisory.ts` — **naya**
- [x] `src/store/advisoryStore.ts` — **naya**
- [x] `src/screens/advisory/` — 6 screens (above)
- [x] `src/navigation/AppNavigator.tsx` — imports + Stack.Screen × 6
- [x] `src/screens/tabs/MoreScreen.tsx` — "Advisors" entry row (ProfileScreen ke bajaye MoreScreen mein — FeatureGrid pattern)
- [x] `src/i18n/locales/en/advisory.ts` + `hi/advisory.ts` + dono `index.ts`
- [x] `src/__tests__/advisoryStore.test.ts` (20 tests) + `AdvisorListScreen.test.tsx` + `AdvisorDetailScreen.test.tsx` + `MyConsultationsScreen.test.tsx` (15 tests) — store actions, filters, booking flow, tabs, navigation, empty states, mock fallback

**E2E / Docs:**
- [x] `.maestro/flows/advisory/advisoryJourney.yaml` — 1 smoke flow (Phase 1)
- [x] `docs/FEATURE_CHECKLIST.md` — section add (## 29. Advisory Marketplace)
- [x] `docs/FUTURE.md` — §9.3 advisory item ko Phase 1 done mark karna

---

> **⚡ Note:** Ye skeleton plan hai — implementation start karne se pehle Phase 1 ke
> items confirm karke todos banao. Estimated effort (Phase 1): ~1 dev-week (backend
> 2 days, frontend 3 days, tests + polish 2 days).
>
> *Last updated: August 16, 2026*
