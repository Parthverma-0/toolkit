// Indian financial year: "2025-26" = 1 Apr 2025 .. 31 Mar 2026

const FY_REGEX = /^(\d{4})-(\d{2})$/;

const isValidFy = (fy) => {
  const m = FY_REGEX.exec(fy || '');
  return Boolean(m) && (Number(m[1]) + 1) % 100 === Number(m[2]);
};

const fyRange = (fy) => {
  const start = Number(FY_REGEX.exec(fy)[1]);
  return { from: new Date(start, 3, 1), to: new Date(start + 1, 2, 31, 23, 59, 59, 999) };
};

const fyOf = (date) => {
  const d = new Date(date);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

module.exports = { isValidFy, fyRange, fyOf };
