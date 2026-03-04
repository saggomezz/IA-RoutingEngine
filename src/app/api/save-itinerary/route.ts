import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

function getRoleCollection(role: string): string {
  const map: Record<string, string> = { turista: 'turistas', guia: 'guias', admin: 'admins' };
  return map[role] || 'turistas';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, role, titulo, fecha, meta, stops } = body;

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'uid requerido' }, { status: 400 });
    }

    const roleCollection = getRoleCollection(role || 'turista');
    // Path: usuarios/{roleCollection}/{uid}/{autoId}
    const ref = adminDb.collection('usuarios').doc(roleCollection).collection(uid);
    const docRef = await ref.add({
      titulo,
      fecha,
      meta,
      stops,
      creadoEn: new Date().toISOString(),
    });

    return NextResponse.json({ id: docRef.id }, { status: 201 });
  } catch (err: any) {
    console.error('Error guardando itinerario:', err);
    return NextResponse.json({ error: err?.message || 'Error interno del servidor' }, { status: 500 });
  }
}
