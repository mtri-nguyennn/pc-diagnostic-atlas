const store = require('../../lib/store');
const { json, withHandler, method } = require('../../lib/http');

module.exports = withHandler(async (req, res) => {
  if (!method(req, res, 'POST')) return;
  json(res, 201, await store.createFlow(req.body || {}));
});
