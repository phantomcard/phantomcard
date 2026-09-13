const PAYSTACK_PAYMENT_EMAILS = Object.freeze([
  'danny700218+1@gmail.com',
  'danny700218+2@gmail.com',
]);

function normalizePaymentEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isAllowedPaystackPaymentEmail(value) {
  return PAYSTACK_PAYMENT_EMAILS.includes(normalizePaymentEmail(value));
}

module.exports = {
  PAYSTACK_PAYMENT_EMAILS,
  normalizePaymentEmail,
  isAllowedPaystackPaymentEmail,
};
