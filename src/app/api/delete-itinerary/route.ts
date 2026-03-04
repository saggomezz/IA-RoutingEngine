import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function DELETE(req: NextRequest) {
  try {
    const { uid, id } = await req.json();
    if (!uid || !id) return NextResponse.json({ error: 'uid e id requeridos' }, { status: 400 });
    await adminDb.collection('usuarios').doc(uid).collection('itinerarios').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al eliminar' }, { status: 500 });
  }
}
