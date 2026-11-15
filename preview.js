const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'site');
const T={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.xml':'application/xml'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  if(!path.extname(p)) p=p.replace(/\/$/,'')+'/index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)){res.writeHead(403);return res.end()}
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404);return res.end('404')}
    res.writeHead(200,{'Content-Type':T[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(d);
  });
}).listen(8091,'127.0.0.1',()=>console.log('preview: http://127.0.0.1:8091'));
