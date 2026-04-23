'use strict';

const express = require('express');
const soap = require('soap');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9091;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[plan-service] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Mock Data ────────────────────────────────────────────────────────────────
const plans = [
  {
    planId: 'P001',
    name: 'Starter Prepaid',
    type: 'prepaid',
    price: 9.99,
    currency: 'USD',
    dataGB: 5,
    voiceMinutes: 100,
    sms: 500,
    validityDays: 30,
    features: ['5G access', '100 voice minutes', '500 SMS', 'Data rollover'],
    status: 'active',
    tier: 'basic'
  },
  {
    planId: 'P002',
    name: 'Business Postpaid',
    type: 'postpaid',
    price: 49.99,
    currency: 'USD',
    dataGB: 100,
    voiceMinutes: -1,
    sms: -1,
    validityDays: 30,
    features: ['5G access', 'Unlimited calls', 'Unlimited SMS', 'International roaming', 'SLA guarantee'],
    status: 'active',
    tier: 'business'
  },
  {
    planId: 'P003',
    name: 'MVNO Wholesale 10GB',
    type: 'wholesale',
    price: 5.00,
    currency: 'USD',
    dataGB: 10,
    voiceMinutes: 200,
    sms: 1000,
    validityDays: 30,
    features: ['Bulk pricing', 'API access', 'SLA guarantee', 'Dedicated support'],
    status: 'active',
    tier: 'premium'
  },
  {
    planId: 'P004',
    name: 'MVNO Wholesale 50GB',
    type: 'wholesale',
    price: 20.00,
    currency: 'USD',
    dataGB: 50,
    voiceMinutes: -1,
    sms: -1,
    validityDays: 30,
    features: ['Bulk pricing', 'API access', 'Priority SLA', 'Account manager', 'Custom APN'],
    status: 'active',
    tier: 'premium'
  },
  {
    planId: 'P005',
    name: 'IoT Data SIM',
    type: 'iot',
    price: 2.50,
    currency: 'USD',
    dataGB: 1,
    voiceMinutes: 0,
    sms: 0,
    validityDays: 30,
    features: ['Low-power IoT', 'NB-IoT/LTE-M', 'Static IP available', 'Fleet management'],
    status: 'active',
    tier: 'basic'
  }
];

// ─── REST Endpoints ──────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'plan-service', timestamp: new Date().toISOString() });
});

// GET /v1/plans — list all plans with optional filtering
app.get('/v1/plans', (req, res) => {
  const { type, tier, status, limit = 20, offset = 0 } = req.query;

  let result = [...plans];

  if (type) result = result.filter(p => p.type === type);
  if (tier) result = result.filter(p => p.tier === tier);
  if (status) result = result.filter(p => p.status === status);

  const total = result.length;
  const paginated = result.slice(Number(offset), Number(offset) + Number(limit));

  res.json({
    total,
    count: paginated.length,
    offset: Number(offset),
    limit: Number(limit),
    plans: paginated
  });
});

// GET /v1/plans/:planId — get single plan
app.get('/v1/plans/:planId', (req, res) => {
  const plan = plans.find(p => p.planId === req.params.planId);
  if (!plan) {
    return res.status(404).json({
      code: 'PLAN_NOT_FOUND',
      message: `Plan ${req.params.planId} not found`
    });
  }
  res.json(plan);
});

// GET /v1/plans/type/:type — get by type
app.get('/v1/plans/type/:type', (req, res) => {
  const result = plans.filter(p => p.type === req.params.type);
  res.json({ total: result.length, plans: result });
});

// GET /v1/plans/wholesale — get all wholesale plans (MVNO-specific)
app.get('/v1/plans/wholesale', (_req, res) => {
  const result = plans.filter(p => p.type === 'wholesale');
  res.json({ total: result.length, plans: result });
});

// 404 for unknown REST routes
app.use('/v1', (req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `Route ${req.path} not found` });
});

// ─── SOAP Service (simulates legacy BSS) ────────────────────────────────────
const wsdlPath = path.join(__dirname, 'plan-service.wsdl');

const soapService = {
  PlanService: {
    PlanServicePort: {
      GetAllPlans: function(args, callback) {
        const typeFilter = args.type || null;
        const filtered = typeFilter
          ? plans.filter(p => p.type === typeFilter)
          : plans;

        const xml = `
          <GetAllPlansResponse>
            <Plans>
              ${filtered.map(p => `
                <Plan>
                  <PlanID>${p.planId}</PlanID>
                  <PlanName>${p.name}</PlanName>
                  <PlanType>${p.type}</PlanType>
                  <Price>${p.price}</Price>
                  <Currency>${p.currency}</Currency>
                  <DataGB>${p.dataGB}</DataGB>
                  <VoiceMinutes>${p.voiceMinutes}</VoiceMinutes>
                  <SMS>${p.sms}</SMS>
                  <ValidityDays>${p.validityDays}</ValidityDays>
                  <Status>${p.status}</Status>
                  <Tier>${p.tier}</Tier>
                </Plan>`).join('')}
            </Plans>
          </GetAllPlansResponse>`;
        callback(xml);
      },

      GetPlanById: function(args, callback) {
        const plan = plans.find(p => p.planId === args.planId);
        if (!plan) {
          const xml = `<GetPlanByIdResponse><Error><Code>PLAN_NOT_FOUND</Code><Message>Plan not found</Message></Error></GetPlanByIdResponse>`;
          return callback(xml);
        }
        const xml = `
          <GetPlanByIdResponse>
            <Plan>
              <PlanID>${plan.planId}</PlanID>
              <PlanName>${plan.name}</PlanName>
              <PlanType>${plan.type}</PlanType>
              <Price>${plan.price}</Price>
              <Currency>${plan.currency}</Currency>
              <DataGB>${plan.dataGB}</DataGB>
              <VoiceMinutes>${plan.voiceMinutes}</VoiceMinutes>
              <SMS>${plan.sms}</SMS>
              <ValidityDays>${plan.validityDays}</ValidityDays>
              <Status>${plan.status}</Status>
              <Tier>${plan.tier}</Tier>
            </Plan>
          </GetPlanByIdResponse>`;
        callback(xml);
      }
    }
  }
};

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[plan-service] REST listening on http://0.0.0.0:${PORT}`);
  console.log(`[plan-service] Health: http://localhost:${PORT}/health`);

  // Start SOAP service if WSDL exists
  if (fs.existsSync(wsdlPath)) {
    const wsdl = fs.readFileSync(wsdlPath, 'utf8');
    soap.listen(server, '/soap/plans', soapService, wsdl, () => {
      console.log(`[plan-service] SOAP listening on http://localhost:${PORT}/soap/plans`);
    });
  } else {
    console.log('[plan-service] WSDL not found — SOAP endpoint disabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('[plan-service] Server closed');
    process.exit(0);
  });
});
