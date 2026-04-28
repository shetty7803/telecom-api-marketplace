const express = require('express');
const cors    = require('cors');
const path    = require('path');
const https   = require('https');
const axios   = require('axios');

const app  = express();
const PORT = 4000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

const WSO2  = 'https://localhost:9443';
const AGENT = new https.Agent({ rejectUnauthorized: false });

// ─── Stores ──────────────────────────────────────────────────────────────────
let requestLog = [];  // every request sent from tester

let apiStore = [
  { id:'plan-api',    name:'Plan API',           context:'/plan',    version:'1.0.0', backend:'http://localhost:9091/v1', status:'PUBLISHED', tier:'Gold',     created: new Date(Date.now()-86400000*3).toISOString() },
  { id:'network-api', name:'Network Status API', context:'/network', version:'1.0.0', backend:'http://localhost:9092/v1', status:'PUBLISHED', tier:'Silver',   created: new Date(Date.now()-86400000*2).toISOString() },
  { id:'usage-api',   name:'Usage API',          context:'/usage',   version:'1.0.0', backend:'http://localhost:9093/v1', status:'PUBLISHED', tier:'Gold',     created: new Date(Date.now()-86400000*1).toISOString() },
];

let partnerStore = [
  { id:'mvno-partner-app', name:'MVNO Partner App', tier:'Gold',      appId:'Z5al_ZeA06P1txth5h5_HfaNKisa', apis:['plan-api','network-api','usage-api'], created: new Date(Date.now()-86400000*3).toISOString() },
  { id:'telecom-test',     name:'Telecom Test App', tier:'Silver',    appId:'npKAVyWeBgYO5W8FJSjb5OWfIoka', apis:['plan-api'],                          created: new Date(Date.now()-86400000*2).toISOString() },
  { id:'dev-app',          name:'Developer App',    tier:'Bronze',    appId:'devApp123XYZ',                  apis:['network-api','usage-api'],            created: new Date(Date.now()-86400000*1).toISOString() },
  { id:'internal',         name:'Internal Testing', tier:'Unlimited', appId:'internalApp456',                apis:['plan-api','network-api','usage-api'], created: new Date().toISOString() },
];

const PLAN_DATA = [
  { planId:'P001', name:'Starter Prepaid',   type:'prepaid',  price:9.99,  dataGB:5,   voiceMin:100,  regions:['North America','Asia'] },
  { planId:'P002', name:'Business Postpaid', type:'postpaid', price:49.99, dataGB:50,  voiceMin:1000, regions:['Europe','North America'] },
  { planId:'P003', name:'MVNO Wholesale',    type:'wholesale',price:4.99,  dataGB:20,  voiceMin:500,  regions:['Asia','Africa'] },
  { planId:'P004', name:'IoT Basic',         type:'iot',      price:2.99,  dataGB:1,   voiceMin:0,    regions:['North America','Europe','Asia'] },
  { planId:'P005', name:'Premium Postpaid',  type:'postpaid', price:99.99, dataGB:100, voiceMin:2000, regions:['North America'] },
];

const REGION_DATA = [
  { region:'North America', status:'operational', topPlan:'Starter Prepaid',  growth:'+12%', prepaidPct:45, postpaidPct:30, wholesalePct:15, iotPct:10 },
  { region:'Europe',        status:'operational', topPlan:'Business Postpaid', growth:'+8%',  prepaidPct:20, postpaidPct:55, wholesalePct:10, iotPct:15 },
  { region:'Asia',          status:'degraded',    topPlan:'MVNO Wholesale',    growth:'+23%', prepaidPct:55, postpaidPct:15, wholesalePct:20, iotPct:10 },
  { region:'Africa',        status:'operational', topPlan:'MVNO Wholesale',    growth:'+31%', prepaidPct:65, postpaidPct:10, wholesalePct:20, iotPct:5  },
  { region:'Latin America', status:'operational', topPlan:'Starter Prepaid',   growth:'+17%', prepaidPct:50, postpaidPct:35, wholesalePct:8,  iotPct:7  },
];

// ─── WSO2 token (silent fail) ─────────────────────────────────────────────────
let wso2Token = null, tokenExpiry = 0;
async function getWSO2Token() {
  if (wso2Token && Date.now() < tokenExpiry) return wso2Token;
  try {
    const r = await axios.post(`${WSO2}/oauth2/token`,
      'grant_type=password&username=admin&password=admin&scope=apim:api_view',
      { auth:{username:'admin',password:'admin'}, headers:{'Content-Type':'application/x-www-form-urlencoded'}, httpsAgent:AGENT, timeout:3000 }
    );
    wso2Token = r.data.access_token;
    tokenExpiry = Date.now() + (r.data.expires_in - 60) * 1000;
    return wso2Token;
  } catch { return null; }
}
async function wso2Get(p) {
  const t = await getWSO2Token();
  if (!t) return null;
  try { return (await axios.get(`${WSO2}${p}`, { headers:{Authorization:`Bearer ${t}`}, httpsAgent:AGENT, timeout:5000 })).data; }
  catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Count requests for a specific partner
function partnerLog(pid)  { return requestLog.filter(r => r.partnerId === pid); }
// Count requests for a specific api
function apiLog(aid)      { return requestLog.filter(r => r.apiId === aid); }
// Build time-series buckets from log (5-min buckets)
function buildTS(logs) {
  if (!logs.length) return [{ t: new Date().toISOString(), requests:0, errors:0, latency:0 }];
  const buckets = {};
  logs.forEach(r => {
    const b = Math.floor(new Date(r.timestamp).getTime() / 300000) * 300000;
    if (!buckets[b]) buckets[b] = { requests:0, errors:0, lat:[] };
    buckets[b].requests++;
    if (!r.success) buckets[b].errors++;
    buckets[b].lat.push(r.responseTime);
  });
  return Object.entries(buckets).sort((a,b)=>+a[0]-+b[0]).map(([ts,b]) => ({
    t:        new Date(+ts).toISOString(),
    requests: b.requests,
    errors:   b.errors,
    latency:  b.lat.length ? Math.round(b.lat.reduce((s,x)=>s+x,0)/b.lat.length) : 0,
  }));
}
// Avg latency for a log set
function avgLat(logs) {
  if (!logs.length) return 0;
  return Math.round(logs.reduce((s,r)=>s+r.responseTime,0)/logs.length);
}
// p95 latency
function p95Lat(logs) {
  if (!logs.length) return 0;
  const sorted = [...logs].map(r=>r.responseTime).sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length*0.95)] || 0;
}

// ─── Overview ─────────────────────────────────────────────────────────────────
app.get('/api/overview', async (req, res) => {
  // Try WSO2 first
  const usage  = await wso2Get('/api/am/analytics/v1/stats/api-usage');
  const faults = await wso2Get('/api/am/analytics/v1/stats/api-faulty-invocation');

  let totalRequests = 0, totalErrors = 0;
  if (usage  && usage.list)  totalRequests = usage.list.reduce((s,r)=>s+(r.count||0),0);
  if (faults && faults.list) totalErrors   = faults.list.reduce((s,r)=>s+(r.count||0),0);

  // Fall back to request log
  if (!totalRequests) totalRequests = requestLog.length;
  if (!totalErrors)   totalErrors   = requestLog.filter(r=>!r.success).length;

  const throttled   = requestLog.filter(r=>r.status===429).length;
  const successRate = totalRequests > 0 ? +((( totalRequests-totalErrors)/totalRequests)*100).toFixed(1) : 0;
  const errorRate   = totalRequests > 0 ? +((totalErrors/totalRequests)*100).toFixed(1) : 0;

  res.json({
    totalRequests, totalErrors, throttled,
    successRate, errorRate,
    avgLatency:  avgLat(requestLog),
    p95Latency:  p95Lat(requestLog),
    activeApis:  apiStore.length,
    activePartners: partnerStore.length,
    peakRps: requestLog.length,
    dataSource: (usage && usage.list) ? 'wso2' : 'log',
    generatedAt: new Date().toISOString(),
  });
});

// ─── Per-API stats ────────────────────────────────────────────────────────────
app.get('/api/apis', async (req, res) => {
  const usage  = await wso2Get('/api/am/analytics/v1/stats/api-usage');
  const faults = await wso2Get('/api/am/analytics/v1/stats/api-faulty-invocation');
  const wsoUse = {}, wsoFlt = {};
  if (usage  && usage.list)  usage.list.forEach(i  => { wsoUse[i.apiName] = (wsoUse[i.apiName]||0)+(i.count||0); });
  if (faults && faults.list) faults.list.forEach(i => { wsoFlt[i.apiName] = (wsoFlt[i.apiName]||0)+(i.count||0); });

  res.json(apiStore.map(api => {
    const logs     = apiLog(api.id);
    const requests = wsoUse[api.name] || logs.length;
    const errors   = wsoFlt[api.name] || logs.filter(r=>!r.success).length;
    return {
      ...api, requests, errors,
      throttled:   logs.filter(r=>r.status===429).length,
      successRate: requests > 0 ? +((( requests-errors)/requests)*100).toFixed(1) : 0,
      errorRate:   requests > 0 ? +((errors/requests)*100).toFixed(1) : 0,
      avgLatency:  avgLat(logs),
      p95Latency:  p95Lat(logs),
      timeSeries:  buildTS(logs),
      dataSource:  wsoUse[api.name] ? 'wso2' : 'log',
    };
  }));
});

// ─── Time series ──────────────────────────────────────────────────────────────
app.get('/api/timeseries', (req, res) => res.json(buildTS(requestLog)));

// ─── Partners — tracked per partnerId ────────────────────────────────────────
app.get('/api/partners', async (req, res) => {
  const appUsage = await wso2Get('/api/am/analytics/v1/stats/application-usage');
  const wsoMap   = {};
  if (appUsage && appUsage.list) appUsage.list.forEach(i => { wsoMap[i.applicationName] = (wsoMap[i.applicationName]||0)+(i.count||0); });

  res.json(partnerStore.map(p => {
    const logs     = partnerLog(p.id);
    const wsoReqs  = wsoMap[p.name] || 0;
    const requests = wsoReqs || logs.length;
    const errors   = logs.filter(r=>!r.success).length;
    const throttled= logs.filter(r=>r.status===429).length;
    const tokCalls = logs.filter(r=>r.hasToken).length;
    return {
      ...p, requests, errors, throttled,
      tokenCalls: tokCalls,
      lastActive: logs[0] ? logs[0].timestamp : p.created,
      dataSource: wsoReqs > 0 ? 'wso2' : 'log',
    };
  }).sort((a,b)=>b.requests-a.requests));
});

// ─── Errors ───────────────────────────────────────────────────────────────────
app.get('/api/errors', async (req, res) => {
  const wsoF = await wso2Get('/api/am/analytics/v1/stats/api-faulty-invocation');
  const msgs = { 401:'Unauthorized',403:'Forbidden — scope failed',404:'Not Found',429:'Rate limit exceeded',500:'Internal Server Error',503:'Service Unavailable' };

  const logErrors = requestLog.filter(r=>!r.success||r.status>=400).slice(0,20).map((r,i) => ({
    id:`e${i}`, timestamp:r.timestamp, code:r.status||0,
    message: msgs[r.status] || `Connection failed: ${r.error||'unknown'}`,
    api: r.apiId||'custom', endpoint:r.url,
    partner: r.partnerId ? (partnerStore.find(p=>p.id===r.partnerId)||{name:r.partnerId}).name : 'Anonymous',
  }));

  const wsoErrors = [];
  if (wsoF && wsoF.list) wsoF.list.forEach((f,i) => wsoErrors.push({
    id:`wf${i}`, timestamp:new Date().toISOString(), code:'FAULT',
    message:`WSO2 fault — ${f.apiName}`, api:f.apiName, endpoint:f.apiContext||'—', partner:f.applicationName||'—',
  }));

  const all = [...logErrors,...wsoErrors].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  if (!all.length) return res.json([{ id:'none', timestamp:new Date().toISOString(), code:'—', message:'No errors yet — make some API calls', api:'—', endpoint:'—', partner:'—' }]);
  res.json(all);
});

// ─── Throttling ───────────────────────────────────────────────────────────────
app.get('/api/throttling', (req, res) => {
  const t = requestLog.filter(r=>r.status===429).map((r,i) => ({
    id:`t${i}`, timestamp:r.timestamp, api:r.apiId||'unknown',
    partner: r.partnerId ? (partnerStore.find(p=>p.id===r.partnerId)||{name:r.partnerId}).name : 'Anonymous',
    tier: r.partnerId ? (partnerStore.find(p=>p.id===r.partnerId)||{tier:'Unknown'}).tier : 'Unknown',
    count:1, policy:'Rate Limit',
  }));
  if (!t.length) return res.json([{ id:'none', timestamp:new Date().toISOString(), api:'—', partner:'—', tier:'—', count:0, policy:'No throttling events yet' }]);
  res.json(t);
});

// ─── Scopes ───────────────────────────────────────────────────────────────────
app.get('/api/scopes', (req, res) => {
  res.json([
    { scope:'plan:read',    calls:apiLog('plan').length,    partners:partnerStore.filter(p=>p.apis.includes('plan-api')).length,    apis:['Plan API'] },
    { scope:'networkread',  calls:apiLog('network').length, partners:partnerStore.filter(p=>p.apis.includes('network-api')).length, apis:['Network Status API'] },
    { scope:'usage:read',   calls:apiLog('usage').length,   partners:partnerStore.filter(p=>p.apis.includes('usage-api')).length,   apis:['Usage API'] },
    { scope:'with-token',   calls:requestLog.filter(r=>r.hasToken).length,  partners:partnerStore.length, apis:['All'] },
    { scope:'no-token',     calls:requestLog.filter(r=>!r.hasToken).length, partners:0, apis:['—'] },
  ]);
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const svcs = [
    { name:'plan-service',    url:'http://localhost:9091/health' },
    { name:'network-service', url:'http://localhost:9092/health' },
    { name:'usage-service',   url:'http://localhost:9093/health' },
    { name:'WSO2 APIM',       url:'https://localhost:9443/carbon/' },
  ];
  res.json(await Promise.all(svcs.map(async s => {
    try { const start=Date.now(); await axios.get(s.url,{timeout:3000,httpsAgent:AGENT}); return {...s,status:'UP',latency:Date.now()-start}; }
    catch { return {...s,status:'DOWN',latency:null}; }
  })));
});

// ─── Alerts ───────────────────────────────────────────────────────────────────
app.get('/api/alerts', (req, res) => {
  const a = [];
  const e401=requestLog.filter(r=>r.status===401).length;
  const e403=requestLog.filter(r=>r.status===403).length;
  const e5xx=requestLog.filter(r=>r.status>=500).length;
  const e429=requestLog.filter(r=>r.status===429).length;
  if (e401) a.push({id:1,type:'warning',message:`${e401} unauthorized (401) — missing/expired token`,      api:'All',time:'Session'});
  if (e403) a.push({id:2,type:'error',  message:`${e403} scope violations (403) — wrong token scope`,      api:'All',time:'Session'});
  if (e5xx) a.push({id:3,type:'error',  message:`${e5xx} server errors (5xx) — check backend services`,    api:'All',time:'Session'});
  if (e429) a.push({id:4,type:'warning',message:`${e429} rate limit hits (429) — throttling active`,       api:'All',time:'Session'});
  if (!a.length) a.push({id:0,type:'info',message:'No alerts — all requests successful this session',api:'All',time:'Now'});
  res.json(a);
});

// ─── Plans ────────────────────────────────────────────────────────────────────
app.get('/api/plans/availability', (req, res) => {
  const planCalls = apiLog('plan').length;
  res.json({
    plans: PLAN_DATA.map(p => ({ ...p, active:true, callsToday:planCalls, subscribers:0 })),
    summary: { totalPlans:PLAN_DATA.length, activePlans:PLAN_DATA.length, totalSubs:0, topPlanByUsage:'Starter Prepaid', realCallCount:planCalls },
  });
});

// ─── Regions ──────────────────────────────────────────────────────────────────
app.get('/api/regions', (req, res) => {
  const total = requestLog.length;
  res.json({
    regions: REGION_DATA.map((r,i) => ({ ...r, apiCalls: Math.floor(total*[.35,.25,.20,.10,.10][i]) })),
    topRegion:'North America', fastestGrowing:'Africa', totalRealCalls:total,
  });
});

// ─── AUTO-FETCH TOKEN from WSO2 ───────────────────────────────────────────────
app.post('/api/fetch-token', async (req, res) => {
  const { clientId, clientSecret, scope='plan:read networkread usage:read' } = req.body;
  if (!clientId || !clientSecret) return res.status(400).json({ error:'clientId and clientSecret required' });
  try {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=${encodeURIComponent(scope)}`;
    const r = await axios.post(`${WSO2}/oauth2/token`, body, {
      headers:{'Content-Type':'application/x-www-form-urlencoded'}, httpsAgent:AGENT, timeout:8000,
    });
    res.json({ success:true, access_token:r.data.access_token, expires_in:r.data.expires_in, scope:r.data.scope });
  } catch(e) {
    const msg = (e.response && e.response.data && e.response.data.error_description) || e.message;
    res.json({ success:false, error:msg });
  }
});

// ─── TEST REQUEST — logs per-partner, per-api ─────────────────────────────────
app.post('/api/test-request', async (req, res) => {
  const { method='GET', url, token, apiId, partnerId } = req.body;
  if (!url) return res.status(400).json({ error:'URL required' });
  const start = Date.now();
  try {
    const headers = token ? { Authorization:`Bearer ${token}` } : {};
    const r = await axios({ method, url, headers, timeout:8000, httpsAgent:AGENT, validateStatus:()=>true });
    const responseTime = Date.now()-start;
    const success = r.status >= 200 && r.status < 300;
    requestLog.unshift({ id:`r${Date.now()}`, timestamp:new Date().toISOString(), method, url, status:r.status, responseTime, success, apiId:apiId||'custom', partnerId:partnerId||null, hasToken:!!token });
    if (requestLog.length > 500) requestLog = requestLog.slice(0,500);
    res.json({ success, status:r.status, responseTime, message:`${r.status} — ${success?'Success':'Failed'}` });
  } catch(e) {
    const responseTime = Date.now()-start;
    requestLog.unshift({ id:`r${Date.now()}`, timestamp:new Date().toISOString(), method, url, status:0, responseTime, success:false, apiId:apiId||'custom', partnerId:partnerId||null, hasToken:!!token, error:e.message });
    res.json({ success:false, status:0, responseTime, message:`Connection failed: ${e.message}` });
  }
});

// ─── Request log stats ────────────────────────────────────────────────────────
app.get('/api/test-log', (req, res) => {
  const total = requestLog.length, success = requestLog.filter(r=>r.success).length;
  res.json({ total, success, failed:total-success,
    successRate: total ? +((success/total*100).toFixed(1)) : 0,
    avgResponseTime: total ? Math.round(requestLog.reduce((s,r)=>s+r.responseTime,0)/total) : 0,
    recent: requestLog.slice(0,20) });
});

// ─── API Management ───────────────────────────────────────────────────────────
app.get('/api/manage/apis', (req, res) => res.json(apiStore));
app.post('/api/manage/apis', (req, res) => {
  const { name,context,version,backend,tier } = req.body;
  if (!name||!context||!backend) return res.status(400).json({error:'name, context, backend required'});
  const api = { id:name.toLowerCase().replace(/\s+/g,'-'), name, context:context.startsWith('/')?context:'/'+context, version:version||'1.0.0', backend, tier:tier||'Silver', status:'CREATED', created:new Date().toISOString() };
  apiStore.push(api);
  res.json({ success:true, api, message:`API "${name}" created. Go to Publisher Portal to deploy.` });
});
app.delete('/api/manage/apis/:id', (req, res) => {
  const i = apiStore.findIndex(a=>a.id===req.params.id);
  if (i===-1) return res.status(404).json({error:'Not found'});
  apiStore.splice(i,1); res.json({success:true});
});

// ─── Partner Management ───────────────────────────────────────────────────────
app.get('/api/manage/partners', (req, res) => res.json(partnerStore));
app.post('/api/manage/partners', (req, res) => {
  const { name,tier,apis } = req.body;
  if (!name) return res.status(400).json({error:'name required'});
  const p = { id:name.toLowerCase().replace(/\s+/g,'-'), name, tier:tier||'Bronze', appId:'app-'+Math.random().toString(36).substr(2,10), apis:apis||[], created:new Date().toISOString() };
  partnerStore.push(p);
  res.json({ success:true, partner:p, message:`Partner "${name}" created.` });
});
app.delete('/api/manage/partners/:id', (req, res) => {
  const i = partnerStore.findIndex(p=>p.id===req.params.id);
  if (i===-1) return res.status(404).json({error:'Not found'});
  partnerStore.splice(i,1); res.json({success:true});
});

app.listen(PORT, () => {
  console.log(`✅ Analytics backend on http://localhost:${PORT}`);
  console.log(`   WSO2: ${WSO2} | Log: tracks every request per partner`);
});