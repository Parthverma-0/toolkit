const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const routes = require('./routes');
const { UPLOAD_ROOT } = require('./services/storage.service');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.set('trust proxy', 1); // correct client IP for rate limiting behind a proxy
// cross-origin so the frontend (different port/domain) can load /uploads images & videos
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Investor verification documents are private: never served statically, only through the
// authenticated document routes (owner and admins).
app.use('/uploads/investor-docs', (req, res) => res.status(404).json({ success: false, message: 'Not found' }));
app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d' }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
