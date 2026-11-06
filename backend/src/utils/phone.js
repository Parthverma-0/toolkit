// Normalizes Indian numbers to E.164 (+91XXXXXXXXXX); accepts other E.164 numbers as-is
const normalizePhone = (raw) => {
  const digits = String(raw).replace(/[\s\-()]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
};

module.exports = { normalizePhone };
