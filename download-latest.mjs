import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const app='1:619425768506:android:51f550945cafcae13e0103';
const endpoint=`https://firebaseappdistribution.googleapis.com/v1/projects/619425768506/apps/${app}/releases?pageSize=1&orderBy=createTime%20desc`;
const r=await fetch(endpoint,{headers:{Authorization:`Bearer ${process.env.FIREBASE_ACCESS_TOKEN}`}});
if(!r.ok)throw Error(`Firebase release lookup failed (${r.status})`);
const release=(await r.json()).releases?.[0];
if(!release)throw Error('No Firebase beta is available');
if(!/^\d+$/.test(release.buildVersion))throw Error('Invalid build version');
const tag='beta-'+release.buildVersion;
function output(name,value){fs.appendFileSync(process.env.GITHUB_OUTPUT,`${name}=${String(value).replace(/[\r\n]/g,' ')}\n`);}
let exists;
try{exists=JSON.parse(execFileSync('gh',['release','view',tag,'--repo',process.env.GITHUB_REPOSITORY,'--json','isDraft'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));}catch{}
if(exists&&!exists.isDraft){output('publish','false');console.log('The current beta is already publicly available.');process.exit(0);}
const binaryUrl=new URL(release.binaryDownloadUri);
if(binaryUrl.protocol!=='https:')throw Error('HTTPS download required');
// The temporary download URL comes from authenticated Firebase; never forward its bearer token.
const binary=await fetch(binaryUrl,{redirect:'follow'});
if(!binary.ok)throw Error(`APK download failed (${binary.status})`);
const bytes=Buffer.from(await binary.arrayBuffer());
if(bytes.length<100000||bytes.length>20000000||bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('Unexpected APK file');
fs.mkdirSync('public-artifacts',{recursive:true});
fs.writeFileSync('public-artifacts/ULTRA.apk',bytes);
const meta={channel:'beta',versionName:release.displayVersion,versionCode:Number(release.buildVersion),packageName:'co.ultrafuture.app.preview.twa',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
fs.writeFileSync('public-artifacts/version.json',JSON.stringify(meta,null,2)+'\n');
fs.writeFileSync('public-artifacts/release-notes.txt','ULTRA para Android — versión beta.\n\nDescarga ULTRA.apk y confirma la instalación en Android. No necesitas invitación ni cuenta de Firebase. El inicio de sesión dentro de ULTRA se conserva.\n\nLa app utiliza la plataforma y los datos reales de ULTRA.\n');
output('publish','true');output('tag',tag);output('title','ULTRA Android Beta '+release.displayVersion);
console.log('Prepared ULTRA beta '+release.displayVersion+' ('+release.buildVersion+').');
