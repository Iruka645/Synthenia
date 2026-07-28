function originGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowed.has(origin)) return next();
    return res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed' } });
  };
}

module.exports = originGuard;
