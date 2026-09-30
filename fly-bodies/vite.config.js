import {defineConfig} from 'vite';
import {cpSync,createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const female= fileURLToPath(new URL('../fly-duck/public/brain/',import.meta.url));
export default defineConfig({base:'./',plugins:[{
  name:'flywire-data',
  configureServer(server){server.middlewares.use('/brain-female',(req,res,next)=>{let file;try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=resolve(female,'.'+pathname);}catch{return next();}if(!file.startsWith(resolve(female)+sep)||!existsSync(file)||!statSync(file).isFile())return next();res.setHeader('Content-Type',file.endsWith('.json')?'application/json':'application/octet-stream');createReadStream(file).on('error',next).pipe(res);});},
  closeBundle(){cpSync(female,fileURLToPath(new URL('./dist/brain-female/',import.meta.url)),{recursive:true});}
}],build:{chunkSizeWarningLimit:1500}});
