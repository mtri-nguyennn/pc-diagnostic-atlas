const store = require('../../lib/store');
const { json, withHandler, method } = require('../../lib/http');

module.exports = withHandler(async (req, res) => {
  if (!method(req, res, 'PUT')) return;
  json(res, 200, await store.updateFlow(req.query.id, req.body || {}));
});
