import { createConnection, createServer } from 'node:net';

async function hasListener(port, host) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const finish = (occupied) => {
      socket.destroy();
      resolve(occupied);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(500, () => finish(true));
  });
}

export async function findAvailablePort(preferred, { auto = true, exclude = [] } = {}) {
  const first = Number(preferred);
  if (!Number.isInteger(first) || first < 1 || first > 65535) {
    throw new Error(`Invalid development port: ${preferred}`);
  }
  for (let port = first; port <= Math.min(first + 100, 65535); port++) {
    if (exclude.includes(port)) {
      if (!auto) throw new Error(`Development port ${port} is already allocated.`);
      continue;
    }
    // Windows can allow wildcard binds alongside existing loopback listeners.
    const listening = await Promise.all(
      ['127.0.0.1', '::1'].map((host) => hasListener(port, host)),
    );
    if (listening.some(Boolean)) {
      if (!auto) throw new Error(`Development port ${port} is unavailable.`);
      continue;
    }
    const availability = await Promise.all(
      ['0.0.0.0', '::'].map(
        (host) =>
          new Promise((resolve, reject) => {
            const server = createServer();
            server.once('error', (error) => {
              if (['EADDRINUSE', 'EACCES'].includes(error.code)) resolve(false);
              else if (host === '::' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code))
                resolve(true);
              else reject(error);
            });
            server.listen({ port, host, ipv6Only: host === '::', exclusive: true }, () =>
              server.close(() => resolve(true)),
            );
          }),
      ),
    );
    if (availability.every(Boolean)) return port;
    if (!auto)
      throw new Error(
        `Development port ${port} is unavailable. Enable automatic ports or choose another port.`,
      );
  }
  throw new Error(`No available development port found starting at ${first}.`);
}
