// Copies only the listed keys that are present (not undefined) on obj
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// doc.set(updates), but keys listed in nestedKeys are merged via dotted paths
// so a PATCH of { address: { city } } keeps the other address fields.
const applyUpdates = (doc, updates, nestedKeys = []) => {
  const rest = { ...updates };
  nestedKeys.forEach((key) => {
    if (!rest[key]) return;
    Object.entries(rest[key]).forEach(([k, v]) => doc.set(`${key}.${k}`, v));
    delete rest[key];
  });
  doc.set(rest);
  return doc;
};

module.exports = { pick, applyUpdates };
