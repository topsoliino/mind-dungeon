"""Shared geometric finishing pass for Mind Dungeon's Guardian-style Blender actors.

The playable Guardian uses deliberate polygon profiles, small bevels, weighted
normals and *material* boundaries instead of a pile of smooth primitives.
Enemies must apply the same approach before skinned mesh joining / GLB export.
This module is imported by BOTH build scripts, also for fallback atlases.
"""
import math
import bpy


def profile_mesh(name, rings, materials, axis="y", sides=10, face_material=None):
    """A closed, art-directed volume made of polygonal profiles, not UV spheres.

    Y rings: (y, cx, cz, radius_x, radius_z) for creatures/helmet depth.
    Z rings: (z, cx, cy, radius_x, radius_y) for armored upright forms.
    Every band is a readable planar surface; select a second material on a
    particular facet to emphasize light edges without noisy tiny geometry.
    """
    if axis not in ("y", "z") or sides < 6 or len(rings) < 3:
        raise ValueError("profile_mesh requires an axis, >=6 sides, >=3 rings")
    vertices = []
    for elevation, cx, cy, rx, ry in rings:
        for index in range(sides):
            angle = 2 * math.pi * (index + .5) / sides
            u, v = rx * math.cos(angle), ry * math.sin(angle)
            vertices.append(
                (cx + u, elevation, cy + v) if axis == "y"
                else (cx + u, cy + v, elevation))
    faces = []
    indices = []
    for band in range(len(rings) - 1):
        for side in range(sides):
            a = band * sides + side
            b = band * sides + (side + 1) % sides
            faces.append((a, a+sides, b+sides, b) if axis == "y"
                         else (a, b, b+sides, a+sides))
            idx = 0 if face_material is None else face_material(band, side)
            indices.append(max(0, min(len(materials)-1, int(idx))))
    cap = tuple(range(sides))
    end = tuple(range((len(rings)-1)*sides, len(rings)*sides))
    faces.extend((cap, tuple(reversed(end))) if axis == "y"
                 else (tuple(reversed(cap)), end))
    indices.extend((0,0))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in materials:
        mesh.materials.append(material)
    mesh.polygons.foreach_set("material_index", indices)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def forged_hard_edges(obj, width=.004):
    """Bake Guardian-like micro-bevels and weighted normals into a rigid part.

    Call AFTER world transforms have been baked into mesh vertices but BEFORE
    assigning rigid skin weights and joining the armature's individual parts.
    A modifier left unapplied may disappear on GLB export, so bake both now.
    Sculpted silhouette profiles and tiny seams deliberately stay planar.
    """
    if obj.type != "MESH" or len(obj.data.polygons) < 4:
        return
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new("Guardian forged edge bevel", "BEVEL")
    bevel.width = width
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = .45
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Weighted normals must have smoothing enabled. Sharp angles keep a
    # genuine edge, while the new bevel facets retain coherent light sweeps.
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if hasattr(obj.data, "use_auto_smooth"):
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = .64
    weighted = obj.modifiers.new("Guardian weighted normals", "WEIGHTED_NORMAL")
    weighted.keep_sharp = True
    weighted.weight = 60
    bpy.ops.object.modifier_apply(modifier=weighted.name)
