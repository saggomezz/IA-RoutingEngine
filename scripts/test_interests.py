#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
if hasattr(sys.stdout,'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

"""
Test de saturación de intereses en ia-engine.ts
Mide calidad del itinerario de 2 a 10 intereses.

Métricas por combinación:
  - paradas generadas
  - cobertura (% de intereses representados en el resultado)
  - distancia total de ruta (KNN eficiencia)
  - balance gastronómico (gastro/total)
  - slots desperdiciados por garantía vs selección óptima
"""

import json, time, math, socket, urllib.request, urllib.error
from itertools import combinations

IA = "http://localhost:3003"
BASE_DATE = "2026-06-18"   # día normal (no partido)
START_TIME = "09:00"
BUDGET     = 600
RITMO      = "normal"
SEEDS      = [20260618, 20260619, 20260620]  # 3 seeds para promediar

# Los 10 intereses disponibles
ALL_INTERESTS = [
    "cultura",
    "gastronomia",
    "cafeterias",
    "fotografia",
    "arquitectura",
    "arte",
    "naturaleza",
    "compras",
    "vida-nocturna",
    "futbol",
]

# Combinaciones representativas a probar (de 2 a 10)
COMBOS = {
    2: ["cultura", "gastronomia"],
    3: ["cultura", "gastronomia", "cafeterias"],
    4: ["cultura", "gastronomia", "cafeterias", "fotografia"],
    5: ["cultura", "gastronomia", "cafeterias", "fotografia", "arquitectura"],
    6: ["cultura", "gastronomia", "cafeterias", "fotografia", "arquitectura", "arte"],
    7: ["cultura", "gastronomia", "cafeterias", "fotografia", "arquitectura", "arte", "naturaleza"],
    8: ["cultura", "gastronomia", "cafeterias", "fotografia", "arquitectura", "arte", "naturaleza", "compras"],
    9: ["cultura", "gastronomia", "cafeterias", "fotografia", "arquitectura", "arte", "naturaleza", "compras", "vida-nocturna"],
    10: ALL_INTERESTS[:],
}

# ── helpers ───────────────────────────────────────────────────────────────────

def server_up():
    try:
        s = socket.socket(); s.settimeout(1); r = s.connect_ex(("localhost", 3003)); s.close()
        return r == 0
    except: return False

def call_itinerary(interests, seed):
    body = json.dumps({
        "interests": interests,
        "budget": BUDGET,
        "selectedDate": BASE_DATE,
        "startTime": START_TIME,
        "ritmo": RITMO,
        "seed": seed,
    }).encode()
    req = urllib.request.Request(f"{IA}/api/itinerary",
        data=body, headers={"Content-Type":"application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:200]}
    except Exception as e:
        return {"error": str(e)}

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    d1 = (lat2-lat1)*math.pi/180; d2 = (lng2-lng1)*math.pi/180
    a = math.sin(d1/2)**2 + math.cos(lat1*math.pi/180)*math.cos(lat2*math.pi/180)*math.sin(d2/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def route_km(stops):
    """Distancia total de la ruta (km)."""
    total = 0.0
    prev = None
    for s in stops:
        p = s.get("place", {})
        lat, lng = p.get("lat"), p.get("lng")
        if lat and lng and prev:
            total += haversine(prev[0], prev[1], lat, lng)
        if lat and lng:
            prev = (lat, lng)
    return round(total, 2)

INTEREST_KEYWORDS = {
    "cultura":       ["cultura","museo","museos","arte e historia","arquitectura","historico","patrimonio"],
    "gastronomia":   ["gastronomia","mexicana","postre","vegana","comida calle","birria","torta","pozole","taco","fonda"],
    "cafeterias":    ["cafeteria","cafe","brunch","cafe de especialidad","cafetería"],
    "fotografia":    ["fotografia","mirador","vista"],
    "arquitectura":  ["arquitectura","historico","patrimonio"],
    "arte":          ["arte e historia","arte"],
    "naturaleza":    ["naturaleza","parque","verde"],
    "compras":       ["compras"],
    "vida-nocturna": ["nocturna","bar","cantina"],
    "futbol":        ["futbol","fan zone","fanzone","deportivo"],
}

def interest_covered(cat_raw, interest):
    cat = cat_raw.lower()
    import unicodedata
    cat = unicodedata.normalize("NFD", cat)
    cat = "".join(c for c in cat if unicodedata.category(c) != "Mn")
    return any(kw in cat for kw in INTEREST_KEYWORDS.get(interest, []))

def coverage(stops, interests):
    """Fracción de intereses que tienen al menos 1 parada."""
    covered = set()
    for s in stops:
        cat = s.get("place", {}).get("categoria", "")
        for i in interests:
            if interest_covered(cat, i):
                covered.add(i)
    return len(covered) / len(interests) if interests else 0

def gastro_ratio(stops):
    """Fracción de paradas gastronómicas (restaurantes+cafés)."""
    food = sum(1 for s in stops if
        interest_covered(s.get("place",{}).get("categoria",""), "gastronomia") or
        interest_covered(s.get("place",{}).get("categoria",""), "cafeterias"))
    return food / len(stops) if stops else 0

def diversity_score(stops):
    """Categorías únicas / paradas — qué tan variado es el itinerario."""
    cats = set()
    for s in stops:
        cat = s.get("place",{}).get("categoria","")
        # tomar primera categoría del lugar
        cats.add(cat.split(",")[0].strip().lower() if cat else "?")
    return round(len(cats) / len(stops), 2) if stops else 0

# ── runner ────────────────────────────────────────────────────────────────────

GREEN  = "\033[32m"; YELLOW = "\033[33m"; RED = "\033[31m"
CYAN   = "\033[36m"; BOLD   = "\033[1m";  RESET = "\033[0m"

def color_stops(n, max_possible):
    if n >= max(max_possible - 1, 4): return f"{GREEN}{BOLD}{n}{RESET}"
    if n >= 3: return f"{YELLOW}{n}{RESET}"
    return f"{RED}{BOLD}{n}{RESET}"

def color_cov(c):
    pct = int(c*100)
    if pct >= 90: return f"{GREEN}{BOLD}{pct}%{RESET}"
    if pct >= 65: return f"{YELLOW}{pct}%{RESET}"
    return f"{RED}{BOLD}{pct}%{RESET}"

def main():
    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{CYAN}║  PITZBOL IA — Test de saturación de intereses                ║{RESET}")
    print(f"{BOLD}{CYAN}╚══════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  {BASE_DATE} | {START_TIME} | Presupuesto ${BUDGET} MXN | Ritmo {RITMO}")
    print(f"  Seeds: {SEEDS} ({len(SEEDS)} ejecuciones por combinación)\n")

    if not server_up():
        print(f"  {RED}✗ pitzbol-web no está disponible en :3003{RESET}")
        return

    results = {}

    for n_interests, interests in COMBOS.items():
        stops_counts, coverages, distances, gastros, diversities, errors = [], [], [], [], [], 0

        print(f"{BOLD}N={n_interests:2d}{RESET} [{', '.join(interests)}]")

        for seed in SEEDS:
            resp = call_itinerary(interests, seed)
            if "error" in resp:
                errors += 1
                print(f"       seed={seed} → ERROR: {resp}")
                continue

            stops = resp.get("stops", [])
            n = len(stops)
            cov = coverage(stops, interests)
            km = route_km(stops)
            gr = gastro_ratio(stops)
            div = diversity_score(stops)

            stops_counts.append(n)
            coverages.append(cov)
            distances.append(km)
            gastros.append(gr)
            diversities.append(div)

            names = [s.get("place",{}).get("nombre","?")[:22] for s in stops]
            print(f"       seed={seed} → {n} paradas | cov={int(cov*100)}% | {km:.1f}km | gastro={int(gr*100)}%")
            print(f"         → {' → '.join(names)}")

        if stops_counts:
            avg_stops = sum(stops_counts)/len(stops_counts)
            avg_cov   = sum(coverages)/len(coverages)
            avg_km    = sum(distances)/len(distances)
            avg_gr    = sum(gastros)/len(gastros)
            avg_div   = sum(diversities)/len(diversities)

            results[n_interests] = {
                "interests": interests,
                "avg_stops": round(avg_stops, 1),
                "avg_coverage_pct": round(avg_cov*100, 1),
                "avg_route_km": round(avg_km, 1),
                "avg_gastro_pct": round(avg_gr*100, 1),
                "avg_diversity": avg_div,
                "errors": errors,
            }

            # Estimación del max teórico de slots
            available_mins = 19*60 - (int(START_TIME.split(":")[0])*60)
            mins_per_place = 75  # normal
            max_slots = min(12, max(2, available_mins // mins_per_place))

            print(f"  {BOLD}→ Promedio:{RESET} {color_stops(avg_stops, max_slots)} paradas"
                  f" | cobertura={color_cov(avg_cov)}"
                  f" | ruta={avg_km:.1f}km"
                  f" | gastro={int(avg_gr*100)}%"
                  f" | diversidad={avg_div}")

            # señal de advertencia
            uncovered = n_interests - round(avg_cov * n_interests)
            if uncovered > 0:
                print(f"  {YELLOW}⚠ ~{uncovered} interés(es) sin representación promedio{RESET}")
            if avg_km > 8:
                print(f"  {YELLOW}⚠ Ruta larga: {avg_km:.1f}km (>8km — lugares dispersos){RESET}")
            if avg_cov < 0.65:
                print(f"  {RED}✗ Cobertura baja: sólo {int(avg_cov*100)}% de intereses representados{RESET}")
        print()

    # ── Análisis de inflexión ──────────────────────────────────────────────────
    print(f"{BOLD}{CYAN}═══════════════════ ANÁLISIS DE INFLEXIÓN ═══════════════════{RESET}")
    print(f"\n{'N':>3} {'Paradas':>8} {'Cobertura':>10} {'Ruta km':>8} {'Diversidad':>11} {'Calidad':>8}")
    print("─"*55)

    quality_scores = {}
    for n, r in results.items():
        # Score de calidad 0-100:
        # - cobertura: 40 pts
        # - diversidad (normalizada): 30 pts
        # - ruta inversa (menos km = mejor): 30 pts
        cov_pts  = r["avg_coverage_pct"] / 100 * 40
        div_pts  = min(r["avg_diversity"], 1.0) * 30
        km_cap   = 15.0  # a partir de 15km empieza a penalizar
        km_pts   = max(0, 30 - (r["avg_route_km"] / km_cap) * 30)
        score    = round(cov_pts + div_pts + km_pts, 1)
        quality_scores[n] = score

        cov_str = f"{r['avg_coverage_pct']:.0f}%"
        stops_str = f"{r['avg_stops']:.1f}"
        km_str = f"{r['avg_route_km']:.1f}"
        div_str = f"{r['avg_diversity']:.2f}"

        # Color por score
        if score >= 75:   col = GREEN
        elif score >= 55: col = YELLOW
        else:             col = RED

        print(f"{n:>3} {stops_str:>8} {cov_str:>10} {km_str:>8} {div_str:>11} {col}{BOLD}{score:>7.1f}{RESET}")

    print()

    # Encontrar el máximo óptimo
    best_n = max(quality_scores, key=lambda n: quality_scores[n])
    # Punto de inflexión: primer N donde el score cae >10% respecto al máximo
    max_score = max(quality_scores.values())
    inflection = None
    for n in sorted(quality_scores.keys()):
        if quality_scores[n] < max_score * 0.85:
            inflection = n
            break

    print(f"{BOLD}Mejor configuración:{RESET}  N={best_n} intereses (score={quality_scores.get(best_n,'?')})")
    if inflection:
        recommended_max = inflection - 1
        print(f"{BOLD}Punto de inflexión:{RESET}   N={inflection} intereses (calidad cae >15%)")
        print(f"{BOLD}{GREEN}→ MÁXIMO RECOMENDADO: {recommended_max} intereses{RESET}")
    else:
        recommended_max = max(quality_scores.keys())
        print(f"{BOLD}{GREEN}→ No se detectó inflexión clara — máximo: {recommended_max}{RESET}")

    # Análisis de la razón del degradamiento
    print(f"\n{BOLD}Análisis de causa:{RESET}")
    available_mins = 19*60 - (int(START_TIME.split(":")[0])*60)
    max_slots = min(12, max(2, available_mins // 75))
    print(f"  • Slots disponibles en un día (9:00-19:00, normal): {max_slots}")
    for n in sorted(results.keys()):
        r = results[n]
        guarantee_slots = n  # 1 slot por interés mínimo garantizado
        free_slots = max(0, max_slots - guarantee_slots)
        print(f"  • N={n}: {guarantee_slots} slots para garantía + {free_slots} para optimización KNN")

    print(f"\n  {CYAN}→ Con N>{max_slots}: el bucle de garantía consume TODOS los slots{RESET}")
    print(f"  {CYAN}→ Con N={max_slots}: 0 slots libres para selección óptima{RESET}")
    print(f"  {CYAN}→ Óptimo real: N ≤ {max_slots - 2} (deja ≥2 slots libres para KNN){RESET}")

    print(f"\n{BOLD}→ Valor sugerido para el formulario: {GREEN}máximo {recommended_max} intereses{RESET}")
    print()

    return recommended_max

if __name__ == "__main__":
    main()
