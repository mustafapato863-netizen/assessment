#!/usr/bin/env node

import dns from 'node:dns/promises';

const ORIGIN_VPS_IP = '186.240.157.106';
const DEFAULT_URLS = [
  'https://web-opal-tau-44.vercel.app',
  'https://web-zain-mustafas-projects.vercel.app',
  'https://assess.zainx.cloud',
];

function normalizeOrigin(raw) {
  const withScheme =
    raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 12_000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function checkTarget(rawTarget) {
  const origin = normalizeOrigin(rawTarget);
  const { hostname } = new URL(origin);
  const result = {
    origin,
    dns: null,
    root: null,
    health: null,
    ready: null,
    loginProbe: null,
    passed: true,
    issues: [],
  };

  try {
    const aRecords = await dns.resolve4(hostname).catch(() => []);
    const cnames = await dns.resolveCname(hostname).catch(() => []);
    result.dns = { aRecords, cnames };
    if (hostname.endsWith('.zainx.cloud') && hostname !== 'bkassess.zainx.cloud') {
      if (aRecords.includes(ORIGIN_VPS_IP) && cnames.length === 0) {
        result.passed = false;
        result.issues.push(
          `DNS points to origin VPS IP (${ORIGIN_VPS_IP}) instead of Vercel CNAME.`,
        );
      }
    }
  } catch (error) {
    result.passed = false;
    result.issues.push(`DNS lookup failed: ${error.message}`);
  }

  try {
    const res = await fetchWithTimeout(`${origin}/`, { redirect: 'manual' });
    const server = res.headers.get('server') ?? '';
    const location = res.headers.get('location') ?? '';
    const html = await res.text();
    const isSso =
      location.includes('vercel.com/sso-api') ||
      html.includes('sso-api') ||
      html.includes('Authentication Required');
    result.root = { status: res.status, server, isSso };
    if (res.status !== 200) {
      result.passed = false;
      result.issues.push(`GET / returned HTTP ${res.status}${location ? ` -> ${location}` : ''}`);
    } else if (isSso) {
      result.passed = false;
      result.issues.push('GET / returned a Vercel SSO login wall instead of the app.');
    }
    if (!server.toLowerCase().includes('vercel')) {
      result.passed = false;
      result.issues.push(`Expected Server: Vercel, observed "${server || 'unknown'}"`);
    }
  } catch (error) {
    result.passed = false;
    result.issues.push(`GET / request failed: ${error.message}`);
  }

  try {
    const res = await fetchWithTimeout(`${origin}/api/v1/assessflow/health`);
    const cacheControl = res.headers.get('cache-control') ?? '';
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    result.health = { status: res.status, cacheControl, body: parsed ?? text.slice(0, 120) };
    if (res.status !== 200 || parsed?.status !== 'ok') {
      result.passed = false;
      result.issues.push(`GET /api/v1/assessflow/health returned ${res.status}`);
    }
  } catch (error) {
    result.passed = false;
    result.issues.push(`Health proxy check failed: ${error.message}`);
  }

  try {
    const res = await fetchWithTimeout(`${origin}/api/v1/assessflow/health/ready`);
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    result.ready = { status: res.status, body: parsed ?? text.slice(0, 120) };
    if (res.status !== 200 || parsed?.status !== 'ok') {
      result.passed = false;
      result.issues.push(`GET /api/v1/assessflow/health/ready returned ${res.status}`);
    }
  } catch (error) {
    result.passed = false;
    result.issues.push(`Readiness proxy check failed: ${error.message}`);
  }

  try {
    const res = await fetchWithTimeout(`${origin}/api/v1/assessflow/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'linkage-probe@saudigerman.com',
        password: 'invalid-probe-password-123',
      }),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    result.loginProbe = { status: res.status, code: parsed?.error?.code ?? null };
    if (res.status !== 401 && res.status !== 200) {
      result.passed = false;
      result.issues.push(
        `POST /api/v1/assessflow/auth/login returned HTTP ${res.status} (${parsed?.error?.code ?? 'non-JSON'}). Expected 401/200 JSON.`,
      );
    }
  } catch (error) {
    result.passed = false;
    result.issues.push(`Login proxy check failed: ${error.message}`);
  }

  return result;
}

const targets = process.argv.slice(2);
const urls = targets.length > 0 ? targets : DEFAULT_URLS;

const reports = [];
for (const url of urls) {
  reports.push(await checkTarget(url));
}

console.log(JSON.stringify(reports, null, 2));
const anyFailed = reports.some((report) => !report.passed);
process.exit(anyFailed ? 1 : 0);
