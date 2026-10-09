import { getFile } from '@/lib/storage';

export async function GET(request, { params }) {
  const path = (await params).path.join('/');
  const response = await getFile(path);
  if (!response) {
    return new Response('File not found', { status: 404 });
  }
  // Forward the response with caching
  const headers = new Headers();
  headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(response.body, { headers });
}
