const store = require('../lib/store');
const { json, withHandler, method } = require('../lib/http');

module.exports = withHandler(async (req, res) => {
  if (!method(req, res, 'GET')) return;
  json(res, 200, await store.readDB());
});
