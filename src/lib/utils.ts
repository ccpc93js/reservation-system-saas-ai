import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui's cn() utility — merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format short date
export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Get number of nights between two dates
export function getNights(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// Status label map
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No show",
};

// Channel label map
export const CHANNEL_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  email: "Email",
  booking_com: "Booking.com",
  airbnb: "Airbnb",
  hostelworld: "Hostelworld",
  direct_website: "Website",
  other: "Other",
};
