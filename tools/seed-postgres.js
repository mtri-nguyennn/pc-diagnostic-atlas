const fs = require('fs');
const path = require('path');
const { getPool } = require('../lib/db');

const root = path.join(__dirname, '..');
const source = process.argv[2] || path.join(root, 'data', 'db.json');
const schema = fs.readFileSync(path.join(root, 'supabase', 'schema.sql'), 'utf8');
const db = JSON.parse(fs.readFileSync(source, 'utf8'));
const asJson = value => JSON.stringify(value);

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(schema);
    await client.query('truncate table session_events, repair_sessions, symptoms, flows, components, layers, app_metadata cascade');
    await client.query("insert into app_metadata (key, data) values ('app', $1::jsonb)", [asJson(db.meta || {})]);
    for (const layer of db.layers) await client.query('insert into layers (id, data) values ($1,$2::jsonb)', [layer.id, asJson(layer)]);
    for (const component of db.components) await client.query('insert into components (id, layer_id, name, path, data) values ($1,$2,$3,$4,$5::jsonb)', [component.id, component.layerId, component.name, component.path, asJson(component)]);
    for (const flow of db.flows) await client.query('insert into flows (id, layer_id, code, component_path, status, data) values ($1,$2,$3,$4,$5,$6::jsonb)', [flow.id, flow.layerId, flow.code, flow.componentPath || null, flow.status || null, asJson(flow)]);
    for (const symptom of db.symptoms) await client.query('insert into symptoms (id, layer_id, code, component_path, flow_id, data) values ($1,$2,$3,$4,$5,$6::jsonb)', [symptom.id, symptom.layerId, symptom.code, symptom.componentPath || null, symptom.flowId || null, asJson(symptom)]);
    for (const session of db.sessions || []) {
      const { events = [], ...sessionData } = session;
      await client.query('insert into repair_sessions (id, created_at, updated_at, data) values ($1,$2,$3,$4::jsonb)', [session.id, session.createdAt, session.updatedAt, asJson(sessionData)]);
      for (const event of events) await client.query('insert into session_events (id, session_id, created_at, data) values ($1,$2,$3,$4::jsonb)', [event.id, session.id, event.createdAt, asJson(event)]);
    }
    await client.query('commit');
    console.log(`Imported ${db.layers.length} layers, ${db.components.length} components, ${db.symptoms.length} symptoms, ${db.flows.length} flows, and ${(db.sessions || []).length} sessions from ${source}.`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
