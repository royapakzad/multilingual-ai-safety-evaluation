// services/emailService.ts
//
// Sends notification emails via EmailJS (https://www.emailjs.com) — a free
// tier that sends email straight from the browser, so no backend server is
// needed for this.
//
// SETUP (one-time, by the admin):
//   1. Create a free account at emailjs.com and connect an email service
//      (e.g. Gmail) to send FROM.
//   2. Create two email templates:
//      - "New access request" template: use {{requester_email}} and
//        {{purpose}} variables, sent to rpakzad@taraazresearch.org.
//      - "Account approved" template: use {{to_email}} and
//        {{temp_password}} variables, sent to the new user.
//   3. Replace the placeholder IDs below with your Service ID, the two
//      Template IDs, and your Public Key (all found in the EmailJS
//      dashboard under Account > General).
//
// Until these are replaced, sending silently fails (caught by callers) —
// access requests still work via the in-app Pending Requests panel.
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_1qip2hy';
const EMAILJS_NEW_REQUEST_TEMPLATE_ID = 'template_dfp539k';
const EMAILJS_APPROVED_TEMPLATE_ID = 'template_kdzem9b';
const EMAILJS_PUBLIC_KEY = 'GTvqTJUSnMjvEK0Jz';

const ADMIN_EMAIL = 'rpakzad@taraazresearch.org';

const isConfigured = (): boolean =>
  EMAILJS_SERVICE_ID !== 'YOUR_EMAILJS_SERVICE_ID' &&
  EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY';

export const notifyAdminOfNewRequest = async (requesterEmail: string, purpose: string): Promise<void> => {
  if (!isConfigured()) return;
  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_NEW_REQUEST_TEMPLATE_ID,
    { to_email: ADMIN_EMAIL, requester_email: requesterEmail, purpose },
    { publicKey: EMAILJS_PUBLIC_KEY }
  );
};

export const notifyUserOfApproval = async (userEmail: string, tempPassword: string): Promise<void> => {
  if (!isConfigured()) return;
  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_APPROVED_TEMPLATE_ID,
    { to_email: userEmail, temp_password: tempPassword },
    { publicKey: EMAILJS_PUBLIC_KEY }
  );
};
