# Design System Quick Reference

**For developers implementing HostelHub UI**

---

## 🎨 Color Quick Lookup

### Use This Everywhere
- **Backgrounds:** `bg-slate-50` (#F8FAFC)
- **Cards/Containers:** `bg-white`
- **Borders:** `border border-slate-200`
- **Text (Main):** `text-slate-900`
- **Text (Secondary):** `text-slate-700`
- **Text (Muted):** `text-slate-500`

### Reservation Status (Tape Chart)
- **Pending:** `bg-amber-50` + `text-amber-700`
- **Confirmed:** `bg-emerald-50` + `text-emerald-700`
- **Checked In:** `bg-emerald-100` + `text-emerald-800`
- **Checked Out:** `bg-slate-100` + `text-slate-600`
- **Cancelled:** `bg-red-50` + `text-red-700`

### Booking Channels
- **Airbnb:** `bg-emerald-500` (blocks), `bg-emerald-50` (badges)
- **Booking.com:** `bg-amber-500` (blocks), `bg-amber-50` (badges)
- **Direct:** `bg-indigo-500` (blocks), `bg-indigo-50` (badges)
- **Walk-In:** `bg-purple-500` (blocks), `bg-purple-50` (badges)

---

## 📝 Typography Quick Lookup

```
Page Title:        text-2xl font-semibold text-slate-900
Section Header:    text-lg font-semibold text-slate-900
Card Title:        text-base font-semibold text-slate-900
Stat Number:       text-2xl font-bold text-slate-900
Body Text:         text-sm text-slate-700
Label/Caption:     text-xs font-medium text-slate-600
Table Data:        text-xs text-slate-700
Small Label:       text-[10px] font-medium text-slate-500
```

---

## 🧱 Component Templates

### Stat Card
```html
<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
  <div>
    <p class="text-xs font-medium text-slate-500 uppercase tracking-wider">Label</p>
    <h3 class="text-2xl font-bold text-slate-900 mt-1">123</h3>
    <p class="text-xs text-emerald-600 font-medium mt-1">+5% vs last week</p>
  </div>
  <div class="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
    <i class="w-5 h-5"></i>
  </div>
</div>
```

### Status Badge
```html
<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
  Confirmed
</span>
```

### Primary Button
```html
<button class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors">
  Action
</button>
```

### Form Input
```html
<div>
  <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
  <input type="email" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
</div>
```

### Data Table
```html
<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
  <table class="w-full text-left border-collapse text-xs">
    <thead>
      <tr class="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-medium">
        <th class="p-3">Header 1</th>
        <th class="p-3">Header 2</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100 text-slate-700">
      <tr>
        <td class="p-3">Data</td>
        <td class="p-3">Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 📐 Spacing Quick Reference

```
Container padding:     p-4 (16px) or p-6 (24px)
Compact padding:       p-3 (12px)
Gap between items:     gap-4 or gap-6
Card borders:          border border-slate-200
Section margin:        space-y-6
```

---

## ✅ Design Checklist (Before Shipping)

- [ ] All text uses correct color from palette
- [ ] All borders are `border-slate-200` (1px)
- [ ] Card backgrounds are `white` with `shadow-sm`
- [ ] Status badges use correct color combinations
- [ ] Buttons have hover states
- [ ] Form inputs have focus states
- [ ] Tables use `text-xs` for data
- [ ] Page titles are `text-2xl font-semibold`
- [ ] Icons are correct size (`w-4 h-4`, `w-5 h-5`, etc.)
- [ ] Responsive classes used (`md:`, `lg:` prefixes)
- [ ] No inline styles (use Tailwind only)

---

## 🚀 Implementation Tips

1. **Always use CSS variables from design system** — Never hardcode colors
2. **Use Tailwind utilities** — Don't write custom CSS
3. **Mobile-first approach** — Design mobile, then add `md:` breakpoints
4. **Consistent spacing** — Use 4px/8px/12px/16px/24px increments
5. **Test contrast** — Ensure 4.5:1 ratio for normal text

---

**Need help?** See `DESIGN_SYSTEM.md` for complete documentation.
