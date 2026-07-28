const apiKeyAuth = require('./apiKeyAuth');

// Kept separate so local API-key auth can later become a short-lived session token
// without changing every route declaration.
const resourceAuth = apiKeyAuth;
const adminAuth = apiKeyAuth;

module.exports = { resourceAuth, adminAuth };
