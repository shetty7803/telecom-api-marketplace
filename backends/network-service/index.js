'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 9092;

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[network-service] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Mock Data ────────────────────────────────────────────────────────────────
const regions = [
  { regionId: 'REG-NA-01', regionName: 'North America - East',    country: 'US', status: 'operational', technology: '5G',    coveragePct: 98.5, latencyMs: 12, incidentCount: 0 },
  { regionId: 'REG-NA-02', regionName: 'North America - West',    country: 'US', status: 'operational', technology: '5G',    coveragePct: 97.2, latencyMs: 14, incidentCount: 0 },
  { regionId: 'REG-EU-01', regionName: 'Europe - Central',        country: 'DE', status: 'operational', technology: '5G',    coveragePct: 96.8, latencyMs: 8,  incidentCount: 0 },
  { regionId: 'REG-EU-02', regionName: 'Europe - West',           country: 'FR', status: 'degraded',   technology: '4G',    coveragePct: 87.3, latencyMs: 22, incidentCount: 2 },
  { regionId: 'REG-AS-01', regionName: 'Asia Pacific - Southeast',country: 'SG', status: 'operational', technology: '5G',    coveragePct: 99.1, latencyMs: 6,  incidentCount: 0 },
  { regionId: 'REG-AS-02', regionName: 'Asia Pacific - East',     country: 'JP', status: 'operational', technology: '5G',    coveragePct: 99.5, latencyMs: 5,  incidentCount: 0 },
  { regionId: 'REG-ME-01', regionName: 'Middle East',             country: 'AE', status: 'degraded',   technology: '4G',    coveragePct: 82.1, latencyMs: 28, incidentCount: 1 },
  { regionId: 'REG-AF-01', regionName: 'Africa - North',          country: 'ZA', status: 'operational', technology: '4G',    coveragePct: 78.4, latencyMs: 45, incidentCount: 0 },
];

// Generate realistic live timestamps
const getRegionWithTimestamp = (region) => ({
  ...region,
  lastUpdated: new Date().toISOString(),
  nextUpdateIn: 300 // seconds
});

// ─── REST Endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'network-service', timestamp: new Date().toISOString() });
});

// GET /v1/network/status — all regions
app.get('/v1/network/status', (req, res) => {
  const { status, technology, country } = req.query;

  let result = regions.map(getRegionWithTimestamp);

  if (status) result = result.filter(r => r.status === status);
  if (technology) result = result.filter(r => r.technology === technology);
  if (country) result = result.filter(r => r.country === country.toUpperCase());

  const summary = {
    operational: result.filter(r => r.status === 'operational').length,
    degraded: result.filter(r => r.status === 'degraded').length,
    outage: result.filter(r => r.status === 'outage').length,
  };

  res.json({
    total: result.length,
    summary,
    regions: result,
    generatedAt: new Date().toISOString()
  });
});

// GET /v1/network/status/:regionId — single region
app.get('/v1/network/status/:regionId', (req, res) => {
  const region = regions.find(r => r.regionId === req.params.regionId);
  if (!region) {
    return res.status(404).json({
      code: 'REGION_NOT_FOUND',
      message: `Region ${req.params.regionId} not found`
    });
  }
  res.json(getRegionWithTimestamp(region));
});

// GET /v1/network/incidents — active incidents
app.get('/v1/network/incidents', (_req, res) => {
  const degraded = regions.filter(r => r.status !== 'operational');
  res.json({
    total: degraded.length,
    incidents: degraded.map(r => ({
      regionId: r.regionId,
      regionName: r.regionName,
      status: r.status,
      technology: r.technology,
      coveragePct: r.coveragePct,
      estimatedRestoration: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    }))
  });
});

// GET /v1/network/coverage/:technology — by technology
app.get('/v1/network/coverage/:technology', (req, res) => {
  const tech = req.params.technology.toUpperCase();
  const result = regions.filter(r => r.technology === tech).map(getRegionWithTimestamp);
  res.json({ technology: tech, total: result.length, regions: result });
});

app.use('/v1', (req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `Route ${req.path} not found` });
});

const server = app.listen(PORT, () => {
  console.log(`[network-service] Listening on http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
