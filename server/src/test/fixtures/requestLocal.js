import { request } from 'node:http';

// Native fetch rejects some OS-assigned ephemeral ports. These real-listener
// tests exercise server HTTP contracts, so use node:http for the transport.
export function requestLocal(url, { method = 'GET', headers, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('error', reject);
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(new Response(
        [204, 205, 304].includes(res.statusCode) ? null : Buffer.concat(chunks),
        { status: res.statusCode, headers: res.headers },
      )));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Local test request timed out')));
    req.end(body);
  });
}
