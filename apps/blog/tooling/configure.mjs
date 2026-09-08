import { writeFile } from 'node:fs/promises';
const environment=process.argv[2];
if(!['staging','production'].includes(environment)) throw new Error('Choose staging or production explicitly');
const value=name=>{ const result=process.env[name];if(!result) throw new Error(`Missing ${name}`);return result; };
const account=value('CLOUDFLARE_ACCOUNT_ID'),database=value('BCA_BLOG_D1_ID');
if(!/^[a-f0-9]{32}$/.test(account)||!/^[a-f0-9-]{36}$/.test(database)) throw new Error('Invalid resource identifiers');
const origin=environment==='production'?'https://bca.wales':value('BCA_BLOG_STAGING_ORIGIN');
const url=new URL(origin);
if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||['explore.bca.wales','assets.bca.wales'].includes(url.hostname)||(environment==='staging'&&['bca.wales','www.bca.wales'].includes(url.hostname))) throw new Error('Use the isolated canonical HTTPS origin');
const flag=(name,fallback)=>{ const v=process.env[name]||fallback;if(!['true','false'].includes(v)) throw new Error(`Invalid boolean ${name}`);return v; };
const auth=flag('BCA_BLOG_AUTH_ENABLED','false')==='true',images=flag('BCA_BLOG_IMAGES_ENABLED','false')==='true';
const config={ name:`bca-wales-blog-${environment}`,account_id:account,main:'dist/worker.mjs',compatibility_date:'2026-08-01',workers_dev:false,preview_urls:false,assets:{ directory:'dist/static',binding:'ASSETS',run_worker_first:true },triggers:{ crons:['0 * * * *'] },observability:{ enabled:false },vars:{ ORIGIN:origin,AUTH_ENABLED:String(auth),RESTRICTED:flag('BCA_BLOG_RESTRICTED','true'),PUBLISH_PAUSED:flag('BCA_BLOG_PUBLISH_PAUSED','true'),BACKUPS_ENABLED:flag('BCA_BLOG_BACKUPS_ENABLED','false'),BACKUP_RETENTION_CONFIRMED:flag('BCA_BLOG_BACKUP_RETENTION_CONFIRMED','false'),...(auth?{ FACEBOOK_APP_ID:value('BCA_BLOG_FACEBOOK_APP_ID'),FACEBOOK_GRAPH_VERSION:value('BCA_BLOG_FACEBOOK_GRAPH_VERSION'),FACEBOOK_USER_LINK:'false',SESSION_ACTIVE_KID:value('BCA_BLOG_SESSION_ACTIVE_KID') }:{}) },d1_databases:[{ binding:'DB',database_name:`bca-wales-blog-${environment}`,database_id:database,migrations_dir:'migrations' }],r2_buckets:[{ binding:'CONTENT',bucket_name:`bca-wales-blog-${environment}-content`,jurisdiction:'eu' },{ binding:'RECOVERY',bucket_name:`bca-wales-blog-${environment}-recovery`,jurisdiction:'eu' }],...(images?{ images:{ binding:'IMAGES' } }:{}) };
// Domain routes are intentionally a separately approved operation; code deploys
// cannot change the apex/www/explorer DNS or replace another service implicitly.
await writeFile(new URL(`../wrangler.${environment}.jsonc`,import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log(`Generated isolated ${environment} configuration without routes or secrets.`);
