# HostelHub Design System

**Version:** 1.0  
**Last Updated:** 2026-05-24  
**Status:** Living Document

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography System](#typography-system)
4. [Spacing & Sizing](#spacing--sizing)
5. [Component Specifications](#component-specifications)
6. [Layout Patterns](#layout-patterns)
7. [Responsive Design](#responsive-design)
8. [Accessibility Standards](#accessibility-standards)
9. [Implementation Guidelines](#implementation-guidelines)

---

## Design Philosophy

**Core Principles:**
- **Minimalist & Scannable** — High contrast, clean lines, reduced cognitive load
- **Property-First** — Calendar/tape chart as primary focal point
- **Data Dense but Readable** — Support detailed hostel operations without overwhelming
- **Modern Professional** — Enterprise-grade SaaS aesthetic
- **Accessible by Default** — WCAG 2.1 AA compliance

---

## Color Palette

### Primary Colors

| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Background | `#F8FAFC` | `slate-50` | Page background, light surfaces |
| Surface | `#FFFFFF` | `white` | Cards, modals, containers |
| Border | `#E2E8F0` | `slate-200` | Dividers, card borders (1px) |
| Text Primary | `#0F172A` | `slate-900` | Headlines, primary content |
| Text Secondary | `#334155` | `slate-700` | Body text, regular content |
| Text Muted | `#64748B` | `slate-500` | Labels, captions, hints |
| Text Disabled | `#94A3B8` | `slate-400` | Disabled states |

### Semantic Colors

**Status & Reservation Types:**

| Status | Background | Text | Hex (BG) | Hex (Text) | Use Case |
|--------|-----------|------|----------|-----------|----------|
| **Pending** | `bg-amber-50` | `text-amber-700` | `#FFFBEB` | `#B45309` | Unconfirmed bookings |
| **Confirmed** | `bg-emerald-50` | `text-emerald-700` | `#F0FDF4` | `#15803D` | Confirmed reservations |
| **Checked In** | `bg-emerald-100` | `text-emerald-800` | `#DCFCE7` | `#166534` | Active guests |
| **Checked Out** | `bg-slate-100` | `text-slate-600` | `#F1F5F9` | `#475569` | Completed stays |
| **Cancelled** | `bg-red-50` | `text-red-700` | `#FEF2F2` | `#B91C1C` | Cancelled reservations |
| **No-Show** | `bg-slate-200` | `text-slate-700` | `#E2E8F0` | `#334155` | No-shows |

**Channel Colors:**

| Channel | Background | Text | Hex (BG) | Use Case |
|---------|-----------|------|----------|----------|
| **Airbnb** | `bg-emerald-50` | `text-emerald-800` | `#E8F5E9` | Airbnb bookings |
| **Booking.com** | `bg-amber-50` | `text-amber-800` | `#FFF3E0` | Booking.com reservations |
| **Direct Website** | `bg-indigo-50` | `text-indigo-800` | `#E0E7FF` | Direct bookings |
| **Walk-In** | `bg-purple-50` | `text-purple-800` | `#F3E8FF` | Walk-in guests |
| **Phone** | `bg-cyan-50` | `text-cyan-800` | `#E0F2FE` | Phone reservations |

**Interactive States:**

| State | Color | Hex |
|-------|-------|-----|
| Primary CTA | `#4F46E5` | Indigo-600 |
| Primary CTA Hover | `#4338CA` | Indigo-700 |
| Danger CTA | `#DC2626` | Red-600 |
| Success | `#16A34A` | Emerald-600 |
| Warning | `#D97706` | Amber-600 |

---

## Typography System

**Font Family:** `Inter` (Google Fonts) — `font-family: 'Inter', sans-serif`

### Type Scale

| Usage | Font Size | Font Weight | Line Height | Letter Spacing | Tailwind Class |
|-------|-----------|-------------|-------------|-----------------|-----------------|
| **Display Large** | 32px | 700 | 1.2 | -0.02em | `text-3xl font-bold` |
| **Display Medium** | 28px | 700 | 1.2 | -0.02em | `text-2xl font-bold` |
| **Heading 1** | 24px | 600 | 1.3 | 0 | `text-xl font-semibold` |
| **Heading 2** | 20px | 600 | 1.4 | 0 | `text-lg font-semibold` |
| **Heading 3** | 16px | 600 | 1.5 | 0 | `text-base font-semibold` |
| **Body Large** | 16px | 400 | 1.5 | 0 | `text-base` |
| **Body Regular** | 14px | 400 | 1.5 | 0 | `text-sm` |
| **Body Small** | 12px | 400 | 1.5 | 0 | `text-xs` |
| **Label** | 11px | 500 | 1.4 | 0.05em | `text-[11px] font-medium` |
| **Caption** | 10px | 400 | 1.4 | 0.05em | `text-[10px]` |

### Usage Guidelines

- **Page Titles:** `text-2xl font-semibold text-slate-900`
- **Section Headers:** `text-lg font-semibold text-slate-900`
- **Card Headers:** `text-base font-semibold text-slate-900`
- **Data Tables:** `text-xs` for all data, `text-[10px]` for utility labels
- **Form Labels:** `text-xs font-medium text-slate-600`
- **Stat Numbers:** `text-2xl font-bold text-slate-900`

---

## Spacing & Sizing

### Spacing Scale

Based on 4px base unit:

```
xs   = 4px   (scale-1)
sm   = 8px   (scale-2)
md   = 12px  (scale-3)
lg   = 16px  (scale-4)
xl   = 24px  (scale-6)
2xl  = 32px  (scale-8)
3xl  = 48px  (scale-12)
```

**Tailwind equivalents:** `p-1` through `p-12`

### Common Spacing Patterns

| Component | Padding | Gap | Margin |
|-----------|---------|-----|--------|
| Card (interior) | `p-4` (16px) | — | — |
| Card (compact) | `p-3` (12px) | — | — |
| Page content | `p-6` (24px) | `gap-6` | — |
| Stat cards grid | — | `gap-4` | — |
| Form fields | — | `gap-4` | — |
| Table rows | `p-3` (12px) | — | — |

### Common Sizes

| Element | Width | Height |
|---------|-------|--------|
| Sidebar (desktop) | `w-64` (256px) | 100% |
| Sidebar (mobile) | 100% | auto |
| Header | 100% | `h-14` (56px) |
| Icon (UI) | 16px–20px | 16px–20px |
| Icon (large) | 24px–32px | 24px–32px |
| Avatar (small) | 32px | 32px |
| Avatar (large) | 48px | 48px |

---

## Component Specifications

### 1. Stat Card (Dashboard)

**Container:**
```html
<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
```

**Layout:**
- Left: Label (uppercase, `text-xs font-medium text-slate-500`) + Metric (largest number, `text-2xl font-bold text-slate-900`)
- Right: Icon container (`p-3 rounded-xl bg-[color]-50 text-[color]-600`)

**Variants:**
- Occupancy Rate: Indigo icon (`bg-indigo-50 text-indigo-600`)
- Arrivals: Amber icon (`bg-amber-50 text-amber-600`)
- Revenue: Emerald icon (`bg-emerald-50 text-emerald-600`)

**Example:**
```html
<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
  <div>
    <p class="text-xs font-medium text-slate-500 uppercase tracking-wider">Occupancy Rate</p>
    <h3 class="text-2xl font-bold text-slate-900 mt-1">84.2%</h3>
    <p class="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-0.5">
      <i data-lucide="arrow-up-right" class="w-3 h-3"></i> +3.1% vs last week
    </p>
  </div>
  <div class="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
    <i data-lucide="percent" class="w-5 h-5"></i>
  </div>
</div>
```

---

### 2. Status Badge

**Pill Style (Compact):**
```html
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[status-color]-50 text-[status-color]-700 border border-[status-color]-100">
  Confirmed
</span>
```

**Use Cases:**
- Reservation status (confirmed, pending, checked-in, etc.)
- Payment status (paid, pending, overdue)
- Channel indicators (Airbnb, Booking.com, etc.)

**Color Mappings:**
- Pending → `bg-amber-50 text-amber-700 border-amber-100`
- Confirmed → `bg-emerald-50 text-emerald-700 border-emerald-100`
- Checked In → `bg-emerald-100 text-emerald-800`
- Cancelled → `bg-red-50 text-red-700 border-red-100`

---

### 3. Data Table

**Container:**
```html
<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
  <table class="w-full text-left border-collapse text-xs">
    <thead>
      <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-medium">
        <th class="p-3">Column Header</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100 text-slate-700">
      <tr>
        <td class="p-3">Data Cell</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Guidelines:**
- Header background: `bg-slate-50/70`
- Row dividers: `divide-y divide-slate-100`
- Cell padding: `p-3` (12px)
- Text size: `text-xs`
- Hover effect (optional): `hover:bg-slate-50/50`

---

### 4. Sidebar Navigation

**Container:**
```html
<aside class="w-64 bg-white border-r border-slate-200 flex flex-col">
```

**Active Nav Item:**
```html
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600">
  <i data-lucide="icon-name" class="w-4 h-4"></i> Label
</button>
```

**Inactive Nav Item:**
```html
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
  <i data-lucide="icon-name" class="w-4 h-4"></i> Label
</button>
```

**Guidelines:**
- Active: `bg-indigo-50 text-indigo-600`
- Inactive: `text-slate-600 hover:bg-slate-50`
- Icon size: `w-4 h-4`
- Padding: `px-3 py-2`
- Gap between icon and text: `gap-3`

---

### 5. Reservation Block (Tape Chart)

**Container:**
```html
<div class="absolute h-7 rounded-md flex items-center px-2 text-[10px] font-medium text-white cursor-pointer truncate"
     style="left: <dynamic>px; width: <dynamic>px; background: <channel-color>;">
  <span class="truncate">Guest Name (Channel)</span>
</div>
```

**Channel-Based Colors:**
- Airbnb: `bg-emerald-500`
- Booking.com: `bg-amber-500`
- Direct: `bg-indigo-500`
- Walk-In: `bg-purple-500`

**State Overlays:**
- Hover: Increase opacity/darken by 10%
- Selected: Add border `border-2 border-slate-900`

---

### 6. Form Input

**Standard Input:**
```html
<div>
  <label class="block text-xs font-medium text-slate-600 mb-1">Label</label>
  <input type="text" 
         class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all">
</div>
```

**Guidelines:**
- Border: `border border-slate-200`
- Padding: `px-3 py-2`
- Border radius: `rounded-lg`
- Focus state: `focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`
- Disabled: `disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`

---

### 7. Button

**Primary CTA:**
```html
<button class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors">
  Action
</button>
```

**Secondary Button:**
```html
<button class="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
  Action
</button>
```

**Guidelines:**
- Primary: `bg-slate-900 hover:bg-slate-800 text-white`
- Secondary: `border border-slate-200 text-slate-700 hover:bg-slate-50`
- Padding: `px-4 py-2` (regular), `px-2 py-1` (small)
- Border radius: `rounded-lg`
- Transition: `transition-colors`

---

## Layout Patterns

### 1. Master Layout Structure

```html
<div class="min-h-screen flex flex-col md:flex-row bg-slate-50">
  <!-- Sidebar -->
  <aside class="w-full md:w-64 bg-white border-b md:border-r border-slate-200 flex flex-col">
    <!-- Sidebar content -->
  </aside>

  <!-- Main Content Area -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Header -->
    <header class="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <!-- Header content -->
    </header>

    <!-- Main Content -->
    <main class="p-6 flex-1 overflow-y-auto">
      <!-- Page content -->
    </main>
  </div>
</div>
```

**Breakpoints:**
- Mobile: Full-width sidebar above header
- Tablet (768px+): Sidebar on left
- Desktop (1024px+): Sidebar + full-width content

---

### 2. Dashboard Grid

**3-Column Stat Cards (Desktop):**
```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <!-- Stat cards -->
</div>
```

**Responsive:** Stacks vertically on mobile, 2-column on tablet, 3-column on desktop.

---

### 3. Tape Chart (60-Day Calendar)

**Container Structure:**
```html
<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
  <!-- Horizontal scrolling container -->
  <div class="overflow-x-auto tape-chart-container flex-1">
    <div class="min-w-[2800px] divide-y divide-slate-100">
      <!-- Date header row -->
      <div class="flex bg-slate-50/80">
        <div class="w-48 p-3 bg-slate-100 sticky left-0 z-20 border-r border-slate-200">Room/Bed</div>
        <!-- Date columns (60 days @ 48px each = 2880px) -->
      </div>

      <!-- Bed rows -->
      <div class="flex relative group hover:bg-slate-50/40">
        <div class="w-48 p-3 sticky left-0 bg-white z-10 border-r border-slate-200">Bed name</div>
        <!-- Reservation blocks absolutely positioned -->
        <!-- Empty day cells -->
      </div>
    </div>
  </div>
</div>
```

**Key Features:**
- Left column sticky: `sticky left-0 z-10`
- Min width for scroll: `min-w-[2800px]` (60 days × ~48px)
- Reservation blocks: `absolute` positioned with dynamic `left` and `width`
- Day column width: 48px (`w-12`)
- Date header sticky: `sticky top-0 z-20`

---

### 4. Content Card

```html
<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
  <!-- Header (optional) -->
  <div class="px-5 py-4 border-b border-slate-100">
    <h2 class="text-sm font-semibold text-slate-900">Section Title</h2>
  </div>

  <!-- Body -->
  <div class="p-5">
    <!-- Content -->
  </div>
</div>
```

**Spacing:**
- Padding: `px-5 py-4` (20px × 16px)
- Border: `border-slate-200` (1px)
- Inner dividers: `border-slate-100`

---

## Responsive Design

### Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| **Mobile** | < 640px | `sm:` prefix |
| **Tablet** | 768px+ | `md:` prefix |
| **Desktop** | 1024px+ | `lg:` prefix |
| **Large Desktop** | 1280px+ | `xl:` prefix |

### Mobile-First Approach

Always design mobile first, then enhance with larger screens:

```html
<!-- Mobile: Full-width, stacked -->
<div class="flex flex-col md:flex-row">

<!-- Mobile: Single column -->
<div class="grid grid-cols-1 md:grid-cols-3">
```

### Responsive Typography

```html
<!-- Mobile: smaller text -->
<h1 class="text-lg md:text-2xl font-semibold">
```

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Normal text (≥14px): Min 4.5:1 ratio
- Large text (≥18px bold/22px): Min 3:1 ratio
- Examples:
  - Slate-900 (#0F172A) on white: ✅ 18:1
  - Slate-700 (#334155) on white: ✅ 8.6:1
  - Slate-500 (#64748B) on white: ✅ 4.6:1 (acceptable for labels)

**Interactive Elements:**
- All buttons must be keyboard navigable (`tab` key)
- Focus indicators visible (default or `focus:ring-2 focus:ring-indigo-500`)
- Click targets minimum 44px × 44px (mobile), 40px × 40px (desktop)

**Semantic HTML:**
- Use `<button>` for interactive elements
- Use `<table>` for tabular data
- Use `<label>` for form inputs
- Use heading hierarchy (`<h1>` → `<h2>` → `<h3>`)

**ARIA Attributes:**
- `aria-label` for icon-only buttons
- `aria-current="page"` for active navigation
- `role="status"` for dynamic content updates

---

## Implementation Guidelines

### CSS Variables (Optional)

For future theme support, define CSS variables:

```css
:root {
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text: #0F172A;
  --color-text-secondary: #334155;
  --color-text-muted: #64748B;
  --color-accent: #4F46E5;
}
```

### Tailwind Configuration

**tailwind.config.ts:**
```typescript
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        slate: {
          50: '#F8FAFC',
          900: '#0F172A',
          // ... etc
        },
      },
      spacing: {
        14: '56px', // Header height
        64: '256px', // Sidebar width
      },
    },
  },
}
```

### Animation & Transitions

**Hover Effects:**
```html
<button class="transition-colors duration-200 hover:bg-slate-800">
```

**Focus Effects:**
```html
<input class="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
```

**Guidelines:**
- Duration: `duration-150` (fast interactions), `duration-200` (standard)
- Easing: Use default `ease` or `ease-in-out`
- Avoid: Animations > 300ms for UI feedback

---

### Icon System (Lucide React)

**Installation:**
```bash
npm install lucide-react
```

**Usage:**
```tsx
import { Calendar, Users, Hotel } from 'lucide-react';

<Calendar className="w-4 h-4" />
<Users className="w-5 h-5" />
```

**Icon Sizes:**
- UI: `w-4 h-4` (16px)
- Medium: `w-5 h-5` (20px)
- Large: `w-6 h-6` (24px)
- Display: `w-8 h-8` (32px)

---

### Dark Mode (Future)

When implementing dark mode, use Tailwind's `dark:` prefix:

```html
<div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
```

---

## Code Examples

### Complete Dashboard Component

```tsx
'use client';

import { Percent, LogIn, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    {
      label: 'Occupancy Rate',
      value: '84.2%',
      change: '+3.1%',
      icon: Percent,
      color: 'indigo',
    },
    {
      label: 'Arrivals Today',
      value: '14 Guests',
      change: '8 checked in',
      icon: LogIn,
      color: 'amber',
    },
    {
      label: 'Daily Revenue',
      value: '$1,240',
      change: '+12%',
      icon: DollarSign,
      color: 'emerald',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Today's overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {stat.label}
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {stat.value}
              </h3>
              <p className={`text-xs font-medium mt-1 text-${stat.color}-600`}>
                {stat.change}
              </p>
            </div>
            <div className={`p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-24 | Initial design system |

---

**Questions?** Refer to `ARCHITECTURE.md` for system context or reach out to the design team.
