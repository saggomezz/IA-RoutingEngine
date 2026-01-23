import { NextResponse } from 'next/server';
import ollama from 'ollama';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    //verificación de seguridad
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Cuerpo de petición vacío" }, { status: 400 });
    }
    const body = JSON.parse(rawBody);
    
    console.log("📥 Datos recibidos del Front:", body);

    const places: any[] = [];
    const csvPath = path.join(process.cwd(), 'datosLugares.csv');
    
    if (!fs.existsSync(csvPath)) {
        console.error("❌ No se encontró datosLugares.csv en la raíz");
        return NextResponse.json({ error: "Base de datos no encontrada" }, { status: 500 });
    }

    await new Promise((resolve) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const match = body.interests.some((i: string) => 
            row.Categoria?.toLowerCase().includes(i.toLowerCase())
          );
          
          if (match || row.premium === 'true') {
            places.push(row);
          }
        })
        .on('end', () => {
          //solo enviar los primeros 15 resultados para no confundir a la IA
          const limitedPlaces = places
            .sort(() => 0.5 - Math.random()) // Mezclamos un poco
            .slice(0, 15); 
            
          console.log(`Filtrado: Enviando ${places.length} lugares relevantes a la IA.`);
          resolve(limitedPlaces);
        });
    });

    

    // 2. Llamada a Ollama inyectando los lugares filtrados
    const response = await ollama.chat({
      model: 'pitzbol-ai',
      messages: [{ 
        role: 'user', 
      content: `
        Actúa como experto local de Guadalajara.
        PRESUPUESTO: ${body.budget} MXN.
        INTERESES: ${body.interests.join(', ')}.
        UBICACIÓN INICIAL: ${body.location}.

        LISTA DE LUGARES DISPONIBLES:
        ${JSON.stringify(places)}

        INSTRUCCIONES:
        1. Selecciona actividades cuyo costo sumado sea MENOR o IGUAL a ${body.budget}.
        2. En el campo 'presupuesto_total', escribe la suma real de los lugares elegidos.
        3. No inventes precios.

        INSTRUCCIÓN OBLIGATORIA:
        Responde ÚNICAMENTE con un JSON que tenga esta estructura exacta:
        {
          "titulo": "Nombre del viaje",
          "presupuesto_total": "Suma total en MXN",
          "plan_detallado": [
            {"hora": "HH:MM", "actividad": "Nombre", "tiempo_estancia": "mins", "traslado_proximo": "mins"}
          ],
          "descripcion": "Justificación de la ruta",
          "tips": "Consejos locales"
        }
      `
      }],
      format: 'json',
      options: {
        temperature: 0.6, // Subimos un poco la temperatura para que "escriba" más
        num_predict: 1500
      }
    });

    // 3. Procesar respuesta
    const aiContent = response.message.content;
    const aiResult = JSON.parse(aiContent);

    // Monitoreo en la terminal de VS Code
    console.log("IA GENERÓ ITINERARIO EXITOSAMENTE");
    console.dir(aiResult, { depth: null }); 

    return NextResponse.json(aiResult);

  } catch (error) {
    console.error("Error en el motor de itinerarios:", error);
    return NextResponse.json(
      { error: "Error de conexión con la IA o procesamiento de datos" }, 
      { status: 500 }
    );
  }
}