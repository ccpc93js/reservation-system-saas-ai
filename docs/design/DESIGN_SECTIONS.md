# Design Specification: Page-by-Page Guide

**For AI design generation & developer implementation**

---

## 📊 DASHBOARD PAGE

**Route:** `/dashboard`  
**Purpose:** Daily operations overview

### Layout Structure
```
┌─────────────────────────────────────────────┐
│ Dashboard Overview                           │
├─────────────────────────────────────────────┤
│                                             │
│  [Occupancy] [Arrivals] [Revenue]          │
│  Stat Cards (3-column grid)                │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ Today's Dynamic Arrivals Schedule      │ │
│  ├────────────────────────────────────────┤ │
│  │ Guest Name | Bed | Duration | Status  │ │
│  │ Marcus V. | A-03 | 4 nights | Pending│ │
│  │ Clara J.  | 102  | 1 night  | Pending│ │
│  └────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### Components & Styling

#### 1. Page Header
```tsx
<div>
  <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
  <p className="text-sm text-slate-500 mt-1">Today's overview</p>
</div>
```

#### 2. Stat Cards Grid (3 cards)
```tsx
// Card 1: Occupancy Rate
- Label: "Occupancy Rate" (uppercase, muted)
- Metric: "84.2%" (large bold)
- Trend: "+3.1% vs last week" (emerald text)
- Icon: Percent (indigo-50 background)

// Card 2: Total Arrivals
- Label: "Total Arrivals Today"
- Metric: "14 Guests"
- Detail: "8 checked in / 6 pending"
- Icon: LogIn (amber-50 background)

// Card 3: Daily Revenue
- Label: "Daily Revenue"
- Metric: "$1,240"
- Trend: "+12% direct channels"
- Icon: DollarSign (emerald-50 background)
```

**Grid Classes:** `grid grid-cols-1 md:grid-cols-3 gap-4`

#### 3. Arrivals Table
```
Header Row:
- Guest Name | Assigned Bed/Room | Stay Duration | Source Channel | Balance Status | Action

Data Row:
- Marcus Vance | Dorm A - Bed 03 | May 24-28 (4 nights) | Booking.com [badge] | Paid | Check In [btn]
- Clara Jenkins | Priv. Room 102 | May 24-25 (1 night) | Airbnb [badge] | $45 Pending | Check In [btn]
```

**Styling:**
- Container: `bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`
- Header: `bg-slate-50/70 border-b border-slate-100 text-slate-500 font-medium`
- Rows: `divide-y divide-slate-100 text-slate-700`
- Cell padding: `p-3`
- Text size: `text-xs`

---

## 🗓️ CALENDAR PAGE (Tape Chart)

**Route:** `/calendar`  
**Purpose:** 60-day reservation visualization

### Layout Structure
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Interactive Tape Calendar (60-Day View)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ [60-Day Timeline] [Legend] [May ← | May — July 2026 | →]              │
│                                                                         │
│ ┌──────────────┬─────────────────────────────────────────────────────┐ │
│ │ Room/Bed     │ May 1 | May 2 | May 3 | ... | July 31              │ │
│ ├──────────────┼─────────────────────────────────────────────────────┤ │
│ │ Dorm A - 01  │ [Emma Watson - Airbnb ───────] [John Doe ─────]   │ │
│ │ Dorm A - 02  │        [Liam Neeson - Direct ─────────────────]   │ │
│ │ Private 101  │ [The Smith Family - Airbnb Extended ───────────]  │ │
│ │ ...          │                                                     │ │
│ └──────────────┴─────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components & Styling

#### 1. Header Controls
```tsx
// Left: Timeline info
<span class="text-xs font-semibold bg-slate-100 px-2 py-1 rounded">
  60-Day Timeline Horizon
</span>

// Middle: Channel legend
- ● Airbnb (emerald)
- ● Booking.com (amber)
- ● Walk-In (indigo)

// Right: Navigation
← [May — July 2026] →
```

#### 2. Tape Chart Matrix

**Fixed Left Column (Sticky):**
```
Width: 192px (w-48)
Content: [Room/Bed Name] [Price/Night]
Example: "Dorm A - Bed 01" "$28"
Sticky: sticky left-0 bg-white z-10 border-r border-slate-200
```

**Date Header Row (Scrollable):**
```
60 columns × 48px each = 2880px width
Format: "May 1", "May 2", ... "July 31"
Today highlighted: bg-indigo-50 text-indigo-700 font-bold
Size: text-[10px] font-semibold text-slate-500
Sticky top: sticky top-0 z-20
```

**Bed Rows (Scrollable):**
```
For each bed:
  - Fixed left column (192px, sticky)
  - 60 empty cells (48px each)
  - Reservation blocks absolutely positioned

Reservation Block:
  - Height: 28px (h-7)
  - Background: channel color (emerald-500, amber-500, etc.)
  - Text: "Guest Name (Channel)" truncated
  - Border radius: rounded-md
  - Cursor: pointer
  - Position: absolute left-[<calculated>px] width-[<calculated>px]
```

**Color Mapping (Blocks):**
- Airbnb: `bg-emerald-500`
- Booking.com: `bg-amber-500`
- Direct: `bg-indigo-500`
- Walk-in: `bg-purple-500`

**Interaction States:**
- Hover: Opacity increase to 90%
- Click: Border `border-2 border-slate-900`
- Disabled: Opacity 50%

---

## 👥 GUESTS PAGE

**Route:** `/guests`  
**Purpose:** Guest directory & profiles

### Layout Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ Centralized Guest Registry Database                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Guest | Passport/ID | Total Stays | Notes | Actions      │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │ Marcus Vance | US-PP-849204 | 3 bookings | Vegan meals | │ │
│ │ Clara Jenkins| UK-ID-993021 | 1 booking  | Late arrival| │ │
│ │ ...          | ...          | ...        | ...         | │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components & Styling

#### 1. Page Header
```tsx
<h1 className="text-2xl font-semibold text-slate-900">Guest Directory</h1>
<p className="text-sm text-slate-500 mt-1">Manage guest profiles and history</p>
```

#### 2. Search & Filter Bar
```
[Search] [Filter] [+ New Guest]
```

#### 3. Guest Table
```
Columns:
1. Guest (name + email sub)
2. Passport/ID Verification
3. Total Stays
4. Notes & Preferences
5. Actions (View File)

Row Styling:
- Header: bg-slate-50 border-b border-slate-200
- Rows: divide-y divide-slate-100 text-slate-700 text-xs
- Cell padding: p-3

Example Row:
Marcus Vance
marcus@vance.com
| US-PP-849204 | 3 bookings | Prefers bottom bunk. Vegan. | [View File]
```

#### 4. Guest Detail Modal/Drawer (Phase 2)
```
Profile Fields:
- Name (first, last)
- Email
- Phone
- Date of Birth
- Nationality (ISO)
- Document Type (passport, ID, license)
- Document Number
- Passport Issue Place (Serbia)
- Entry Date to Serbia
- Gender
- Special Notes
```

---

## 🛏️ ROOMS PAGE

**Route:** `/rooms`  
**Purpose:** Inventory & room configuration

### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│ Physical Inventory & Bed Configurations                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│ │ Dorm A (6-bed) │ │ Private 101     │ │ Studio 403      ││
│ │ Mixed, Floor 1 │ │ Double, E-Wing  │ │ Private, 2bd    ││
│ │ 4/6 Occupied   │ │ Occupied        │ │ 1/1 Occupied    ││
│ │                │ │                 │ │                 ││
│ │ Beds 1-4: Book │ │ The Smith Family│ │ Available $65   ││
│ │ Beds 5-6: Avai │ │ Inspect on exit │ │ $75/night       ││
│ │ $28/night      │ │ $65/night       │ │                 ││
│ └─────────────────┘ └─────────────────┘ └─────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Components & Styling

#### 1. Room Card Grid
```tsx
Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
```

#### 2. Room Card
```html
<div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h4 class="font-bold text-sm text-slate-900">Dorm A (6-Bunk Mixed)</h4>
      <p class="text-xs text-slate-400">Main Building • Floor 1</p>
    </div>
    <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full">
      4/6 Beds Occupied
    </span>
  </div>

  <!-- Bed Status -->
  <div class="space-y-1.5 text-xs">
    <div class="flex justify-between text-slate-500 border-b border-slate-100 pb-1">
      <span>Bed 01 — Bed 04:</span>
      <span class="text-slate-800 font-medium">Booked</span>
    </div>
    <div class="flex justify-between text-slate-500">
      <span>Bed 05 — Bed 06:</span>
      <span class="text-emerald-600 font-medium">Available ($28/nt)</span>
    </div>
  </div>
</div>
```

#### 3. Room Detail View (Phase 2)
```
Edit Room Info:
- Room Name
- Room Type (dorm / private)
- Capacity
- Floor
- Base Price
- Gender (if dorm)
- Notes/Description
```

---

## 🔐 LOGIN PAGE

**Route:** `/login`  
**Purpose:** Authentication

### Layout Structure
```
┌────────────────────────────────┐
│ RestEasy PMS                   │
│ Hostel Management System       │
│                                │
│ Welcome back                   │
│ Sign in to manage operations   │
│                                │
│ [Email input]                  │
│ [Password input]               │
│ [Remember me] [Forgot pwd?]    │
│ [Sign In Button]               │
│                                │
└────────────────────────────────┘
```

### Components & Styling

```html
<div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-8">
    
    <!-- Logo/Branding -->
    <div class="flex items-center gap-3 mb-6">
      <div class="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
        <i data-lucide="hotel" class="w-6 h-6"></i>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900">HostelHub PMS</h2>
        <p class="text-xs text-slate-500">Property Management</p>
      </div>
    </div>

    <!-- Title -->
    <h3 class="text-lg font-semibold text-slate-900 mb-2">Welcome back</h3>
    <p class="text-sm text-slate-500 mb-6">Sign in to manage your property.</p>

    <!-- Form -->
    <form class="space-y-4">
      <!-- Email -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
        <input type="email" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
      </div>

      <!-- Password -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Password</label>
        <input type="password" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
      </div>

      <!-- Remember & Forgot -->
      <div class="flex items-center justify-between text-xs text-slate-500">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" class="rounded border-slate-300"> Remember me
        </label>
        <a href="#" class="text-indigo-600 hover:underline">Forgot password?</a>
      </div>

      <!-- Submit -->
      <button class="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors mt-2">
        Sign In
      </button>
    </form>
  </div>
</div>
```

---

## 🧭 SIDEBAR NAVIGATION

**Position:** Left fixed, desktop; Top mobile  
**Width:** 256px (w-64) on desktop

```tsx
// Active Item
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600">
  <i data-lucide="icon-name" class="w-4 h-4"></i> Label
</button>

// Inactive Item
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
  <i data-lucide="icon-name" class="w-4 h-4"></i> Label
</button>
```

**Navigation Items:**
1. Dashboard → `/dashboard`
2. Tape Calendar → `/calendar`
3. Guest Directory → `/guests`
4. Room Inventory → `/rooms`

---

## 📱 RESPONSIVE BEHAVIOR

### Breakpoints
- **Mobile (< 768px):** Sidebar hides, nav in mobile menu
- **Tablet (768px+):** Sidebar on left, 2-column layouts
- **Desktop (1024px+):** Full 3-column layouts, tape chart scrollable

### Mobile Adjustments
- Single column for stat cards
- Simplified tables (hide some columns)
- Sidebar collapses to hamburger menu
- Tape chart may require left/right scroll hints

---

## ✨ Animation & Interaction

### Transitions
- Button hover: `transition-colors duration-200`
- Input focus: `focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500`
- Reservation block hover: Darken by 10%, cursor `pointer`

### Interactions (Phase 2+)
- Click empty tape chart cell → New reservation drawer
- Click reservation block → Edit reservation drawer
- Click guest name → Guest detail modal
- Drag reservation block → Change dates

---

**For questions on specific sections, refer to `DESIGN_SYSTEM.md` (complete reference) or `DESIGN_QUICK_REF.md` (quick lookup).**
