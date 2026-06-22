// Email notification templates and sender
// Uses Supabase Auth or SendGrid/Resend based on config

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export async function sendCheckInSubmittedEmail(
  guestEmail: string,
  guestName: string,
  reservationNumber: string,
  checkInDate: string
) {
  try {
    // For now, just log - integrate with Resend/SendGrid later
    console.log(
      `[EMAIL] Check-in submitted notification sent to ${guestEmail}`
    );
    console.log(`Guest: ${guestName}`);
    console.log(`Reservation: ${reservationNumber}`);
    console.log(`Check-in: ${checkInDate}`);

    // TODO: Integrate with email service
    // const response = await fetch('/api/email/send', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     to: guestEmail,
    //     subject: `Check-In Submitted - ${reservationNumber}`,
    //     template: 'check-in-submitted',
    //     data: { guestName, reservationNumber, checkInDate }
    //   })
    // });
    // return response.ok;
    return true;
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
    console.log(
      `[EMAIL] Check-in approved notification sent to ${guestEmail}`
    );
    console.log(`Guest: ${guestName}`);
    console.log(`Reservation: ${reservationNumber}`);
    console.log(`Status: APPROVED`);

    // TODO: Integrate with email service
    return true;
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
    console.log(
      `[EMAIL] Check-in rejection notification sent to ${guestEmail}`
    );
    console.log(`Guest: ${guestName}`);
    console.log(`Reservation: ${reservationNumber}`);
    console.log(`Reason: ${rejectionReason}`);

    // TODO: Integrate with email service
    return true;
  } catch (error) {
    console.error("Failed to send check-in rejected email:", error);
    return false;
  }
}

// Email template content (for reference)
export const emailTemplates = {
  checkInSubmitted: (data: {
    guestName: string;
    reservationNumber: string;
    checkInDate: string;
  }) => ({
    subject: `Check-In Submitted - ${data.reservationNumber}`,
    html: `
      <h2>Check-In Received</h2>
      <p>Hi ${data.guestName},</p>
      <p>Your check-in information has been received for reservation ${data.reservationNumber}.</p>
      <p>Our staff will verify your ID within 24 hours and send you a confirmation email.</p>
      <p><strong>Check-in Date:</strong> ${new Date(data.checkInDate).toLocaleDateString()}</p>
    `,
  }),

  checkInApproved: (data: {
    guestName: string;
    reservationNumber: string;
    checkInDate: string;
    roomName?: string;
  }) => ({
    subject: `Welcome! Check-In Approved - ${data.reservationNumber}`,
    html: `
      <h2>Check-In Approved ✓</h2>
      <p>Hi ${data.guestName},</p>
      <p>Your check-in has been verified and approved!</p>
      <p><strong>Reservation:</strong> ${data.reservationNumber}</p>
      <p><strong>Check-in Date:</strong> ${new Date(data.checkInDate).toLocaleDateString()}</p>
      ${data.roomName ? `<p><strong>Room:</strong> ${data.roomName}</p>` : ""}
      <p>Welcome! We look forward to your stay.</p>
    `,
  }),

  checkInRejected: (data: {
    guestName: string;
    reservationNumber: string;
    rejectionReason: string;
  }) => ({
    subject: `Action Required: Re-submit ID - ${data.reservationNumber}`,
    html: `
      <h2>ID Verification Needed</h2>
      <p>Hi ${data.guestName},</p>
      <p>We need you to re-submit your ID photo. Reason: ${data.rejectionReason}</p>
      <p><strong>Reservation:</strong> ${data.reservationNumber}</p>
      <p>Please visit your check-in link to upload a clearer photo.</p>
    `,
  }),
};
