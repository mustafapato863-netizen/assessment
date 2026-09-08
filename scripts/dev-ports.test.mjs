import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { findAvailablePort } from './dev-ports.mjs';

test('occupied ports fall back, while strict mode fails without stopping the existing server', async () => {
  const occupied = createServer();
  await new Promise((resolve) => occupied.listen(0, resolve));
  try {
    const port = occupied.address().port;
    const available = await findAvailablePort(port);
    assert.ok(available > port);
    await assert.rejects(findAvailablePort(port, { auto: false }), /unavailable/);
    assert.ok(occupied.listening);
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});

test('IPv4 loopback listeners also prevent selecting the same port', async () => {
  const occupied = createServer();
  await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  try {
    const port = occupied.address().port;
    assert.ok((await findAvailablePort(port)) > port);
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});

test('invalid ports fail clearly', async () => {
  for (const port of [0, -1, 65536, 'abc', 3.5]) {
    await assert.rejects(findAvailablePort(port), /Invalid development port/);
  }
});

test('API and web cannot be allocated the same port', async () => {
  const port = await findAvailablePort(31000);
  assert.ok((await findAvailablePort(port, { exclude: [port] })) > port);
  await assert.rejects(
    findAvailablePort(port, { auto: false, exclude: [port] }),
    /already allocated/,
  );
});
