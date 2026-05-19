import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://ia.pitzbol.me';

  return new ImageResponse(
    (
      <div
        style={{
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '16px',
        }}
      >
        <img
          src={`${base}/logoPitzbol.png`}
          width="54"
          height="54"
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
