// Universal file storage helper — works in sandbox, production, and build.
// IMPORTANT: SERVER-ONLY. Use in API routes, never in client components.
//
// Framework-agnostic: works with Next.js, Hono, or any Cloudflare Workers app.
// Each function accepts an optional { storage } parameter for direct R2 binding.
// If not provided, auto-detects: sandbox proxy → Next.js/OpenNext → fallback.
//
// SIZE LIMIT — SANDBOX ONLY. The two environments take different paths:
//   - In the SANDBOX, uploadFile() posts through a proxy, and the serverless
//     function in that path rejects request bodies over ~4MB with a 413. No
//     retry changes it.
//   - In PRODUCTION there is no proxy: the deployed Worker writes to the R2
//     binding directly, and large files are fine (30MB videos are in use).
// So a >4MB upload failing in the sandbox does NOT mean the app is broken in
// production, and it is not a reason to redesign storage.
//
// Do NOT work around a 413 by writing into public/. That directory is
// committed to the repo and copied into the deploy bundle, so generated assets
// there fill the sandbox disk, bloat git history permanently, and slow every
// deploy (one project went from 5.6MB to 781MB of upload that way). public/ is
// for assets that SHIP WITH the app — logos, fonts, models. Anything generated
// at runtime or uploaded by a user belongs in object storage.
//
// For a >4MB asset generated in the sandbox: resize/re-encode under 4MB, or
// generate it in a code path that runs on the deployed Worker.
//
// Usage:
//   import { uploadFile } from '@/lib/storage';
//   // Auto-detect (Next.js): uploadFile(file)
//   // Explicit binding (Hono/Workers): uploadFile(file, { storage: env.STORAGE })

const PROXY = process.env.SANDBOX_STORAGE_PROXY;
const TOKEN = process.env.SANDBOX_STORAGE_TOKEN;
const DOC_ID = process.env.SANDBOX_STORAGE_DOCID || '';
// Preview deploys are SSO-gated; the bypass header lets the box reach our API.
const BYPASS = process.env.SANDBOX_PROXY_BYPASS;
const AUTH = BYPASS
  ? { 'Authorization': 'Bearer ' + TOKEN, 'x-vercel-protection-bypass': BYPASS }
  : { 'Authorization': 'Bearer ' + TOKEN };

// Resolve R2 binding + site prefix: explicit > Next.js auto-detect > null
async function resolveR2(opts) {
  if (opts?.storage) return { r2: opts.storage, prefix: opts.prefix || DOC_ID };
  try {
    const cfModule = '@opennextjs/' + 'cloudflare';
    const { getCloudflareContext } = await import(/* webpackIgnore: true */ cfModule);
    const { env } = await getCloudflareContext({ async: true });
    if (env?.STORAGE) return { r2: env.STORAGE, prefix: env.SITE_PREFIX || DOC_ID };
  } catch {}
  return null;
}

export async function uploadFile(file, opts) {
  if (PROXY) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentId', DOC_ID);
    const res = await fetch(PROXY, { method: 'POST', headers: AUTH, body: formData });
    if (!res.ok) {
      // A 413 comes from the PLATFORM, not the proxy, and its body is not JSON
      // — so a bare res.json() turned "your file is too big" into an
      // unexplained 'Upload failed'. Say what happened: an app that cannot see
      // the reason invents a workaround, and the workaround that gets invented
      // is writing into public/, which ends up committed to the repo.
      if (res.status === 413) {
        throw new Error(
          'Upload rejected: the file exceeds the ~4MB limit for proxied uploads. ' +
          'This is a size limit, not an outage — retrying or falling back to local ' +
          'disk will not help, and writing into public/ puts the file in the repo ' +
          'and the deploy bundle. Re-encode or resize below 4MB, or write to the R2 ' +
          'binding directly from the deployed Worker.'
        );
      }
      const err = await res.json().catch(() => ({ error: 'Upload failed (HTTP ' + res.status + ')' }));
      throw new Error(err.error || ('Upload failed (HTTP ' + res.status + ')'));
    }
    return res.json();
  }
  const resolved = await resolveR2(opts);
  if (resolved) {
    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = Date.now();
    const key = resolved.prefix + 'uploads/' + ts + '-' + safeName;
    await resolved.r2.put(key, file.stream ? file.stream() : file, { httpMetadata: { contentType: file.type } });
    return { success: true, url: '/uploads/' + ts + '-' + safeName, filename: ts + '-' + safeName, size: file.size, type: file.type };
  }
  return { success: false, error: 'Storage not available' };
}

export async function deleteFile(key, opts) {
  if (PROXY) {
    const res = await fetch(PROXY + '?key=' + encodeURIComponent(key) + '&documentId=' + DOC_ID, { method: 'DELETE', headers: AUTH });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  }
  const resolved = await resolveR2(opts);
  if (resolved) { await resolved.r2.delete(resolved.prefix + 'uploads/' + key); return { success: true }; }
  return { success: false };
}

export async function listFiles(opts) {
  if (PROXY) {
    const res = await fetch(PROXY + '?list=true&documentId=' + DOC_ID, { headers: AUTH });
    if (!res.ok) throw new Error('List failed');
    return res.json();
  }
  const resolved = await resolveR2(opts);
  if (resolved) {
    const pre = resolved.prefix + 'uploads/';
    const listed = await resolved.r2.list({ prefix: pre });
    return { success: true, files: listed.objects.map(o => ({ key: o.key.replace(pre, ''), size: o.size })) };
  }
  return { success: true, files: [] };
}

export async function getFile(key, opts) {
  if (PROXY) {
    const res = await fetch(PROXY + '?key=' + encodeURIComponent(key) + '&documentId=' + DOC_ID, { headers: AUTH });
    if (!res.ok) return null;
    return res;
  }
  const resolved = await resolveR2(opts);
  if (resolved) {
    const obj = await resolved.r2.get(resolved.prefix + 'uploads/' + key);
    if (!obj) return null;
    return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream' } });
  }
  return null;
}

export function getFileUrl(key) {
  return '/uploads/' + key;
}
