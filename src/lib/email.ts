// Email notification templates and sender
// Uses Resend for email delivery
import { getSiteOrigin } from "./site-url";
import { generateGuestPortalLink, generateQRCodeUrl } from "./qr-code";

export type EmailBranding = { logoUrl?: string | null; name?: string | null; email?: string | null };

// For testing: use Resend's onboarding domain
// For production: verify your domain at https://resend.com/domains
const emailFromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";
const hostelName = "Hostmagsmart";

// Fetch a tenant org's name + logo so emails can be branded with it (falls back
// to HostMagSmart when the org has none). Accepts any Supabase client.
export async function getOrgBranding(
  supabase: { from: (t: string) => any },
  orgId: string | null | undefined
): Promise<EmailBranding> {
  if (!orgId) return {};
  try {
    const { data } = await supabase
      .from("organizations")
      .select("name, logo_url, email")
      .eq("id", orgId)
      .single();
    const row = data as { name?: string | null; logo_url?: string | null; email?: string | null } | null;
    return { logoUrl: row?.logo_url ?? null, name: row?.name ?? null, email: row?.email ?? null };
  } catch {
    return {};
  }
}

export function generateEmailHTML(title: string, content: string, footer?: string, logoUrl?: string | null): string {
  const origin = getSiteOrigin();
  const logoSrc = logoUrl || `${origin}/botanical/logo.png`;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; background: #F3EEE2; font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #2A2823; }
          .wrap { padding: 32px 16px; }
          .container { max-width: 600px; margin: 0 auto; background: #FBF8F1; border: 1px solid #E7DFCE; border-radius: 16px; overflow: hidden; }
          .header { background: #5F7048; padding: 28px 32px; text-align: center; }
          .header img { height: 40px; width: auto; margin-bottom: 10px; display: inline-block; }
          .header h1 { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-weight: 600; font-size: 24px; color: #F3EEE2; letter-spacing: -0.01em; }
          .content { padding: 32px; }
          .content h2 { font-family: Georgia, 'Times New Roman', serif; color: #2A2823; margin-top: 0; font-weight: 600; font-size: 20px; }
          .content p { color: #3f3b33; }
          .info-box { background: #F3EEE2; padding: 16px 18px; border-left: 3px solid #5F7048; border-radius: 8px; margin: 16px 0; }
          .info-box strong { display: block; color: #5F7048; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
          .info-box span { display: block; font-size: 16px; margin-top: 4px; color: #2A2823; }
          .cta-button { display: inline-block; background: #5F7048; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 16px 0; }
          .footer { text-align: center; color: #7C776B; font-size: 12px; margin-top: 28px; padding-top: 20px; border-top: 1px solid #E7DFCE; }
          a { color: #4C5B3A; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="container">
            <div class="header">
              <img src="${logoSrc}" alt="Property logo" />
              <h1>${title}</h1>
            </div>
            <div class="content">
              ${content}
              ${footer ? `<div class="footer">${footer}</div>` : ""}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { fromName?: string | null; replyTo?: string | null }
): Promise<boolean> {
  try {
    const origin = getSiteOrigin();
    const apiUrl = `${origin}/api/email/send`;

    // Property name as the friendly display name over a stable sending address,
    // e.g. `Hostel Downtown Inn <noreply@hostmagsmart.com>`. Sanitize the name so
    // it can't break the header.
    const cleanName = (opts?.fromName || "").replace(/["<>\r\n,]/g, "").trim();
    const from = cleanName ? `${cleanName} <${emailFromAddress}>` : emailFromAddress;
    const replyTo = opts?.replyTo && /.+@.+\..+/.test(opts.replyTo) ? opts.replyTo : undefined;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        html,
        from,
        replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`Email send failed to ${to}:`, error);
      return false;
    }

    const result = await response.json();
    if (result.fallback) {
      console.log(`[EMAIL FALLBACK] Sent to ${to}: ${subject}`);
    } else {
      console.log(`[EMAIL SENT] ${result.id} to ${to}`);
    }
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

export async function sendCheckInSubmittedEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  checkInDate: string,
  branding?: EmailBranding
) {
  try {
    const brandName = branding?.name || hostelName;
    const html = generateEmailHTML(
      "Check-In Received",
      `
        <p>Hi ${guestName},</p>
        <p>Welcome to ${brandName}! Your check-in information has been received.</p>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        <div class="info-box">
          <strong>Check-in Date</strong>
          <span>${new Date(checkInDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</span>
        </div>
        <p>Our staff will verify your ID within 24 hours and send you a confirmation email.</p>
        <p>Thank you for choosing ${brandName}!</p>
      `,
      `© 2026 ${brandName}. All rights reserved.`,
      branding?.logoUrl
    );

    return await sendEmail(
      guestEmail,
      `Check-In Submitted - ${reservationNumber}`,
      html,
      { fromName: brandName, replyTo: branding?.email }
    );
  } catch (error) {
    console.error("Failed to send check-in submitted email:", error);
    return false;
  }
}

export async function sendCheckInApprovedEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  checkInDate: string,
  roomName?: string,
  branding?: EmailBranding
) {
  try {
    const brandName = branding?.name || hostelName;
    const html = generateEmailHTML(
      "Check-In Approved ✓",
      `
        <p>Hi ${guestName},</p>
        <p>Your check-in has been verified and approved! Welcome to ${brandName}.</p>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        <div class="info-box">
          <strong>Check-in Date</strong>
          <span>${new Date(checkInDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</span>
        </div>
        ${
          roomName
            ? `
          <div class="info-box">
            <strong>Room</strong>
            <span>${roomName}</span>
          </div>
        `
            : ""
        }
        <p>We look forward to hosting you at ${brandName}! If you have any questions before your arrival, feel free to contact us.</p>
      `,
      `© 2026 ${brandName}. All rights reserved.`,
      branding?.logoUrl
    );

    return await sendEmail(
      guestEmail,
      `Welcome! Check-In Approved - ${reservationNumber}`,
      html,
      { fromName: brandName, replyTo: branding?.email }
    );
  } catch (error) {
    console.error("Failed to send check-in approved email:", error);
    return false;
  }
}

export async function sendCheckInRejectedEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  rejectionReason: string,
  branding?: EmailBranding
) {
  try {
    const brandName = branding?.name || hostelName;
    const html = generateEmailHTML(
      "Action Required: Re-submit Your ID",
      `
        <p>Hi ${guestName},</p>
        <p>We need you to re-submit your ID photo to complete your check-in at ${brandName}.</p>
        <div class="info-box">
          <strong>Reason</strong>
          <span>${rejectionReason}</span>
        </div>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        <p>Please use your check-in link to upload a clearer photo that meets the requirements.</p>
        <p>If you have any questions, please contact us at support@hostmagsmart.com</p>
      `,
      `© 2026 ${brandName}. All rights reserved.`,
      branding?.logoUrl
    );

    return await sendEmail(
      guestEmail,
      `Action Required: Re-submit ID - ${reservationNumber}`,
      html,
      { fromName: brandName, replyTo: branding?.email }
    );
  } catch (error) {
    console.error("Failed to send check-in rejected email:", error);
    return false;
  }
}

export async function sendReservationConfirmationEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  checkInDate: string,
  checkOutDate: string,
  roomName?: string,
  totalAmount?: number,
  branding?: EmailBranding,
  checkInToken?: string | null
) {
  try {
    const brandName = branding?.name || hostelName;
    const checkInUrl = checkInToken ? generateGuestPortalLink(checkInToken) : null;
    const qrUrl = checkInToken ? generateQRCodeUrl(checkInToken) : null;
    const html = generateEmailHTML(
      "Reservation Confirmed ✓",
      `
        <p>Hi ${guestName},</p>
        <p>Your reservation at ${brandName} has been confirmed!</p>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        <div class="info-box">
          <strong>Check-in Date</strong>
          <span>${new Date(checkInDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</span>
        </div>
        <div class="info-box">
          <strong>Check-out Date</strong>
          <span>${new Date(checkOutDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</span>
        </div>
        ${roomName ? `<div class="info-box"><strong>Room</strong><span>${roomName}</span></div>` : ""}
        ${totalAmount ? `<div class="info-box"><strong>Total Amount</strong><span>$${totalAmount}</span></div>` : ""}
        ${
          checkInUrl
            ? `
        <p style="margin-top:20px">Save time at the front desk — complete your online check-in before you arrive:</p>
        <p style="text-align:center;margin:18px 0"><a href="${checkInUrl}" class="cta-button">Start online check-in</a></p>
        <p style="text-align:center;color:#7C776B;font-size:12px;margin:0 0 8px">Or scan this QR code with your phone:</p>
        <p style="text-align:center"><img src="${qrUrl}" alt="Online check-in QR code" width="180" height="180" style="border-radius:12px;border:1px solid #E7DFCE" /></p>
        <p style="text-align:center;color:#7C776B;font-size:11px;word-break:break-all">${checkInUrl}</p>
        `
            : `<p>Please complete your online check-in before your arrival date. You'll receive a separate check-in link shortly.</p>`
        }
      `,
      `© 2026 ${brandName}. All rights reserved.`,
      branding?.logoUrl
    );

    return await sendEmail(
      guestEmail,
      `Reservation Confirmed - ${reservationNumber}`,
      html,
      { fromName: brandName, replyTo: branding?.email }
    );
  } catch (error) {
    console.error("Failed to send reservation confirmation email:", error);
    return false;
  }
}

export async function sendReservationCancelledEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  refundAmount?: number,
  branding?: EmailBranding
) {
  try {
    const brandName = branding?.name || hostelName;
    const html = generateEmailHTML(
      "Reservation Cancelled",
      `
        <p>Hi ${guestName},</p>
        <p>Your reservation at ${brandName} has been cancelled.</p>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        ${refundAmount ? `<div class="info-box"><strong>Refund Amount</strong><span>$${refundAmount}</span></div>` : ""}
        <p>If you have any questions about this cancellation or your refund, please contact us at support@hostmagsmart.com</p>
        <p>We hope to see you again soon!</p>
      `,
      `© 2026 ${brandName}. All rights reserved.`,
      branding?.logoUrl
    );

    return await sendEmail(
      guestEmail,
      `Reservation Cancelled - ${reservationNumber}`,
      html,
      { fromName: brandName, replyTo: branding?.email }
    );
  } catch (error) {
    console.error("Failed to send reservation cancelled email:", error);
    return false;
  }
}

export async function sendCheckoutConfirmationEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  checkOutDate: string,
  branding?: EmailBranding
) {
  try {
    const brandName = branding?.name || hostelName;
    const html = generateEmailHTML(
      "Check-Out Confirmed",
      `
        <p>Hi ${guestName},</p>
        <p>Thank you for staying at ${brandName}! Your check-out has been confirmed.</p>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        <div class="info-box">
          <strong>Check-out Date</strong>
          <span>${new Date(checkOutDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</span>
        </div>
        <p>We hope you enjoyed your stay! Please share your feedback by replying to this email.</p>
        <p>Visit us again soon!</p>
      `,
      `© 2026 ${brandName}. All rights reserved.`,
      branding?.logoUrl
    );

    return await sendEmail(
      guestEmail,
      `Check-Out Confirmed - ${reservationNumber}`,
      html,
      { fromName: brandName, replyTo: branding?.email }
    );
  } catch (error) {
    console.error("Failed to send checkout confirmation email:", error);
    return false;
  }
}
