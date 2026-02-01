# ZaveTax - Project Guidelines

## 1. Architecture Overview

### Tech Stack
- **Frontend:** React (Vite), TypeScript, Tailwind CSS
- **Backend/Database:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Deployment:** Vercel (recommended for frontend), Supabase (managed backend)

### Architecture Patterns
- **Mobile-First Design:** All UI components must be optimized for mobile devices first, then scale up to tablet/desktop.
- **Component-Based:** Reusable UI components (Buttons, Inputs, Cards) located in `src/components/ui`.
- **Feature-Based Folder Structure:**
  ```
  src/
    components/   # Shared UI components
    features/     # Feature-specific code (e.g., auth, expenses, taxes)
    hooks/        # Global hooks
    lib/          # Utility functions and Supabase client
    pages/        # Route components
    types/        # Global TypeScript types
  ```

## 2. Supabase Schema (Draft)

### Users & Profiles
- `auth.users`: Managed by Supabase Auth.
- `public.profiles`: Extended user data (Restaurant Name, Owner Name, Tax ID).

### Financials
- `public.transactions`:
  - `id`: uuid
  - `user_id`: uuid (FK)
  - `type`: 'income' | 'expense'
  - `amount`: numeric
  - `category`: string (e.g., 'Food Cost', 'Rent', 'Sales')
  - `date`: date
  - `receipt_image_url`: string (optional)
  - `created_at`: timestamp

### Tax Records
- `public.tax_summaries`:
  - `id`: uuid
  - `user_id`: uuid (FK)
  - `month`: integer
  - `year`: integer
  - `total_vat_sales`: numeric
  - `total_vat_purchase`: numeric
  - `vat_payable`: numeric

## 3. Thai Tax Logic (Logic Core)

### VAT (Value Added Tax) - 7%
- **Output Tax (ภาษีขาย):** Calculated from sales. `Sales * 0.07` (if price excludes VAT) or `Sales * 7/107` (if price includes VAT).
- **Input Tax (ภาษีซื้อ):** Claimable from valid tax invoices (ใบกำกับภาษีเต็มรูป).
- **Remittance:** Form P.P.30 (ภ.พ.30) filed monthly.

### Withholding Tax (WHT - ภาษีหัก ณ ที่จ่าย)
Common rates for Restaurants:
- **Rent:** 5%
- **Services (Repair, Maintenance):** 3%
- **Advertising:** 2%
- **Transportation:** 1%

### Corporate Income Tax (CIT)
- Configuration for Half-year (P.N.D.51) and Annual (P.N.D.50) estimates based on net profit.

## 4. UI/UX Guidelines

### Theme: "Light Mode Professional"
- **Background:** White (`#FFFFFF`) or very light gray (`#F8FAFC` - Slate-50).
- **Text:** High contrast dark gray (`#1E293B` - Slate-800) for readability.
- **Primary Color:** Deep Blue or Green (Trustworthy/Financial).
- **Accent:** Orange or Yellow for actions (e.g., "Add Transaction").

### Mobile-First Principles
- **Touch Targets:** Buttons must be at least 44px height.
- **Navigation:** Bottom navigation bar for core tabs (Dashboard, Add, Reports, Settings).
- **Fonts:** Clean sans-serif (Inter or Sarabun for Thai support).
- **Input Fields:** Large text size (16px+) to prevent automatic zoom on iOS.
