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

    // Buscar el documento del usuario en usuarios/{roleCollection}/lista donde ui == uid
    const snapshot = await adminDb
      .collection('usuarios')
      .doc(roleCollection)
      .collection('lista')
      .where('ui', '==', uid)
      .limit(1)
      .get();

    // Si no existe documento del usuario, crearlo (usuarios que se registraron desde pitzbol-web)
    let userDocRef;
    if (snapshot.empty) {
      userDocRef = await adminDb
        .collection('usuarios')
        .doc(roleCollection)
        .collection('lista')
        .add({ ui: uid, creadoEn: new Date().toISOString() });
    } else {
      userDocRef = snapshot.docs[0].ref;
    }
    // Path final: usuarios/{roleCollection}/lista/{nombre_apellido}/itinerarios/{autoId}
    const docRef = await userDocRef.collection('itinerarios').add({
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
