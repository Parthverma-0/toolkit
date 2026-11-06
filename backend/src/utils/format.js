// Display helpers for generated reports

const inr = (n) => (n === undefined || n === null ? '-' : `Rs. ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const label = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-');

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '-');

module.exports = {
  inr, date, label, pct,
};
