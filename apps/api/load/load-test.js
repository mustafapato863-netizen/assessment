import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * AssessFlow Phase 05 Load Test (Gate 8 H3 / Gate 3 Capacity Validation)
 *
 * Target: 100 peak concurrent VUs simulating 25,000 employee base, ~20-30 req/s.
 * Exercises:
 * 1. Overview reads: GET /api/v1/assessflow/overview
 * 2. Case list reads: GET /api/v1/assessflow/cases
 * 3. Case detail reads: GET /api/v1/assessflow/cases/{caseId}
 * 4. Submit-eligibility reads:
 *    - GET /api/v1/assessflow/cases?status=PENDING_ELIGIBILITY
 *    - GET /api/v1/assessflow/tasks
 * 5. Write path with unique idempotency keys:
 *    - POST /api/v1/assessflow/cases (draft creation)
 *    - POST /api/v1/assessflow/cases/{caseId}/submit (version-checked transition + Idempotency-Key)
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1/assessflow';
const TARGET_VUS = Number(__ENV.VUS || 100);

const overviewDuration = new Trend('overview_duration');
const listDuration = new Trend('list_cases_duration');
const detailDuration = new Trend('detail_case_duration');
const pendingEligibilityDuration = new Trend('pending_eligibility_duration');
const tasksDuration = new Trend('tasks_queue_duration');
const createDraftDuration = new Trend('create_draft_duration');
const submitCaseDuration = new Trend('submit_case_duration');

export const options = {
  stages: [
    { duration: '15s', target: Math.floor(TARGET_VUS * 0.25) }, // Ramp to 25 VUs
    { duration: '15s', target: Math.floor(TARGET_VUS * 0.5) }, // Ramp to 50 VUs
    { duration: '20s', target: TARGET_VUS }, // Ramp to 100 VUs
    { duration: '20s', target: TARGET_VUS }, // Sustain at 100 VUs
    { duration: '10s', target: 0 }, // Graceful ramp-down
  ],
  thresholds: {
    // Gate 8 H3 bar: Error rate strictly under 1%
    http_req_failed: ['rate<0.01'],
    // Gate 3 capacity assumption validation: p95 latency threshold
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const vuId = __VU;
  const iter = __ITER;

  // Header configuration:
  // - Virtual User distinct actor context
  // - Unique X-Forwarded-For per VU to simulate 100 independent workstations
  //   and distribute across the 120 req/min per-IP rate-limit boundary
  const headers = {
    'Content-Type': 'application/json',
    'x-actor-id': `load-vu-${vuId}`,
    'x-actor-name': `Load VU ${vuId}`,
    'x-actor-roles': 'Requester,HR,Coordinator,Assessor,PanelLead,BusinessApprover,Admin,Auditor',
    'x-forwarded-for': `10.0.${Math.floor(vuId / 256)}.${vuId % 256}`,
  };

  // 1. Overview Read
  const resOverview = http.get(`${BASE_URL}/overview`, {
    headers,
    tags: { name: 'GetOverview' },
  });
  overviewDuration.add(resOverview.timings.duration);
  check(resOverview, {
    'overview returns 200': (r) => r.status === 200,
    'overview has metrics': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.metrics) && body.metrics.length > 0;
      } catch {
        return false;
      }
    },
  });

  // 2. Case List Read
  const resList = http.get(`${BASE_URL}/cases`, {
    headers,
    tags: { name: 'ListCases' },
  });
  listDuration.add(resList.timings.duration);
  check(resList, {
    'case list returns 200': (r) => r.status === 200,
  });

  let targetCaseId = null;
  try {
    const listBody = JSON.parse(resList.body);
    if (Array.isArray(listBody) && listBody.length > 0) {
      targetCaseId = listBody[0].id;
    }
  } catch {
    // fallback
  }

  // 3. Case Detail Read
  if (targetCaseId) {
    const resDetail = http.get(`${BASE_URL}/cases/${targetCaseId}`, {
      headers,
      tags: { name: 'GetCaseDetail' },
    });
    detailDuration.add(resDetail.timings.duration);
    check(resDetail, {
      'case detail returns 200': (r) => r.status === 200,
    });
  }

  // 4. Submit-Eligibility Reads: Status Filter & Tasks Queue
  const resPending = http.get(`${BASE_URL}/cases?status=PENDING_ELIGIBILITY`, {
    headers,
    tags: { name: 'ListPendingEligibility' },
  });
  pendingEligibilityDuration.add(resPending.timings.duration);
  check(resPending, {
    'pending eligibility list returns 200': (r) => r.status === 200,
  });

  const resTasks = http.get(`${BASE_URL}/tasks`, {
    headers,
    tags: { name: 'GetTasks' },
  });
  tasksDuration.add(resTasks.timings.duration);
  check(resTasks, {
    'tasks queue returns 200': (r) => r.status === 200,
  });

  // 5. Write Path with Unique Idempotency Key
  // Create a draft case, then submit for eligibility with a unique Idempotency-Key
  const createPayload = JSON.stringify({
    employeeId: 'emp-001',
    employeeName: 'Mona Hassan',
    department: 'Product',
    currentRole: 'Senior Specialist',
    assessmentReason: 'PROMOTION',
    targetRole: 'Lead Specialist',
    targetLevel: 'L5',
    justification: `Automated load test verification case created by VU ${vuId} on iter ${iter}.`,
    priority: 'NORMAL',
  });

  const resCreate = http.post(`${BASE_URL}/cases`, createPayload, {
    headers,
    tags: { name: 'CreateCaseDraft' },
  });
  createDraftDuration.add(resCreate.timings.duration);

  const createOk = check(resCreate, {
    'create draft returns 201': (r) => r.status === 201,
  });

  if (createOk) {
    try {
      const createdCase = JSON.parse(resCreate.body);
      const caseId = createdCase.id;
      const idempotencyKey = `k6-idemp-vu${vuId}-iter${iter}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

      const submitPayload = JSON.stringify({
        expectedVersion: 1,
      });

      const resSubmit = http.post(`${BASE_URL}/cases/${caseId}/submit`, submitPayload, {
        headers: {
          ...headers,
          'idempotency-key': idempotencyKey,
        },
        tags: { name: 'SubmitCaseWithIdempotency' },
      });
      submitCaseDuration.add(resSubmit.timings.duration);

      check(resSubmit, {
        'submit case returns 200 or 201': (r) => r.status === 200 || r.status === 201,
      });
    } catch {
      // payload parsing guard
    }
  }

  // Pacing: 1.5s - 2.5s think time simulating human operator behavior
  sleep(1.5 + Math.random() * 1.0);
}

export function handleSummary(data) {
  return {
    'apps/api/load/summary.json': JSON.stringify(data, null, 2),
  };
}
