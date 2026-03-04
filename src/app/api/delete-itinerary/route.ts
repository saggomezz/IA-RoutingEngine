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
    // Path: usuarios/{roleCollection}/{uid}/{id}
    await adminDb.collection('usuarios').doc(roleCollection).collection(uid).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al eliminar' }, { status: 500 });
  }
}
