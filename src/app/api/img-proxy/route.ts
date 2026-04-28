import { NextRequest, NextResponse } from 'next/server';

const IMAGES: Record<string, string> = {
  estadio: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Estadio_Omnilife.jpg/960px-Estadio_Omnilife.jpg',
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('k');
  const url = key ? IMAGES[key] : null;
  if (!url) return new NextResponse('Not found', { status: 404 });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PitzbolBot/1.0)' },
    });
    if (!res.ok) return new NextResponse('Upstream error', { status: res.status });
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
