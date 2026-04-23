'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 9093;

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[usage-service] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Mock Data ────────────────────────────────────────────────────────────────
const generateUsage = (subscriberId, planId, month) => {
  const seed = subscriberId.charCodeAt(subscriberId.length - 1);
  const dataUsedGB = parseFloat((Math.random() * 8 + seed * 0.01).toFixed(2));
  const voiceUsed = Math.floor(Math.random() * 90 + 10);
  const smsUsed = Math.floor(Math.random() * 400 + 50);

  return {
    subscriberId,
    planId,
    billingPeriod: month || new Date().toISOString().slice(0, 7),
    dataUsedGB,
    dataLimitGB: 10,
    dataUsedPct: parseFloat(((dataUsedGB / 10) * 100).toFixed(1)),
    voiceMinutesUsed: voiceUsed,
    voiceMinutesLimit: 200,
    smsUsed,
    smsLimit: 1000,
    currentChargesUSD: parseFloat((dataUsedGB * 0.5 + voiceUsed * 0.02 + smsUsed * 0.001).toFixed(2)),
    lastUpdated: new Date().toISOString(),
    status: dataUsedGB > 9 ? 'near-limit' : 'normal'
  };
};

const subscribers = [
  { subscriberId: 'SUB-001', planId: 'P003', partnerId: 'mvno-a', region: 'REG-NA-01' },
  { subscriberId: 'SUB-002', planId: 'P003', partnerId: 'mvno-a', region: 'REG-NA-01' },
  { subscriberId: 'SUB-003', planId: 'P004', partnerId: 'mvno-a', region: 'REG-EU-01' },
  { subscriberId: 'SUB-004', planId: 'P003', partnerId: 'mvno-b', region: 'REG-AS-01' },
  { subscriberId: 'SUB-005', planId: 'P004', partnerId: 'mvno-b', region: 'REG-AS-02' },
  { subscriberId: 'SUB-006', planId: 'P005', partnerId: 'mvno-a', region: 'REG-EU-01' },
];

// ─── REST Endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'usage-service', timestamp: new Date().toISOString() });
});

// GET /v1/usage/:subscriberId — usage for one subscriber
app.get('/v1/usage/:subscriberId', (req, res) => {
  const { month } = req.query;
  const sub = subscribers.find(s => s.subscriberId === req.params.subscriberId);

  if (!sub) {
    return res.status(404).json({
      code: 'SUBSCRIBER_NOT_FOUND',
      message: `Subscriber ${req.params.subscriberId} not found`
    });
  }

  res.json(generateUsage(sub.subscriberId, sub.planId, month));
});

// GET /v1/usage/summary — aggregate for all subscribers (partner can only see own)
app.get('/v1/usage/summary', (req, res) => {
  const { partnerId, month, planId } = req.query;

  let subs = [...subscribers];
  if (partnerId) subs = subs.filter(s => s.partnerId === partnerId);
  if (planId) subs = subs.filter(s => s.planId === planId);

  const usages = subs.map(s => generateUsage(s.subscriberId, s.planId, month));

  const summary = {
    totalSubscribers: usages.length,
    billingPeriod: month || new Date().toISOString().slice(0, 7),
    totalDataUsedGB: parseFloat(usages.reduce((a, u) => a + u.dataUsedGB, 0).toFixed(2)),
    totalVoiceMinutes: usages.reduce((a, u) => a + u.voiceMinutesUsed, 0),
    totalSMS: usages.reduce((a, u) => a + u.smsUsed, 0),
    totalChargesUSD: parseFloat(usages.reduce((a, u) => a + u.currentChargesUSD, 0).toFixed(2)),
    nearLimitCount: usages.filter(u => u.status === 'near-limit').length,
    generatedAt: new Date().toISOString()
  };

  res.json({ summary, subscribers: usages });
});

// GET /v1/usage/export — CSV-style export for billing systems
app.get('/v1/usage/export', (req, res) => {
  const { partnerId, month, format = 'json' } = req.query;

  let subs = [...subscribers];
  if (partnerId) subs = subs.filter(s => s.partnerId === partnerId);

  const usages = subs.map(s => ({
    ...generateUsage(s.subscriberId, s.planId, month),
    region: s.region,
    partnerId: s.partnerId
  }));

  if (format === 'csv') {
    const headers = 'subscriberId,planId,partnerId,billingPeriod,dataUsedGB,voiceMinutesUsed,smsUsed,currentChargesUSD';
    const rows = usages.map(u =>
      `${u.subscriberId},${u.planId},${u.partnerId},${u.billingPeriod},${u.dataUsedGB},${u.voiceMinutesUsed},${u.smsUsed},${u.currentChargesUSD}`
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=usage-${month || 'current'}.csv`);
    return res.send([headers, ...rows].join('\n'));
  }

  res.json({ total: usages.length, records: usages });
});

app.use('/v1', (req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `Route ${req.path} not found` });
});

const server = app.listen(PORT, () => {
  console.log(`[usage-service] Listening on http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
