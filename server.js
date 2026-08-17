const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB_PATH = path.join(ROOT, 'data', 'db.json');

function readDB(){ return JSON.parse(fs.readFileSync(DB_PATH,'utf8')); }
function writeDB(db){
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db,null,2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}
function json(res,status,data){
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
function parseBody(req){
  return new Promise((resolve,reject)=>{
    let body='';
    req.on('data',c=>{ body+=c; if(body.length>2_000_000) req.destroy(); });
    req.on('end',()=>{ try { resolve(body?JSON.parse(body):{}); } catch(e){ reject(e); } });
    req.on('error',reject);
  });
}
function id(prefix){ return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`; }
function safePath(urlPath){
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if(p==='/' || !path.extname(p)) p='/index.html';
  const full=path.normalize(path.join(PUBLIC,p));
  if(!full.startsWith(PUBLIC)) return null;
  return full;
}
function mime(file){
  const ext=path.extname(file).toLowerCase();
  return ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'})[ext] || 'application/octet-stream';
}

const server=http.createServer(async (req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host || 'localhost'}`);
    const p=u.pathname;
    if(p==='/api/db' && req.method==='GET'){
      return json(res,200,readDB());
    }
    if(p==='/api/search' && req.method==='GET'){
      const q=(u.searchParams.get('q')||'').trim().toLowerCase();
      const db=readDB();
      if(!q) return json(res,200,[]);
      const results=[];
      for(const s of db.symptoms){
        const f=db.flows.find(x=>x.id===s.flowId);
        const hay=[s.code,s.title,s.component,s.componentPath,f?.hypothesis,f?.test,f?.observe,f?.notes].filter(Boolean).join(' ').toLowerCase();
        if(hay.includes(q)) results.push({...s,type:'symptom',flowStatus:f?.status});
      }
      for(const c of db.components){
        if([c.name,c.path].join(' ').toLowerCase().includes(q)) results.push({...c,type:'component'});
      }
      return json(res,200,results.slice(0,50));
    }
    if(p==='/api/flows' && req.method==='POST'){
      const body=await parseBody(req); const db=readDB();
      const required=['layerId','code','title','component','symptom','hypothesis','test','observe'];
      const missing=required.filter(k=>body[k]===undefined || body[k]==='');
      if(missing.length) return json(res,400,{error:'Missing required fields',missing});
      const flow={
        id:id('FLOW'), codes: body.codes || [body.code], componentPath:body.componentPath||body.component,
        sourceSection:'Admin-created', symptomDescription:body.symptomDescription||body.symptom,
        yesOutcome:body.yesOutcome||'', noOutcome:body.noOutcome||'', repair:body.repair||'', verify:body.verify||'', notes:body.notes||'',
        references:body.references||[], sourceDocument:'Admin', status:'admin-created', difficulty:body.difficulty||'Standard', rawFlow:[],
        ...body
      };
      db.flows.unshift(flow);
      // add symptom index item if code doesn't exist for layer
      if(!db.symptoms.some(s=>s.layerId===Number(flow.layerId)&&s.code===flow.code)){
        const sym={id:`L${flow.layerId}-${flow.code}-${Date.now().toString(36)}`,layerId:Number(flow.layerId),code:flow.code,title:flow.title,component:flow.component,componentPath:flow.componentPath,flowId:flow.id};
        db.symptoms.push(sym);
      }
      writeDB(db); return json(res,201,flow);
    }
    const flowMatch=p.match(/^\/api\/flows\/([^/]+)$/);
    if(flowMatch && req.method==='PUT'){
      const body=await parseBody(req); const db=readDB();
      const i=db.flows.findIndex(f=>f.id===flowMatch[1]);
      if(i<0) return json(res,404,{error:'Flow not found'});
      db.flows[i]={...db.flows[i],...body,id:db.flows[i].id,updatedAt:new Date().toISOString()};
      const f=db.flows[i];
      for(const s of db.symptoms.filter(s=>s.flowId===f.id)){
        s.title=f.title||s.title; s.component=f.component||s.component; s.componentPath=f.componentPath||s.componentPath;
      }
      writeDB(db); return json(res,200,db.flows[i]);
    }
    if(p==='/api/sessions' && req.method==='GET') return json(res,200,readDB().sessions || []);
    if(p==='/api/sessions' && req.method==='POST'){
      const body=await parseBody(req); const db=readDB();
      const session={id:id('CASE'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'Open',device:body.device||'',brand:body.brand||'',model:body.model||'',notes:body.notes||'',symptomId:body.symptomId||'',flowId:body.flowId||'',events:[]};
      db.sessions=db.sessions||[]; db.sessions.unshift(session); writeDB(db); return json(res,201,session);
    }
    const eventMatch=p.match(/^\/api\/sessions\/([^/]+)\/events$/);
    if(eventMatch && req.method==='POST'){
      const body=await parseBody(req); const db=readDB();
      const s=(db.sessions||[]).find(x=>x.id===eventMatch[1]);
      if(!s) return json(res,404,{error:'Session not found'});
      const ev={id:id('EV'),createdAt:new Date().toISOString(),...body}; s.events.push(ev); s.updatedAt=new Date().toISOString(); writeDB(db); return json(res,201,ev);
    }
    const sessionMatch=p.match(/^\/api\/sessions\/([^/]+)$/);
    if(sessionMatch && req.method==='PATCH'){
      const body=await parseBody(req); const db=readDB(); const s=(db.sessions||[]).find(x=>x.id===sessionMatch[1]);
      if(!s) return json(res,404,{error:'Session not found'});
      Object.assign(s,body,{id:s.id,updatedAt:new Date().toISOString()}); writeDB(db); return json(res,200,s);
    }

    const file=safePath(p);
    if(!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200,{'Content-Type':mime(file)}); fs.createReadStream(file).pipe(res);
  }catch(err){ console.error(err); json(res,500,{error:'Server error',detail:err.message}); }
});
server.listen(PORT,()=>console.log(`PC Diagnostic Atlas: http://localhost:${PORT}`));
