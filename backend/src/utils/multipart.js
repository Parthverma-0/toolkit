// Multipart forms send every field as a string. These sanitizers let clients
// send arrays/objects either as JSON strings or as repeated/comma-separated fields.

const toArray = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (str.startsWith('[')) {
    try { return JSON.parse(str); } catch { /* fall through */ }
  }
  return str.split(',').map((v) => v.trim()).filter(Boolean);
};

const toJson = (value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

module.exports = { toArray, toJson };
