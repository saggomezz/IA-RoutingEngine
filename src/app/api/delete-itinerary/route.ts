import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

function getRoleCollection(role: string): string {
  const map: Record<string, string> = { turista: 'turistas', guia: 'guias', admin: 'admins' };
  return map[role] || 'turistas';
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid, role, id } = await req.json();
    if (!uid || !id) return NextResponse.json({ error: 'uid e id requeridos' }, { status: 400 });

    const roleCollection = getRoleCollection(role || 'turista');

    // Buscar el documento del usuario en usuarios/{roleCollection}/lista donde ui == uid
    const snapshot = await adminDb
      .collection('usuarios')
      .doc(roleCollection)
      .collection('lista')
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    await snapshot.docs[0].ref.collection('itinerarios').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al eliminar' }, { status: 500 });
  }
}
