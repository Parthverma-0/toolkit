// Throw from controllers/services; errorHandler turns it into a JSON response
class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code; // machine-readable, e.g. ACCOUNT_NOT_FOUND, for the frontend to branch on
  }

  withCode(code) {
    this.code = code;
    return this;
  }

  static badRequest(msg, details) { return new ApiError(400, msg, details); }

  static unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg); }

  static forbidden(msg = 'You do not have access to this resource') { return new ApiError(403, msg); }

  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }

  static conflict(msg) { return new ApiError(409, msg); }

  static tooMany(msg) { return new ApiError(429, msg); }
}

module.exports = ApiError;
