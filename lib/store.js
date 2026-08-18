const crypto = require('crypto');
const { getPool, query } = require('./db');

const json = value => JSON.stringify(value);
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

async function readDB() {
  const [meta, layers, components, symptoms, flows, sessions, events] = await Promise.all([
    query("select data from app_metadata where key = 'app'"),
    query('select data from layers order by id'),
    query('select data from components order by layer_id, path'),
    query('select data from symptoms order by layer_id, code, id'),
    query('select data from flows order by layer_id, code, id'),
    query('select id, data from repair_sessions order by created_at desc'),
    query('select session_id, data from session_events order by created_at'),
  ]);
  const eventsBySession = new Map();
  for (const row of events.rows) {
    const items = eventsBySession.get(row.session_id) || [];
    items.push(row.data);
    eventsBySession.set(row.session_id, items);
  }
  return {
    meta: meta.rows[0]?.data || {},
    layers: layers.rows.map(row => row.data),
    components: components.rows.map(row => row.data),
    symptoms: symptoms.rows.map(row => row.data),
    flows: flows.rows.map(row => row.data),
    sessions: sessions.rows.map(row => ({ ...row.data, events: eventsBySession.get(row.id) || [] })),
  };
}

async function search(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return [];
  const pattern = `%${q}%`;
  const [symptoms, components] = await Promise.all([
    query(`select s.data, f.status
      from symptoms s left join flows f on f.id = s.flow_id
      where s.code ilike $1 or s.component_path ilike $1 or s.data::text ilike $1 or f.data::text ilike $1
      order by s.layer_id, s.code limit 50`, [pattern]),
    query(`select data from components
      where name ilike $1 or path ilike $1 or data::text ilike $1
      order by layer_id, path limit 50`, [pattern]),
  ]);
  return [
    ...symptoms.rows.map(row => ({ ...row.data, type: 'symptom', flowStatus: row.status })),
    ...components.rows.map(row => ({ ...row.data, type: 'component' })),
  ].slice(0, 50);
}

async function createFlow(body) {
  const required = ['layerId', 'code', 'title', 'component', 'symptom', 'hypothesis', 'test', 'observe'];
  const missing = required.filter(key => body[key] === undefined || body[key] === '');
  if (missing.length) {
    const error = new Error('Missing required fields');
    error.statusCode = 400;
    error.details = { missing };
    throw error;
  }
  const flow = {
    id: id('FLOW'), codes: body.codes || [body.code], componentPath: body.componentPath || body.component,
    sourceSection: 'Admin-created', symptomDescription: body.symptomDescription || body.symptom,
    yesOutcome: body.yesOutcome || '', noOutcome: body.noOutcome || '', repair: body.repair || '', verify: body.verify || '',
    notes: body.notes || '', references: body.references || [], sourceDocument: 'Admin', status: 'admin-created',
    difficulty: body.difficulty || 'Standard', rawFlow: [], ...body,
  };
  flow.layerId = Number(flow.layerId);
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('insert into flows (id, layer_id, code, component_path, status, data) values ($1,$2,$3,$4,$5,$6::jsonb)',
      [flow.id, flow.layerId, flow.code, flow.componentPath, flow.status, json(flow)]);
    const existing = await client.query('select id from symptoms where layer_id = $1 and code = $2', [flow.layerId, flow.code]);
    if (!existing.rowCount) {
      const symptom = { id: `L${flow.layerId}-${flow.code}-${Date.now().toString(36)}`, layerId: flow.layerId, code: flow.code, title: flow.title, component: flow.component, componentPath: flow.componentPath, flowId: flow.id };
      await client.query('insert into symptoms (id, layer_id, code, component_path, flow_id, data) values ($1,$2,$3,$4,$5,$6::jsonb)',
        [symptom.id, symptom.layerId, symptom.code, symptom.componentPath, symptom.flowId, json(symptom)]);
    }
    await client.query('commit');
    return flow;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

async function updateFlow(flowId, body) {
  const result = await query('select data from flows where id = $1', [flowId]);
  if (!result.rowCount) { const error = new Error('Flow not found'); error.statusCode = 404; throw error; }
  const flow = { ...result.rows[0].data, ...body, id: flowId, layerId: Number(body.layerId ?? result.rows[0].data.layerId), updatedAt: now() };
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('update flows set layer_id=$2, code=$3, component_path=$4, status=$5, data=$6::jsonb where id=$1',
      [flowId, flow.layerId, flow.code, flow.componentPath || flow.component, flow.status, json(flow)]);
    await client.query(`update symptoms set component_path=$2, data=jsonb_set(jsonb_set(jsonb_set(data, '{title}', to_jsonb($3::text)), '{component}', to_jsonb($4::text)), '{componentPath}', to_jsonb($2::text)) where flow_id=$1`,
      [flowId, flow.componentPath || flow.component, flow.title, flow.component]);
    await client.query('commit');
    return flow;
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}

async function createSession(body) {
  const session = { id: id('CASE'), createdAt: now(), updatedAt: now(), status: 'Open', device: body.device || '', brand: body.brand || '', model: body.model || '', notes: body.notes || '', symptomId: body.symptomId || '', flowId: body.flowId || '', events: [] };
  await query('insert into repair_sessions (id, created_at, updated_at, data) values ($1,$2,$3,$4::jsonb)', [session.id, session.createdAt, session.updatedAt, json(session)]);
  return session;
}

async function addEvent(sessionId, body) {
  const found = await query('select id from repair_sessions where id=$1', [sessionId]);
  if (!found.rowCount) { const error = new Error('Session not found'); error.statusCode = 404; throw error; }
  const event = { id: id('EV'), createdAt: now(), ...body };
  await Promise.all([
    query('insert into session_events (id, session_id, created_at, data) values ($1,$2,$3,$4::jsonb)', [event.id, sessionId, event.createdAt, json(event)]),
    query("update repair_sessions set updated_at=$2, data=jsonb_set(data, '{updatedAt}', to_jsonb($2::text)) where id=$1", [sessionId, event.createdAt]),
  ]);
  return event;
}

async function updateSession(sessionId, body) {
  const result = await query('select data from repair_sessions where id=$1', [sessionId]);
  if (!result.rowCount) { const error = new Error('Session not found'); error.statusCode = 404; throw error; }
  const session = { ...result.rows[0].data, ...body, id: sessionId, updatedAt: now() };
  await query('update repair_sessions set updated_at=$2, data=$3::jsonb where id=$1', [sessionId, session.updatedAt, json(session)]);
  return session;
}

module.exports = { readDB, search, createFlow, updateFlow, createSession, addEvent, updateSession };
