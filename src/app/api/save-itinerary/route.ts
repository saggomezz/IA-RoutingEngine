import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, titulo, fecha, meta, stops } = body;

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'uid requerido' }, { status: 400 });
    }

    const ref = adminDb.collection('usuarios').doc(uid).collection('itinerarios');
    const docRef = await ref.add({
      titulo,
      fecha,
      meta,
      stops,
      creadoEn: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: docRef.id }, { status: 201 });
  } catch (err) {
    console.error('Error guardando itinerario:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
