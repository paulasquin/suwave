"""Extrude the laser-cut drawings (DXF, millimetres) of the 2017 anchor mechanism into meshes. Writes assets/models/<name>.raw.glb (run meshopt afterwards).

    uv run --with ezdxf --with shapely --with trimesh --with numpy --with scipy --with networkx --with mapbox-earcut \
        python -I tools/build_dxf_parts.py ~/scratch/suwave-src/drive/Drone
"""
import sys, pathlib, math
import numpy as np, trimesh, ezdxf
from ezdxf import path as dpath
from shapely.geometry import Polygon, LineString
from shapely.ops import polygonize, unary_union

src = pathlib.Path(sys.argv[1]).expanduser()
out = pathlib.Path("assets/models"); out.mkdir(parents=True, exist_ok=True)

def profile(dxf):
    msp = ezdxf.readfile(dxf).modelspace()
    lines = []
    for e in msp:
        if e.dxftype() in ("LINE", "ARC", "CIRCLE", "SPLINE", "LWPOLYLINE", "ELLIPSE"):
            p = dpath.make_path(e)
            pts = [(round(v.x, 2), round(v.y, 2)) for v in p.flattening(0.05)]
            if len(pts) > 1: lines.append(LineString(pts))
    from shapely import snap
    u = unary_union(lines)
    polys = sorted(polygonize(snap(u, u, 0.05)), key=lambda p: -p.area)
    outer = polys[0]
    holes = [p for p in polys[1:] if outer.contains(p.representative_point())]
    # Nested faces come out as separate polygons: keep only first-level holes.
    shape = outer
    for h in holes: shape = shape.difference(h)
    return shape

def extrude(shape, t):
    m = trimesh.creation.extrude_polygon(shape, t)
    m.apply_translation([0, 0, -t / 2])
    return m

def save(m, name):
    m.merge_vertices()
    s = trimesh.graph.smooth_shade(m, angle=np.radians(28))
    s.export(out / f"{name}.raw.glb", include_normals=True)
    print(name, len(s.faces), "faces", np.round(s.bounds, 1).tolist())

T = 3.0  # laser-cut sheet thickness (mm), assumed
cr = src / "Croisillon/A realiser"
for n in ("Bras", "Moignon"):
    shp = profile(cr / f"{n}.DXF")
    c = shp.centroid
    from shapely import affinity
    shp = affinity.translate(shp, -c.x, -c.y)
    save(extrude(shp, T), n.lower())

