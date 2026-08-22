const PMTILES_PATH = /^\/releases\/release-[a-z0-9][a-z0-9._-]+\/assets\/[^/]+\.pmtiles$/;

function parseByteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) {
    return null;
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export function createPagesWorker(retiredPaths) {
  const retired = new Set(retiredPaths);

  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      if (retired.has(url.pathname)) {
        const notFoundUrl = new URL("/404.html", url);
        const assetResponse = await env.ASSETS.fetch(new Request(notFoundUrl, { method: "GET" }));
        const headers = new Headers(assetResponse.headers);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Robots-Tag", "noindex");
        return new Response(request.method === "HEAD" ? null : assetResponse.body, {
          status: 404,
          statusText: "Not Found",
          headers
        });
      }

      const rangeHeader = request.headers.get("Range");
      if (request.method !== "GET" || !rangeHeader || !PMTILES_PATH.test(url.pathname)) {
        return env.ASSETS.fetch(request);
      }

      const assetHeaders = new Headers(request.headers);
      assetHeaders.delete("Range");
      const assetResponse = await env.ASSETS.fetch(new Request(request, { headers: assetHeaders }));
      if (!assetResponse.ok) return assetResponse;

      const bytes = await assetResponse.arrayBuffer();
      const range = parseByteRange(rangeHeader, bytes.byteLength);
      if (!range) {
        const headers = new Headers(assetResponse.headers);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Range", `bytes */${bytes.byteLength}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
      }

      const body = bytes.slice(range.start, range.end + 1);
      const headers = new Headers(assetResponse.headers);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
      headers.set("Content-Length", String(body.byteLength));
      return new Response(body, { status: 206, headers });
    }
  };
}
