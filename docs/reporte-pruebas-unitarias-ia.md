# Reporte de Pruebas Unitarias — Motor de IA de Itinerarios
**Proyecto:** Pitzbol Web — IA de Itinerarios  
**Módulo probado:** `src/lib/ia-engine.ts`  
**Fecha de ejecución:** 10 de mayo de 2026  
**Framework de pruebas:** Vitest v4.1.5  
**Ejecutado por:** Pilar Mora  

---

## 1. Resumen Ejecutivo

| Métrica | Resultado |
|---|---|
| Total de pruebas | 68 |
| Pruebas aprobadas | 68 ✅ |
| Pruebas fallidas | 0 |
| Tiempo de ejecución | ~887 ms |
| Cobertura de sentencias | 92.47% (209/226) |
| Cobertura de ramas | 85.09% (137/161) |
| Cobertura de funciones | **100%** (34/34) |
| Cobertura de líneas | 98.2% (164/167) |

> **Todas las funciones del motor de IA están cubiertas al 100%.**  
> Las líneas sin cubrir (312–314) corresponden a una rama de manejo de error interno que no es alcanzable bajo condiciones normales.

---

## 2. Bugs Encontrados y Corregidos Durante las Pruebas

| # | Función | Bug | Corrección |
|---|---|---|---|
| 1 | `getFoodType` | No detectaba "Birriería" porque `norm()` convierte la `í` y el string `birriera`/`birrieria` no coincidía con el patrón `birria` | Se agregaron los patrones `birriera` y `birrieria` al check |
| 2 | `generateItinerary` | Usaba `Math.random()` en los pools de lugares, haciendo los resultados no reproducibles entre ejecuciones | Se implementó `seededShuffle()` con semilla diaria determinista |
| 3 | `page.tsx` | Accesos a `place.fotos[0]` sin validar que `fotos` existiera, causando error de build TypeScript | Se corrigieron todos los accesos a `place.fotos?.[0]` |

---

## 3. Cobertura por Función

| Función | Descripción | Resultado |
|---|---|---|
| `norm` | Normaliza strings (minúsculas + sin acentos) | ✅ Cubierta |
| `matchesInterest` | Filtra lugares por interés del usuario | ✅ Cubierta |
| `isPlaceOpen` | Verifica si un lugar está abierto en fecha/hora dada | ✅ Cubierta |
| `getDayOfWeek` | Obtiene el día de la semana de una fecha ISO | ✅ Cubierta |
| `addMinutes` | Suma minutos a una hora en formato HH:MM | ✅ Cubierta |
| `getMealContext` | Clasifica la hora como desayuno/comida/cena | ✅ Cubierta |
| `parseCostMin` | Extrae el costo mínimo de un string de precio | ✅ Cubierta |
| `mealScore` | Puntúa un lugar gastronómico según el contexto de comida | ✅ Cubierta |
| `getFoodType` | Clasifica el tipo de comida de un lugar | ✅ Cubierta |
| `haversine` | Calcula distancia en km entre dos coordenadas | ✅ Cubierta |
| `sortByProximity` | Ordena lugares minimizando distancia total recorrida | ✅ Cubierta |
| `repairConsecutiveGastro` | Evita dos restaurantes consecutivos en el itinerario | ✅ Cubierta |
| `buildSchedule` | Construye el horario completo con horas de llegada/salida | ✅ Cubierta |
| `seededShuffle` | Mezcla un arreglo de forma determinista con semilla | ✅ Cubierta |
| `dailySeed` | Genera semilla diaria para reproducibilidad | ✅ Cubierta |
| `generateItinerary` | Motor principal de generación de itinerarios | ✅ Cubierta |

---

## 4. Detalle de Casos de Prueba

### 4.1 `norm` — 3 casos
| Caso | Entrada | Resultado Esperado | Estado |
|---|---|---|---|
| Convierte a minúsculas | `'CULTURA'` | `'cultura'` | ✅ |
| Elimina acentos | `'Gastronomía'`, `'Música'`, `'Fotografía'` | Sin acentos | ✅ |
| Cadena vacía | `''` | `''` | ✅ |

### 4.2 `matchesInterest` — 6 casos
| Caso | Estado |
|---|---|
| Detecta cultura en categoría compuesta ("Cultura, Museos") | ✅ |
| Detecta gastronomía con variante mexicana | ✅ |
| Detecta cafeterías | ✅ |
| Detecta vida nocturna | ✅ |
| No hace match incorrecto (naturaleza ≠ fútbol) | ✅ |
| Interés desconocido devuelve false | ✅ |

### 4.3 `getDayOfWeek` — 4 casos
| Fecha | Día Esperado | Estado |
|---|---|---|
| 2026-05-10 | domingo | ✅ |
| 2026-05-11 | lunes | ✅ |
| 2026-05-09 | sábado | ✅ |
| 2026-06-11 | jueves (primer partido en GDL) | ✅ |

### 4.4 `addMinutes` — 5 casos
| Caso | Entrada | Esperado | Estado |
|---|---|---|---|
| Suma simple | 09:00 + 60 min | 10:00 | ✅ |
| Cambio de hora | 09:45 + 30 min | 10:15 | ✅ |
| Medianoche | 23:30 + 60 min | 00:30 | ✅ |
| Suma cero | 10:00 + 0 min | 10:00 | ✅ |
| 90 minutos | 08:00 + 90 min | 09:30 | ✅ |

### 4.5 `getMealContext` — 3 casos
| Rango horario | Contexto Esperado | Estado |
|---|---|---|
| 07:00 – 11:59 | desayuno | ✅ |
| 12:00 – 16:59 | comida | ✅ |
| 17:00 – 23:59 | cena | ✅ |

### 4.6 `parseCostMin` — 5 casos
| Entrada | Esperado | Estado |
|---|---|---|
| `'Gratis'` | 0 | ✅ |
| `''` | 0 | ✅ |
| `'$100 - $200'` | 100 | ✅ |
| `'$350 MXN'` | 350 | ✅ |
| `'$1,500'` | 1500 | ✅ |

### 4.7 `mealScore` — 4 casos
| Caso | Estado |
|---|---|
| Taquería puntúa positivo en comida | ✅ |
| Café puntúa positivo en desayuno | ✅ |
| Bar puntúa positivo en cena | ✅ |
| Café penalizado en cena (score menor que en desayuno) | ✅ |

### 4.8 `getFoodType` — 5 casos
| Nombre del lugar | Tipo Esperado | Estado |
|---|---|---|
| "Tacos El Gordo" | tacos | ✅ |
| "Birriería Jalisco" | birria | ✅ (bug corregido) |
| "Café Sinergia" | cafe | ✅ |
| "Mariscos El Puerto" | mariscos | ✅ |
| "Restaurante XYZ" | unique_restaurante xyz | ✅ |

### 4.9 `haversine` — 3 casos
| Caso | Estado |
|---|---|
| Mismo punto → 0 km | ✅ |
| GDL–CDMX → ~480 km (450–520 rango aceptable) | ✅ |
| Función simétrica: d(A,B) == d(B,A) | ✅ |

### 4.10 `isPlaceOpen` — 7 casos
| Caso | Estado |
|---|---|
| Sin horario definido → siempre abierto | ✅ |
| Horario 00:00–23:59 → siempre abierto | ✅ |
| Llegada antes de apertura → cerrado | ✅ |
| Llegada dentro de horario → abierto | ✅ |
| Visita que termina después del cierre → cerrado | ✅ |
| Día de cierre → cerrado | ✅ |
| Bar con horario nocturno (cierre 02:00) → abierto a las 20:00 | ✅ |

### 4.11 `sortByProximity` — 5 casos
| Caso | Estado |
|---|---|
| Lista vacía no falla | ✅ |
| Un solo lugar regresa tal cual | ✅ |
| Mantiene el mismo número de lugares | ✅ |
| El primer lugar es siempre el primero del arreglo | ✅ |
| Lugares sin coordenadas no se pierden | ✅ |

### 4.12 `repairConsecutiveGastro` — 3 casos
| Caso | Estado |
|---|---|
| Sin gastro consecutiva → no cambia el orden | ✅ |
| Dos gastro consecutivos → los separa | ✅ |
| Conserva todos los lugares tras la reparación | ✅ |

### 4.13 `buildSchedule` — 5 casos
| Caso | Estado |
|---|---|
| Genera una parada por lugar | ✅ |
| Primera parada llega exactamente a la hora de inicio | ✅ |
| Hora de salida = llegada + tiempoEstancia | ✅ |
| Segunda parada incluye tránsito de 30 minutos | ✅ |
| `forcedArrival` sobreescribe la hora calculada | ✅ |

### 4.14 `generateItinerary` — Conteo por ritmo — 3 casos
| Ritmo | Paradas Esperadas | Paradas Obtenidas | Estado |
|---|---|---|---|
| tranquilo | 3 | 3 | ✅ |
| normal | 4 | 4 | ✅ |
| activo | 5 | 5 | ✅ |

### 4.15 `generateItinerary` — Reglas de negocio — 7 casos
| Regla | Estado |
|---|---|
| No incluye lugares de la lista negra (Estadio Akron, etc.) | ✅ |
| No repite lugares en el mismo itinerario | ✅ |
| No hay gastronomía consecutiva | ✅ |
| Todos los lugares están abiertos en su hora de llegada | ✅ |
| Presupuesto 0 con lugares con costo → itinerario vacío | ✅ |
| Vida nocturna aparece al final del itinerario | ✅ |
| Vida nocturna solo se recomienda a partir de las 20:00 | ✅ |
| Lunes no recomienda lugares que cierran ese día | ✅ |

---

## 5. Cobertura de Código

```
File          | % Stmts | % Branch | % Funcs | % Lines | Líneas sin cubrir
ia-engine.ts  |   92.47 |    85.09 |   100.0 |   98.20 | 312–314
```

**Líneas 312–314:** Corresponden a la rama `else` dentro de `generateItinerary` cuando el pool de lugares filtrados es completamente vacío y se agota sin seleccionar ningún lugar. Esta condición no es alcanzable con datos de producción válidos.

---

## 6. Conclusiones

- El motor de IA opera correctamente bajo todas las condiciones probadas.
- El **100% de las funciones** fue ejercitado por las pruebas.
- Se identificaron y corrigieron **3 bugs** durante el proceso de pruebas, incluyendo uno que afectaba el build de producción.
- El shuffle con semilla diaria garantiza resultados **reproducibles y sin aleatoriedad no controlada**.
- El sistema de horarios valida correctamente apertura, cierre y días inhábiles incluyendo horarios que cruzan medianoche.

---

*Reporte generado con Vitest v4.1.5 — Motor de IA Pitzbol Web*
