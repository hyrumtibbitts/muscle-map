#!/usr/bin/env python3
"""
Build public/models/body.glb from the BodyExplorer mesh set.

Input (not in this repo, see README "Body model"):
  anatomy.glb   467 muscle meshes  (BodyParts3D + Z-Anatomy, decimated by BodyExplorer)
  skeleton.glb  201 bone meshes

Output: one glb with
  zone_<muscle_id>  x32  merged, decimated, tappable
  filler            neck / hand / foot / intercostal muscles, not tappable
  skeleton          all bones, one mesh

Units: source is mm, Z-up. Output is metres, Y-up, centred at origin, front = +Z.

Usage: python3 scripts/build-body-model.py <dir with anatomy.glb + skeleton.glb> [out.glb]
"""
import json, re, sys
from pathlib import Path
import numpy as np
import trimesh
import fast_simplification

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "public/models/body.glb"

# zone id -> list of base-name patterns (regex, matched against lower-case name with left/right removed)
ZONES = {
    "pec_upper": [r"^clavicular part of pectoralis major$"],
    "pec_lower": [r"^sternocostal part of pectoralis major$", r"^abdominal part of pectoralis major$"],
    "serratus_anterior": [r"^serratus anterior$"],
    "deltoid_anterior": [r"^clavicular part of deltoid$"],
    "deltoid_lateral": [r"^acromial part of deltoid$"],
    "deltoid_posterior": [r"^spinal part of deltoid$"],
    "rotator_cuff": [r"^infraspinatus", r"^supraspinatus$", r"^teres minor$", r"^subscapularis$"],
    "biceps_brachii": [r"head of biceps brachii$", r"^coracobrachialis$"],
    "brachialis": [r"^brachialis$"],
    "triceps_brachii": [r"head of triceps brachii$", r"^anconeus$"],
    "forearm_flexors": [
        r"^flexor carpi radialis$", r"^palmaris longus$", r"head of flexor carpi ulnaris$", r"head of pronator teres$",
        r"^flexor digitorum superficialis", r"^flexor digitorum profundus$", r"^flexor pollicis longus$", r"^pronator quadratus$",
    ],
    "forearm_extensors": [
        r"^extensor carpi radialis", r"^extensor carpi ulnaris", r"^extensor digitorum$", r"^extensor digiti minimi$",
        r"^extensor indicis$", r"^extensor pollicis", r"^abductor pollicis longus$", r"^supinator$", r"^brachioradialis$",
    ],
    "rectus_abdominis": [r"^rectus abdominis$"],
    "obliques": [r"^external oblique$", r"^internal oblique$"],
    "transverse_abdominis": [r"^transversus abdominis$"],
    "erector_spinae": [
        r"^iliocostalis", r"^longissimus thoracis$", r"^longissimus cervicis$", r"^spinalis", r"^multifidus lumborum$",
    ],
    "latissimus_dorsi": [r"^latissimus dorsi$"],
    "teres_major": [r"^teres major$"],
    "trapezius_upper": [r"^descending part of trapezius$"],
    "trapezius_mid": [r"^transverse part of trapezius$"],
    "trapezius_lower": [r"^ascending part of trapezius$"],
    "rhomboids": [r"^rhomboid major$", r"^rhomboid minor$"],
    "gluteus_maximus": [r"^gluteus maximus$"],
    "gluteus_medius": [r"^gluteus medius$", r"^gluteus minimus$"],
    "quadriceps": [r"^rectus femoris$", r"^vastus", r"^sartorius$"],
    "hamstrings": [r"head of biceps femoris$", r"^semimembranosus$", r"^semitendinosus$"],
    "hip_adductors": [r"^adductor (longus|brevis|magnus|minimus)$", r"^gracilis$", r"^pectineus$"],
    "hip_flexors": [r"^iliacus$", r"^psoas major$"],
    "gastrocnemius": [r"head of gastrocnemius$", r"^plantaris$"],
    "soleus": [r"^soleus$", r"^tibialis posterior$", r"^flexor digitorum longus$", r"^flexor hallucis longus$", r"^popliteus$"],
    "tibialis_anterior": [r"^tibialis anterior$", r"^extensor digitorum longus$", r"^extensor hallucis longus$", r"^fibularis"],
    "neck": [
        r"^sternocleidomastoid$", r"^scalenus", r"^splenius", r"^levator scapulae$", r"^semispinalis capitis$",
        r"^longissimus capitis$", r"^semispinalis cervicis$", r"^longus capitis$", r"^longus colli$", r"part of longus colli$",
        r"^omohyoid$", r"^sternohyoid$", r"^sternothyroid$", r"^thyrohyoid$",
    ],
}

# Not tappable, drawn neutral so the body is not hollow.
FILLER = [
    r"^external intercostal muscle$",
    r"^pectoralis minor$", r"^subclavius$", r"^serratus posterior",
    r"of hand$", r"of foot$", r"^abductor hallucis$", r"^abductor pollicis brevis$", r"^opponens", r"^flexor digitorum brevis$",
    r"^flexor hallucis brevis$", r"head of flexor hallucis brevis$", r"head of adductor (hallucis|pollicis)$",
    r"^flexor pollicis brevis$", r"head of flexor pollicis brevis$", r"^extensor hallucis brevis$", r"^flexor accessorius$",
    r"lumbrical", r"interosse",
]

# Face budget after decimation.
ZONE_FACES_MAX = 22000
ZONE_FACES_MIN = 3000
FILLER_FACES = 45000
SKELETON_FACES = 90000


def base_name(n: str) -> str:
    n = n.lower()
    n = re.sub(r"\b(left|right)\b", "", n)
    n = re.sub(r"\s*\(\d+\)\s*$", "", n)  # "(2)" suffixes
    return re.sub(r"\s+", " ", n).strip()


def classify(name: str):
    b = base_name(name)
    for zone, pats in ZONES.items():
        if any(re.search(p, b) for p in pats):
            return zone
    if any(re.search(p, b) for p in FILLER):
        return "filler"
    return None


def clip_oblique_sheet(obliques, rectus):
    """The oblique meshes include the aponeurosis, a flat tendon sheet that covers the
    rectus abdominis. Remove the part of the sheet in front of the rectus so the abs
    are visible and tappable. Source frame: anterior is -Y, x is left/right."""
    rv = np.vstack([g.vertices for g in rectus])
    edge = np.abs(rv[:, 0]).max()
    front_limit = rv[:, 1].max() + 45  # a little behind the rectus, so the sheet over the pubis goes too
    out = []
    for g in obliques:
        c = g.triangles_center
        drop = (np.abs(c[:, 0]) < edge * 0.92) & (c[:, 1] < front_limit)
        g = g.copy()
        g.update_faces(~drop)
        g.remove_unreferenced_vertices()
        out.append(g)
    return out


def merge(meshes):
    return trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0].copy()


def finish(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Weld shared vertices so normals average across faces (smooth shading)."""
    mesh.merge_vertices(merge_tex=True, merge_norm=True)
    mesh.remove_unreferenced_vertices()
    _ = mesh.vertex_normals  # compute and cache, exported with include_normals
    return mesh


def decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    if len(mesh.faces) <= target_faces:
        return mesh
    reduction = 1.0 - target_faces / len(mesh.faces)
    v, f = fast_simplification.simplify(mesh.vertices.astype(np.float32), mesh.faces.astype(np.int64), target_reduction=reduction)
    m = trimesh.Trimesh(vertices=v, faces=f, process=False)
    m.remove_unreferenced_vertices()
    return m


def load_geoms(path: Path):
    sc = trimesh.load(path, force="scene")
    out = {}
    for node in sc.graph.nodes_geometry:
        T, gname = sc.graph[node]
        g = sc.geometry[gname].copy()
        if not np.allclose(T, np.eye(4)):
            g.apply_transform(T)
        out[node] = g
    return out


def main():
    anatomy = load_geoms(SRC / "anatomy.glb")
    skeleton = load_geoms(SRC / "skeleton.glb")
    mapping = {m["name"]: m for m in json.load(open(SRC / "mesh_mapping.json"))}

    groups: dict[str, list] = {z: [] for z in ZONES}
    groups["filler"] = []
    dropped, tendons = [], 0
    for name, g in anatomy.items():
        meta = mapping.get(name)
        if meta and meta.get("isTendon"):
            tendons += 1
            continue
        z = classify(name)
        if z is None:
            dropped.append(name)
            continue
        groups[z].append(g)

    if groups["obliques"] and groups["rectus_abdominis"]:
        groups["obliques"] = clip_oblique_sheet(groups["obliques"], groups["rectus_abdominis"])

    # Front direction: anterior muscles have a smaller (more negative) source Y than spinal muscles.
    ant = np.mean([g.centroid[1] for g in groups["rectus_abdominis"]])
    post = np.mean([g.centroid[1] for g in groups["erector_spinae"]])
    anterior_is_neg_y = ant < post

    # Z-up mm -> Y-up m, front = +Z, centred.
    R = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=float)  # (x,y,z)->(x,z,-y)
    if not anterior_is_neg_y:
        R = np.diag([-1, 1, -1, 1]) @ R  # rotate 180 deg about Y
    all_pts = np.vstack([g.vertices for gs in groups.values() for g in gs] + [g.vertices for g in skeleton.values()])
    all_pts = trimesh.transform_points(all_pts, R)
    lo, hi = all_pts.min(0), all_pts.max(0)
    center = (lo + hi) / 2
    T = trimesh.transformations.translation_matrix(-center)
    S = trimesh.transformations.scale_matrix(0.001)
    XF = S @ T @ R

    scene = trimesh.Scene()
    report = {}
    total = 0
    zone_face_total = sum(sum(len(g.faces) for g in gs) for z, gs in groups.items() if z != "filler")
    for z, gs in groups.items():
        if not gs:
            report[z] = {"meshes": 0, "faces": 0}
            print(f"WARNING: zone {z} has no meshes")
            continue
        m = merge(gs)
        before = len(m.faces)
        if z == "filler":
            target = FILLER_FACES
        else:
            target = int(np.clip(before, ZONE_FACES_MIN, ZONE_FACES_MAX))
        m = decimate(m, target)
        m.apply_transform(XF)
        m = finish(m)
        name = z if z == "filler" else f"zone_{z}"
        scene.add_geometry(m, node_name=name, geom_name=name)
        report[z] = {"meshes": len(gs), "faces_in": before, "faces_out": len(m.faces)}
        total += len(m.faces)

    sk = decimate(merge(list(skeleton.values())), SKELETON_FACES)
    sk.apply_transform(XF)
    sk = finish(sk)
    scene.add_geometry(sk, node_name="skeleton", geom_name="skeleton")
    total += len(sk.faces)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    scene.export(OUT, include_normals=True)

    print(f"front = +Z (anterior was {'-Y' if anterior_is_neg_y else '+Y'} in source)")
    print(f"height {(hi - lo)[1] / 1000:.3f} m, width {(hi - lo)[0] / 1000:.3f} m")
    for z, r in report.items():
        print(f"  {z:22s} meshes={r['meshes']:3d} faces {r.get('faces_in', 0):7d} -> {r.get('faces_out', 0):6d}")
    print(f"  skeleton               meshes={len(skeleton):3d} faces -> {len(sk.faces)}")
    print(f"total faces {total}, tendons skipped {tendons}, dropped {len(dropped)} meshes")
    print("dropped:", "; ".join(sorted(set(base_name(n) for n in dropped))))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
