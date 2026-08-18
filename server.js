const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
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
      return json(res,200,await store.readDB());
    }
    if(p==='/api/search' && req.method==='GET'){
      return json(res,200,await store.search(u.searchParams.get('q')));
    }
    if(p==='/api/flows' && req.method==='POST'){
      return json(res,201,await store.createFlow(await parseBody(req)));
    }
    const flowMatch=p.match(/^\/api\/flows\/([^/]+)$/);
    if(flowMatch && req.method==='PUT'){
      return json(res,200,await store.updateFlow(flowMatch[1],await parseBody(req)));
    }
    if(p==='/api/sessions' && req.method==='GET') return json(res,200,(await store.readDB()).sessions || []);
    if(p==='/api/sessions' && req.method==='POST'){
      return json(res,201,await store.createSession(await parseBody(req)));
    }
    const eventMatch=p.match(/^\/api\/sessions\/([^/]+)\/events$/);
    if(eventMatch && req.method==='POST'){
      return json(res,201,await store.addEvent(eventMatch[1],await parseBody(req)));
    }
    const sessionMatch=p.match(/^\/api\/sessions\/([^/]+)$/);
    if(sessionMatch && req.method==='PATCH'){
      return json(res,200,await store.updateSession(sessionMatch[1],await parseBody(req)));
    }

    const file=safePath(p);
    if(!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200,{'Content-Type':mime(file)}); fs.createReadStream(file).pipe(res);
  }catch(err){ console.error(err); json(res,500,{error:'Server error',detail:err.message}); }
});
server.listen(PORT,()=>console.log(`PC Diagnostic Atlas: http://localhost:${PORT}`));
