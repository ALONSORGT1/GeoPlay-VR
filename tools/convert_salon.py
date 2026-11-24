"""Convert this SketchUp COLLADA export to a metre-based GLB. Requires numpy and Pillow.

python tools/convert_salon.py ../../salon.dae assets/salon.glb
"""
from collections import defaultdict
from io import BytesIO
from pathlib import Path
import itertools
import json
import struct
import sys
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image


def convert(source, output):
    root = ET.parse(source).getroot()
    for element in root.iter():
        element.tag = element.tag.split("}")[-1]
    ids = {e.get("id"): e for e in root.iter() if e.get("id")}
    unit = float(root.find("asset/unit").get("meter"))
    assert root.findtext("asset/up_axis") == "Z_UP"
    # Face the south board from the floor centre. Both bases are right handed.
    basis = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]])
    gltf = dict(asset={"version": "2.0", "generator": "convert_salon.py"},
                scene=0, scenes=[{"nodes": []}], nodes=[], meshes=[], materials=[],
                accessors=[], bufferViews=[], textures=[], images=[])
    binary = bytearray()

    def view(data):
        binary.extend(bytes(-len(binary) % 4))
        gltf["bufferViews"].append(dict(buffer=0, byteOffset=len(binary), byteLength=len(data)))
        binary.extend(data)
        return len(gltf["bufferViews"]) - 1

    def accessor(data, kind, component=5126):
        record = dict(bufferView=view(data.tobytes()), componentType=component, count=len(data), type=kind)
        if kind == "VEC3":
            record.update(min=data.min(axis=0).tolist(), max=data.max(axis=0).tolist())
        gltf["accessors"].append(record)
        return len(gltf["accessors"]) - 1

    materials = {}
    for mat in root.findall(".//library_materials/material"):
        effect = ids[mat.find("instance_effect").get("url")[1:]]
        name = mat.get("name")
        colors = list(map(float, effect.findtext(".//diffuse/color", "1 1 1 1").split()))
        # SketchUp diffuse swatches use sRGB. glTF baseColorFactor uses linear RGB.
        colors[:3] = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in colors[:3]]
        pbr = dict(baseColorFactor=colors, roughnessFactor=.84, metallicFactor=0)
        material = dict(name=name, pbrMetallicRoughness=pbr)
        if colors[3] < 1:
            material.update(alphaMode="BLEND")
            pbr.update(roughnessFactor=.18)
        if "Aluminio" in name:
            pbr.update(roughnessFactor=.42, metallicFactor=.45)
        texture_id = effect.findtext(".//surface/init_from")
        if texture_id:
            path = source.parent / ids[texture_id].findtext("init_from")
            with Image.open(path) as image:
                image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                stream = BytesIO()
                image.save(stream, image.format, optimize=True)
            idx = len(gltf["images"])
            gltf["images"].append(dict(mimeType=Image.MIME[image.format], bufferView=view(stream.getvalue())))
            gltf["textures"].append(dict(source=idx))
            pbr.update(baseColorTexture={"index": idx})
        materials[mat.get("id")] = len(gltf["materials"])
        gltf["materials"].append(material)

    batches = defaultdict(list)
    solids = []
    bounds = {}
    nodes = root.findall(".//visual_scene/node/node")

    def visit(node, parent, name):
        matrix = parent
        if node.find("matrix") is not None:
            matrix = parent @ np.fromstring(node.findtext("matrix"), sep=" ").reshape(4, 4)
        for inst in node.findall("instance_node"):
            visit(ids[inst.get("url")[1:]], matrix, name)
        for child in node.findall("node"):
            visit(child, matrix, name)
        for inst in node.findall("instance_geometry"):
            mesh = ids[inst.get("url")[1:]].find("mesh")
            bindings = {m.get("symbol"): materials[m.get("target")[1:]] for m in inst.iter("instance_material")}
            arrays = {s.get("id"): np.fromstring(s.findtext("float_array"), sep=" ").reshape(
                -1, int(s.find(".//accessor").get("stride"))) for s in mesh.findall("source")}
            vertices = {i.get("semantic"): arrays[i.get("source")[1:]] for i in mesh.findall("vertices/input")}
            positions = ((vertices["POSITION"] @ matrix[:3, :3].T + matrix[:3, 3]) * unit) @ basis.T
            lo, hi = positions.min(0), positions.max(0)
            bounds.setdefault(name, []).extend([lo, hi])
            architecture = name != "instance_0"
            if architecture and name != "piso":
                # Each architectural leaf in this export is one axis-aligned solid.
                corners = np.unique(positions.round(5), axis=0)
                assert set(map(tuple, corners)) == set(itertools.product(*zip(lo.round(5), hi.round(5)))), name
                solids.append((name, lo, hi))
            for primitive in [*mesh.findall("triangles"), *mesh.findall("lines")]:
                offsets = {i.get("semantic"): int(i.get("offset")) for i in primitive.findall("input")}
                indices = np.fromstring(primitive.findtext("p"), dtype=int, sep=" ").reshape(-1, max(offsets.values()) + 1)
                vertex = indices[:, offsets["VERTEX"]]
                pos = positions[vertex]
                mode = 4 if primitive.tag == "triangles" else 1
                columns = [pos]
                if mode == 4:
                    normals = vertices["NORMAL"][vertex] @ np.linalg.inv(matrix[:3, :3]) @ basis.T
                    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
                    columns.append(normals)
                if "TEXCOORD" in offsets:
                    uv_input = primitive.find("input[@semantic='TEXCOORD']")
                    uv = arrays[uv_input.get("source")[1:]][indices[:, offsets["TEXCOORD"]]].copy()
                    uv[:, 1] = 1 - uv[:, 1]
                    columns.append(uv)
                rows = np.column_stack(columns)
                if architecture:
                    # SketchUp exports a second, inward-facing triangle on every box face.
                    tri = pos.reshape(-1, 3, 3)
                    cross = np.cross(tri[:, 1]-tri[:, 0], tri[:, 2]-tri[:, 0])
                    outward = cross[:, 1] if name == "piso" else ((tri.mean(1)-(hi+lo)/2)*cross).sum(1)
                    rows = rows[np.repeat(outward > 0, 3)]
                key = (architecture, bindings[primitive.get("material")], mode)
                batches[key].append(rows)

    for node in nodes:
        visit(node, np.eye(4), node.get("name"))

    origin = np.mean(bounds["piso"], axis=0)
    for architecture in [True, False]:
        primitives = []
        for (arch, material, mode), pieces in batches.items():
            if arch != architecture:
                continue
            values = np.vstack(pieces)
            values[:, :3] -= origin
            unique, indices = np.unique(values.astype("<f4"), axis=0, return_inverse=True)
            assert len(unique) < 65536
            attrs = {"POSITION": accessor(unique[:, :3], "VEC3")}
            if mode == 4:
                attrs["NORMAL"] = accessor(unique[:, 3:6], "VEC3")
            if unique.shape[1] == 8:
                attrs["TEXCOORD_0"] = accessor(unique[:, 6:8], "VEC2")
            primitives.append(dict(attributes=attrs, material=material, mode=mode,
                                   indices=accessor(indices.astype("<u2"), "SCALAR", 5123)))
        idx = len(gltf["nodes"])
        gltf["scenes"][0]["nodes"].append(idx)
        gltf["meshes"].append(dict(primitives=primitives))
        node = dict(mesh=idx, name="Salon" if architecture else "ThomThom")
        if architecture:
            node["extras"] = dict(solids=[dict(name=n, min=(lo-origin).round(5).tolist(),
                                               max=(hi-origin).round(5).tolist()) for n, lo, hi in solids],
                                  floorSize=np.ptp(bounds["piso"], axis=0).round(5).tolist())
        gltf["nodes"].append(node)
    gltf["buffers"] = [dict(byteLength=len(binary))]
    header = json.dumps(gltf, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    binary.extend(bytes(-len(binary) % 4))
    output.write_bytes(struct.pack("<4sII", b"glTF", 2, 28+len(header)+len(binary))
                       + struct.pack("<I4s", len(header), b"JSON") + header
                       + struct.pack("<I4s", len(binary), b"BIN\0") + binary)


if __name__ == "__main__":
    convert(*map(Path, sys.argv[1:]))
