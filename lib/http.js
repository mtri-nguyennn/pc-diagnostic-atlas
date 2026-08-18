function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(data);
}

function withHandler(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error(error);
      return json(res, error.statusCode || 500, { error: error.message || 'Server error', ...(error.details || {}) });
    }
  };
}

function method(req, res, expected) {
  if (req.method === expected) return true;
  json(res, 405, { error: `Method ${req.method} not allowed` });
  return false;
}

module.exports = { json, withHandler, method };
