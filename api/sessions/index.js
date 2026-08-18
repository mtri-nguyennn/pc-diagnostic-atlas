const store = require('../../lib/store');
const { json, withHandler, method } = require('../../lib/http');

module.exports = withHandler(async (req, res) => {
  if (req.method === 'GET') return json(res, 200, (await store.readDB()).sessions);
  if (req.method === 'POST') return json(res, 201, await store.createSession(req.body || {}));
  method(req, res, 'GET');
});
