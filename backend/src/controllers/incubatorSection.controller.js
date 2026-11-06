const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { toPublicUrl, removeFile } = require('../services/storage.service');

// CRUD for the embedded profile lists on Incubator: services, policies, accessibilities.
// Policies may carry an uploaded PDF (`document` field).
const SECTION_FIELDS = {
  services: ['name', 'description', 'isPaid'],
  policies: ['title', 'description'],
  accessibilities: ['type', 'name', 'description', 'isAvailable'],
};

const makeSectionController = (section) => {
  const fields = SECTION_FIELDS[section];
  const uploadedDocument = (req) => {
    const file = req.files?.document?.[0];
    if (file && section !== 'policies') throw ApiError.badRequest('Documents can only be attached to policies');
    return file;
  };
  const findItem = (req) => {
    const item = req.incubator[section].id(req.params.itemId);
    if (!item) throw ApiError.notFound('Item not found');
    return item;
  };

  return {
    // GET /api/incubators/me/:section
    list: (req, res) => res.json({ success: true, data: req.incubator[section] }),

    // POST /api/incubators/me/:section
    create: asyncHandler(async (req, res) => {
      const data = pick(req.body, fields);
      const file = uploadedDocument(req);
      if (file) data.documentUrl = toPublicUrl(file);

      req.incubator[section].push(data);
      await req.incubator.save();
      res.status(201).json({ success: true, data: req.incubator[section].at(-1) });
    }),

    // PATCH /api/incubators/me/:section/:itemId
    update: asyncHandler(async (req, res) => {
      const item = findItem(req);
      const data = pick(req.body, fields);
      const file = uploadedDocument(req);
      const oldDocument = item.documentUrl;
      if (file) data.documentUrl = toPublicUrl(file);

      item.set(data);
      await req.incubator.save();
      if (file && oldDocument) await removeFile(oldDocument);
      res.json({ success: true, data: item });
    }),

    // DELETE /api/incubators/me/:section/:itemId
    remove: asyncHandler(async (req, res) => {
      const item = findItem(req);
      const { documentUrl } = item;
      item.deleteOne();
      await req.incubator.save();
      await removeFile(documentUrl);
      res.json({ success: true, message: 'Item removed' });
    }),
  };
};

module.exports = {
  SECTIONS: Object.keys(SECTION_FIELDS),
  makeSectionController,
};
