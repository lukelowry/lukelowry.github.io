"""Export local GridKit cases without modifying them. Run: python tools/export-grids.py

Requires Pillow. Network-only JSON, gzip, and data-derived fallback images are published;
the original models remain local and are excluded from Jekyll's output.
"""
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/grids"

def encoded(values, kind):
    return {"base64": base64.b64encode(struct.pack(f"<{len(values)}{kind}", *values)).decode("ascii")}

def paint_layer_poster(draw, points, voltage, visible_edges, visible_vertices, colors, routes=None):
    """Composite complete nominal-kV layers from low to high, including their vertices."""
    layers = {}
    for edge_index, (a, b) in enumerate(visible_edges):
        level = round(voltage[a], 1)
        layers.setdefault(level, {"edges": [], "vertices": []})["edges"].append((a, b, routes[edge_index] if routes else []))
    for vertex in visible_vertices:
        level = round(voltage[vertex], 1)
        layers.setdefault(level, {"edges": [], "vertices": []})["vertices"].append(vertex)
    for level, items in sorted(layers.items()):
        color = colors[level]
        for a, b, route in items["edges"]:
            draw.line((points[a], *route, points[b]), fill=color, width=1)
        for vertex in items["vertices"]:
            x, y = points[vertex]
            draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=color)


def export(name):
    original = (ROOT / "assets/json" / f"{name}.case.json").read_bytes()
    case = json.loads(original)
    buses = case["buses"]
    index = {bus["number"]: i for i, bus in enumerate(buses)}
    if len(index) != len(buses):
        raise ValueError(f"{name}: duplicate bus numbers")
    coords, edges, voltage, branch_voltage = [], [], [], []
    polyline_start, polyline_points, routes = [0], [], []
    for bus in buses:
        location = bus["extension"]
        lon, lat = location["longitude"], location["latitude"]
        if not math.isfinite(lon) or not math.isfinite(lat) or abs(lon) > 180 or abs(lat) > 90:
            raise ValueError(f"{name}: invalid coordinate at {bus['number']}")
        coords.extend((lon, lat))
        kv = bus.get("params", {}).get("kv", location.get("voltage_kv"))
        voltage.append(float(kv) if isinstance(kv, (int, float)) and math.isfinite(kv) and kv > 0 else 0)
    for device in case["devices"]:
        ports = device.get("ports", {})
        if "bus1" in ports and "bus2" in ports:
            a, b = index[ports["bus1"]], index[ports["bus2"]]
            edges.extend((a, b))
            same_level = voltage[a] > 0 and round(voltage[a], 1) == round(voltage[b], 1)
            rating = device.get("extension", {}).get("voltage_kv", voltage[a])
            if same_level and rating is not None and round(rating, 1) != round(voltage[a], 1):
                raise ValueError(f"{name}: branch rating disagrees with its endpoint kV")
            branch_voltage.append(float(rating or voltage[a]) if same_level else 0)
            route = device.get("extension", {}).get("polyline", [])
            # Supplied bend points are already compact. Retain the actual line routes.
            for lon, lat in route:
                if not math.isfinite(lon) or not math.isfinite(lat) or abs(lon) > 180 or abs(lat) > 90:
                    raise ValueError(f"{name}: invalid branch bend")
                polyline_points.extend((lon, lat))
            polyline_start.append(len(polyline_points) // 2)
            if same_level:
                routes.append(route)
    colors = json.loads((ROOT / "tools/grid-voltage-colors.json").read_text(encoding="utf-8"))
    used_levels = sorted({round(voltage[a], 1) for a, b in zip(edges[::2], edges[1::2]) if voltage[a] > 0 and round(voltage[a], 1) == round(voltage[b], 1)})
    colors = {key: value for key, value in colors.items() if float(key) in used_levels}
    if len(colors) != len(used_levels):
        raise ValueError(f"{name}: missing nominal-kV palette entries")
    payload = {
        "topology": {"vertexCount": len(buses), "coordinateSpace": "geographic",
                     "vertexCoords": encoded(coords, "f"), "edges": encoded(edges, "I")},
        "fields": [{"id": "kv", "scope": "vertex", "values": encoded(voltage, "f")},
                   {"id": "branch_kv", "scope": "edge", "values": encoded(branch_voltage, "f")}],
        "voltageColors": colors,
        "busNumbers": encoded([bus["number"] for bus in buses], "I"),
    }
    if polyline_points:
        payload["topology"]["polylineStart"] = encoded(polyline_start, "I")
        payload["topology"]["polylinePoints"] = encoded(polyline_points, "f")
    raw = json.dumps(payload, separators=(",", ":")).encode()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    (DEST / f"{name}.json").write_bytes(raw)
    (DEST / f"{name}.json.gz").write_bytes(packed)
    w, h, pad = 1600, 820, 55
    ys = coords[1::2]
    latitude_scale = math.cos(math.radians((max(ys) + min(ys)) / 2))
    xs = [x * latitude_scale for x in coords[::2]]
    scale = min((w - 2 * pad) / (max(xs) - min(xs)), (h - 2 * pad) / (max(ys) - min(ys)))
    mx, my = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    points = [(w / 2 + (x - mx) * scale, h / 2 - (y - my) * scale) for x, y in zip(xs, ys)]
    visible_edges = [(a, b) for a, b in zip(edges[::2], edges[1::2]) if voltage[a] > 0 and round(voltage[a], 1) == round(voltage[b], 1)]
    visible_vertices = {i for branch in visible_edges for i in branch}
    levels = sorted({round(voltage[i], 1) for i in visible_vertices})
    latitude_scale = math.cos(math.radians((max(ys) + min(ys)) / 2))
    screen_routes = [[(w / 2 + (lon * latitude_scale - mx) * scale, h / 2 - (lat - my) * scale) for lon, lat in route] for route in routes]
    palettes = {theme: [colors[str(int(level))][i] for level in levels] for i, theme in enumerate(("light", "dark"))}
    for theme, palette in palettes.items():
        for kind in ("", "-layers"):
            picture = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(picture)
            neutral = "#8babb5" if theme == "light" else "#476c79"
            if kind:
                paint_layer_poster(draw, points, voltage, visible_edges, visible_vertices, dict(zip(levels, palette)), screen_routes)
            else:
                for (a, b), route in zip(visible_edges, screen_routes):
                    draw.line((points[a], *route, points[b]), fill=neutral, width=1)
                for i in visible_vertices:
                    x, y = points[i]
                    draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=neutral)
            picture.save(DEST / f"{name}{kind}-{theme}.webp", quality=82, method=6)
    return {"vertices": len(buses), "edges": len(edges) // 2, "visibleEdges": len(visible_edges),
            "visibleVertices": len(visible_vertices), "visibleVoltageLevels": levels,
            "unknownVoltageVertices": sum(value <= 0 for value in voltage), "polylinePoints": len(polyline_points) // 2,
            "sourceBytes": len(original), "jsonBytes": len(raw), "gzipBytes": len(packed),
            "sourceSha256": hashlib.sha256(original).hexdigest()}

if __name__ == "__main__":
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {name: export(name) for name in ("USA", "EuropeA")}
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))
