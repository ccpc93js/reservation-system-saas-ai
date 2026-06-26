// Email notification templates and sender
// Uses Resend for email delivery

// For testing: use Resend's onboarding domain
// For production: verify your domain at https://resend.com/domains
const emailFromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";
const hostelName = "Hostmagsmart";

function generateEmailHTML(title: string, content: string, footer?: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2d5a3d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .content h2 { color: #2d5a3d; margin-top: 0; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #2d5a3d; margin: 15px 0; }
          .info-box strong { display: block; color: #2d5a3d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-box span { display: block; font-size: 16px; margin-top: 5px; }
          .cta-button { display: inline-block; background: #2d5a3d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 15px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${content}
            ${footer ? `<div class="footer">${footer}</div>` : ""}
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`
      : "http://localhost:3000/api/email/send";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        html,
        from: emailFromAddress,
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
  checkInDate: string
) {
  try {
    const html = generateEmailHTML(
      "Check-In Received",
      `
        <p>Hi ${guestName},</p>
        <p>Welcome to ${hostelName}! Your check-in information has been received.</p>
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
        <p>Thank you for choosing ${hostelName}!</p>
      `,
      `© 2026 ${hostelName}. All rights reserved.`
    );

    return await sendEmail(
      guestEmail,
      `Check-In Submitted - ${reservationNumber}`,
      html
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
  roomName?: string
) {
  try {
    const html = generateEmailHTML(
      "Check-In Approved ✓",
      `
        <p>Hi ${guestName},</p>
        <p>Your check-in has been verified and approved! Welcome to ${hostelName}.</p>
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
        <p>We look forward to hosting you at ${hostelName}! If you have any questions before your arrival, feel free to contact us.</p>
      `,
      `© 2026 ${hostelName}. All rights reserved.`
    );

    return await sendEmail(
      guestEmail,
      `Welcome! Check-In Approved - ${reservationNumber}`,
      html
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
  rejectionReason: string
) {
  try {
    const html = generateEmailHTML(
      "Action Required: Re-submit Your ID",
      `
        <p>Hi ${guestName},</p>
        <p>We need you to re-submit your ID photo to complete your check-in at ${hostelName}.</p>
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
      `© 2026 ${hostelName}. All rights reserved.`
    );

    return await sendEmail(
      guestEmail,
      `Action Required: Re-submit ID - ${reservationNumber}`,
      html
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
  totalAmount?: number
) {
  try {
    const html = generateEmailHTML(
      "Reservation Confirmed ✓",
      `
        <p>Hi ${guestName},</p>
        <p>Your reservation at ${hostelName} has been confirmed!</p>
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
        <p>Please complete your online check-in before your arrival date. You'll receive a separate check-in link shortly.</p>
      `,
      `© 2026 ${hostelName}. All rights reserved.`
    );

    return await sendEmail(
      guestEmail,
      `Reservation Confirmed - ${reservationNumber}`,
      html
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
  refundAmount?: number
) {
  try {
    const html = generateEmailHTML(
      "Reservation Cancelled",
      `
        <p>Hi ${guestName},</p>
        <p>Your reservation at ${hostelName} has been cancelled.</p>
        <div class="info-box">
          <strong>Reservation Number</strong>
          <span>${reservationNumber}</span>
        </div>
        ${refundAmount ? `<div class="info-box"><strong>Refund Amount</strong><span>$${refundAmount}</span></div>` : ""}
        <p>If you have any questions about this cancellation or your refund, please contact us at support@hostmagsmart.com</p>
        <p>We hope to see you again soon!</p>
      `,
      `© 2026 ${hostelName}. All rights reserved.`
    );

    return await sendEmail(
      guestEmail,
      `Reservation Cancelled - ${reservationNumber}`,
      html
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
  checkOutDate: string
) {
  try {
    const html = generateEmailHTML(
      "Check-Out Confirmed",
      `
        <p>Hi ${guestName},</p>
        <p>Thank you for staying at ${hostelName}! Your check-out has been confirmed.</p>
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
      `© 2026 ${hostelName}. All rights reserved.`
    );

    return await sendEmail(
      guestEmail,
      `Check-Out Confirmed - ${reservationNumber}`,
      html
    );
  } catch (error) {
    console.error("Failed to send checkout confirmation email:", error);
    return false;
  }
}
