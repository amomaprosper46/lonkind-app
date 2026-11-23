"""
Lonkind Luxury 3D Virtual Gift Generator — "Golden Crown & Diamond"
===================================================================
Self-contained Blender 4.x Python script that programmatically models, shades,
lights, animates, and exports a lightweight Draco-compressed `.glb` asset for
real-time web & mobile viewers (Three.js / React Three Fiber / <model-viewer>).

Usage (Headless / CLI):
    blender --background --python generate_lonkind_gift.py

Usage (Inside Blender 4.x UI):
    Open Scripting tab -> Open `generate_lonkind_gift.py` -> Run Script (Alt+P)

Output:
    ./public/gifts/golden_crown.glb  (typically ~40-120 KB, well under 2 MB)
"""

import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Euler


# =============================================================================
# CONFIGURATION
# =============================================================================
FPS = 24
FRAME_START = 1
FRAME_END = 60
MAX_EXPORT_SIZE_MB = 2.0
OUTPUT_REL_PATH = os.path.join("public", "gifts", "golden_crown.glb")


# =============================================================================
# 1. SCENE RESET & CLEANUP
# =============================================================================
def clear_scene() -> None:
    """Remove all default objects, orphan meshes, materials, lights, cameras, and actions."""
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Extra safety purge for any remaining datablocks
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act, do_unlink=True)

    print("[Lonkind 3D] Default scene cleared.")


# =============================================================================
# 2. BLENDER 4.x PBR MATERIAL HELPERS
# =============================================================================
def _set_bsdf_input(bsdf, name: str, value) -> None:
    """Safely set a Principled BSDF socket across Blender 4.x and 3.6 LTS."""
    aliases = {
        "Emission Color": ("Emission Color", "Emission"),
        "Coat Weight": ("Coat Weight", "Clearcoat"),
        "Coat Roughness": ("Coat Roughness", "Clearcoat Roughness"),
    }
    for candidate in aliases.get(name, (name,)):
        if candidate in bsdf.inputs:
            bsdf.inputs[candidate].default_value = value
            return


def create_pbr_material(
    name: str,
    base_color: tuple,
    metallic: float = 0.0,
    roughness: float = 0.3,
    emission_color: tuple = None,
    emission_strength: float = 0.0,
    ior: float = 1.45,
    coat_weight: float = 0.0,
):
    """Create a clean Principled BSDF material optimized for glTF 2.0 / PBR viewers."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")

    _set_bsdf_input(bsdf, "Base Color", base_color)
    _set_bsdf_input(bsdf, "Metallic", metallic)
    _set_bsdf_input(bsdf, "Roughness", roughness)
    _set_bsdf_input(bsdf, "IOR", ior)

    if coat_weight > 0.0:
        _set_bsdf_input(bsdf, "Coat Weight", coat_weight)
        _set_bsdf_input(bsdf, "Coat Roughness", 0.05)

    if emission_color is not None and emission_strength > 0.0:
        _set_bsdf_input(bsdf, "Emission Color", emission_color)
        _set_bsdf_input(bsdf, "Emission Strength", emission_strength)

    return mat


def build_materials() -> dict:
    """Create luxury gold, brushed gold, royal velvet, cyan gem, ruby gem, and diamond materials."""
    mats = {
        "gold": create_pbr_material(
            name="Lonkind_Luxury_Gold",
            base_color=(1.0, 0.78, 0.22, 1.0),
            metallic=1.0,
            roughness=0.2,
            coat_weight=0.25,
        ),
        "gold_trim": create_pbr_material(
            name="Lonkind_Burnished_Gold",
            base_color=(0.95, 0.68, 0.14, 1.0),
            metallic=1.0,
            roughness=0.24,
        ),
        "velvet": create_pbr_material(
            name="Lonkind_Royal_Velvet",
            base_color=(0.35, 0.02, 0.07, 1.0),
            metallic=0.0,
            roughness=0.78,
        ),
        "cyan_gem": create_pbr_material(
            name="Lonkind_Cyan_Gem",
            base_color=(0.05, 0.92, 1.0, 1.0),
            metallic=0.1,
            roughness=0.06,
            emission_color=(0.0, 0.88, 1.0, 1.0),
            emission_strength=3.2,
            ior=1.77,
            coat_weight=0.8,
        ),
        "ruby_gem": create_pbr_material(
            name="Lonkind_Ruby_Gem",
            base_color=(0.95, 0.05, 0.22, 1.0),
            metallic=0.1,
            roughness=0.07,
            emission_color=(1.0, 0.08, 0.26, 1.0),
            emission_strength=3.0,
            ior=1.77,
            coat_weight=0.8,
        ),
        "diamond": create_pbr_material(
            name="Lonkind_Floating_Diamond",
            base_color=(0.82, 0.97, 1.0, 1.0),
            metallic=0.15,
            roughness=0.04,
            emission_color=(0.45, 0.92, 1.0, 1.0),
            emission_strength=2.2,
            ior=2.417,
            coat_weight=1.0,
        ),
    }
    print("[Lonkind 3D] Luxury PBR materials created.")
    return mats


# =============================================================================
# 3. PROCEDURAL 3D MODELING (STYLIZED GOLDEN CROWN + FLOATING DIAMOND)
# =============================================================================
def link_object(obj, collection=None):
    target_col = collection or bpy.context.scene.collection
    if obj.name not in target_col.objects:
        target_col.objects.link(obj)
    return obj


def set_smooth_shading(obj, smooth: bool = True) -> None:
    if obj.type != "MESH" or not obj.data:
        return
    for poly in obj.data.polygons:
        poly.use_smooth = smooth


def create_crown_band(mat_gold, mat_trim, parent):
    """Build the flared royal crown body with molded lower and upper gold rims."""
    bm = bmesh.new()
    segments = 32
    r_bottom = 0.82
    r_mid = 0.87
    r_top = 0.96
    h_bottom = 0.0
    h_mid = 0.28
    h_top = 0.52
    thickness = 0.085

    # Outer & inner profile loops for a solid, clean manifold crown band
    profile = [
        (r_bottom, h_bottom),
        (r_mid, h_mid),
        (r_top, h_top),
        (r_top - thickness, h_top),
        (r_mid - thickness, h_mid),
        (r_bottom - thickness, h_bottom),
    ]

    rings = []
    for radius, z in profile:
        ring = []
        for i in range(segments):
            ang = (2.0 * math.pi * i) / segments
            v = bm.verts.new((radius * math.cos(ang), radius * math.sin(ang), z))
            ring.append(v)
        rings.append(ring)

    bm.verts.ensure_lookup_table()
    num_loops = len(rings)
    for l_idx in range(num_loops):
        r1 = rings[l_idx]
        r2 = rings[(l_idx + 1) % num_loops]
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((r1[i], r1[j], r2[j], r2[i]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Crown_Band_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    band_obj = bpy.data.objects.new("Crown_Band", mesh)
    band_obj.data.materials.append(mat_gold)
    set_smooth_shading(band_obj, True)
    band_obj.parent = parent
    link_object(band_obj)

    # Molded lower & upper torus rims for luxury jewelry silhouette
    rim_specs = [
        ("Crown_Lower_Rim", 0.825, 0.042, 0.03),
        ("Crown_Upper_Rim", 0.94, 0.034, 0.51),
    ]
    for rim_name, major_r, minor_r, z_pos in rim_specs:
        bpy.ops.mesh.primitive_torus_add(
            major_segments=32,
            minor_segments=12,
            major_radius=major_r,
            minor_radius=minor_r,
            location=(0.0, 0.0, z_pos),
        )
        rim = bpy.context.active_object
        rim.name = rim_name
        rim.data.materials.append(mat_trim)
        set_smooth_shading(rim, True)
        rim.parent = parent

    return band_obj


def create_royal_velvet_cap(mat_velvet, parent):
    """Add a subtle low-poly royal crimson cushion inside the crown."""
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=12,
        radius=0.74,
        location=(0.0, 0.0, 0.24),
    )
    cap = bpy.context.active_object
    cap.name = "Crown_Velvet_Cap"
    cap.scale = (1.0, 1.0, 0.52)
    cap.data.materials.append(mat_velvet)
    set_smooth_shading(cap, True)
    cap.parent = parent
    return cap


def create_crown_spires_and_finials(mat_gold, mat_trim, parent, count: int = 8):
    """Create 8 sculpted royal spires around the upper rim, each topped with a gold orb."""
    for i in range(count):
        ang = (2.0 * math.pi * i) / count
        is_primary = i % 2 == 0
        spire_height = 0.56 if is_primary else 0.42
        base_r = 0.16 if is_primary else 0.13
        radius_ring = 0.91

        # Stylized 4-sided royal diamond-spire point
        bpy.ops.mesh.primitive_cone_add(
            vertices=6,
            radius1=base_r,
            radius2=0.025,
            depth=spire_height,
            location=(
                radius_ring * math.cos(ang),
                radius_ring * math.sin(ang),
                0.50 + spire_height * 0.45,
            ),
        )
        spire = bpy.context.active_object
        spire.name = f"Crown_Spire_{i + 1:02d}"
        # Slight outward royal flare
        spire.rotation_euler = Euler((0.0, 0.16, ang), "XYZ")
        spire.data.materials.append(mat_gold)
        set_smooth_shading(spire, False)
        spire.parent = parent

        # Golden orb finial atop each spire
        tip_r = radius_ring + math.sin(0.16) * (spire_height * 0.52)
        tip_z = 0.50 + spire_height * 0.94
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=14,
            ring_count=8,
            radius=0.062 if is_primary else 0.048,
            location=(tip_r * math.cos(ang), tip_r * math.sin(ang), tip_z),
        )
        orb = bpy.context.active_object
        orb.name = f"Crown_Finial_{i + 1:02d}"
        orb.data.materials.append(mat_trim)
        set_smooth_shading(orb, True)
        orb.parent = parent


def create_gem_mesh(name: str, radius: float = 0.085, height: float = 0.07):
    """Build a crisp faceted octagonal gemstone mesh (flat-shaded for sparkle)."""
    bm = bmesh.new()
    sides = 8
    girdle_verts = []
    table_verts = []
    for i in range(sides):
        ang = (2.0 * math.pi * i) / sides
        girdle_verts.append(bm.verts.new((radius * math.cos(ang), radius * math.sin(ang), 0.0)))
        table_verts.append(
            bm.verts.new((radius * 0.58 * math.cos(ang), radius * 0.58 * math.sin(ang), height))
        )
    back_tip = bm.verts.new((0.0, 0.0, -height * 0.45))

    bm.faces.new(table_verts)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new((girdle_verts[i], girdle_verts[j], table_verts[j], table_verts[i]))
        bm.faces.new((girdle_verts[j], girdle_verts[i], back_tip))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def create_embedded_gems(mats: dict, parent, count: int = 8):
    """Embed alternating glowing Cyan and Ruby faceted gems with gold bezels around the band."""
    gem_mesh = create_gem_mesh("Crown_Gem_Mesh", radius=0.088, height=0.055)
    ring_radius = 0.875
    z_height = 0.27

    for i in range(count):
        ang = (2.0 * math.pi * i) / count
        pos = Vector((ring_radius * math.cos(ang), ring_radius * math.sin(ang), z_height))

        # Gold bezel ring framing the gem
        bpy.ops.mesh.primitive_torus_add(
            major_segments=16,
            minor_segments=8,
            major_radius=0.095,
            minor_radius=0.018,
            location=pos,
        )
        bezel = bpy.context.active_object
        bezel.name = f"Crown_Gem_Bezel_{i + 1:02d}"
        bezel.rotation_euler = Euler((0.0, math.pi / 2.0 - 0.14, ang), "XYZ")
        bezel.data.materials.append(mats["gold_trim"])
        set_smooth_shading(bezel, True)
        bezel.parent = parent

        # Faceted glowing gem (alternating Cyan and Ruby)
        gem_obj = bpy.data.objects.new(f"Crown_Gem_{i + 1:02d}", gem_mesh.copy())
        gem_obj.location = pos
        gem_obj.rotation_euler = Euler((0.0, math.pi / 2.0 - 0.14, ang), "XYZ")
        gem_obj.data.materials.append(mats["cyan_gem"] if i % 2 == 0 else mats["ruby_gem"])
        set_smooth_shading(gem_obj, False)
        gem_obj.parent = parent
        link_object(gem_obj)


def create_floating_diamond(mats: dict, parent):
    """Build a brilliant-cut faceted diamond hovering above the crown with a gold halo."""
    bm = bmesh.new()
    sides = 10
    r_girdle = 0.34
    r_table = 0.21
    z_table = 0.18
    z_girdle = 0.04
    z_culet = -0.34

    table_verts = []
    girdle_verts = []
    for i in range(sides):
        ang = (2.0 * math.pi * i) / sides
        table_verts.append(bm.verts.new((r_table * math.cos(ang), r_table * math.sin(ang), z_table)))
        girdle_verts.append(bm.verts.new((r_girdle * math.cos(ang), r_girdle * math.sin(ang), z_girdle)))
    culet = bm.verts.new((0.0, 0.0, z_culet))

    bm.faces.new(table_verts)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new((girdle_verts[i], girdle_verts[j], table_verts[j], table_verts[i]))
        bm.faces.new((girdle_verts[j], girdle_verts[i], culet))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Floating_Diamond_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    diamond_obj = bpy.data.objects.new("Floating_Diamond", mesh)
    diamond_obj.data.materials.append(mats["diamond"])
    set_smooth_shading(diamond_obj, False)  # Crisp faceted reflections
    diamond_obj.parent = parent
    link_object(diamond_obj)

    # Delicate floating golden halo accent ring around the diamond
    bpy.ops.mesh.primitive_torus_add(
        major_segments=32,
        minor_segments=10,
        major_radius=0.48,
        minor_radius=0.015,
        location=(0.0, 0.0, 0.0),
    )
    halo = bpy.context.active_object
    halo.name = "Diamond_Gold_Halo"
    halo.rotation_euler = Euler((math.radians(18.0), math.radians(-12.0), 0.0), "XYZ")
    halo.data.materials.append(mats["gold"])
    set_smooth_shading(halo, True)
    halo.parent = parent

    return diamond_obj


# =============================================================================
# 4. STUDIO LIGHTING & PREVIEW CAMERA
# =============================================================================
def setup_studio_lighting_and_camera() -> None:
    """Add 3-point luxury jewelry lighting and a clean preview camera."""
    light_specs = [
        ("Key_Light", "AREA", (3.2, -3.0, 4.2), (1.0, 0.94, 0.85), 220.0, 2.0),
        ("Rim_Light", "AREA", (-2.8, 3.2, 3.0), (0.55, 0.88, 1.0), 160.0, 1.8),
        ("Fill_Light", "AREA", (-3.0, -2.2, 1.5), (1.0, 0.82, 0.72), 90.0, 2.5),
    ]
    for name, ltype, loc, color, energy, size in light_specs:
        light_data = bpy.data.lights.new(name=name, type=ltype)
        light_data.energy = energy
        light_data.color = color
        if hasattr(light_data, "size"):
            light_data.size = size
        light_obj = bpy.data.objects.new(name=name, object_data=light_data)
        light_obj.location = loc
        direction = Vector((0.0, 0.0, 0.75)) - Vector(loc)
        light_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        link_object(light_obj)

    cam_data = bpy.data.cameras.new(name="Preview_Camera")
    cam_data.lens = 50.0
    cam_obj = bpy.data.objects.new("Preview_Camera", cam_data)
    cam_obj.location = (0.0, -4.2, 1.85)
    direction = Vector((0.0, 0.0, 0.75)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    link_object(cam_obj)
    bpy.context.scene.camera = cam_obj

    print("[Lonkind 3D] 3-point studio lighting & preview camera configured.")


# =============================================================================
# 5. SMOOTH 60-FRAME (24 FPS) TURNTABLE & FLOATING BOB ANIMATION
# =============================================================================
def set_action_interpolation(obj, data_path_contains: str, interpolation: str = "LINEAR") -> None:
    if not obj.animation_data or not obj.animation_data.action:
        return
    for fcurve in obj.animation_data.action.fcurves:
        if data_path_contains in fcurve.data_path:
            for kp in fcurve.keyframe_points:
                kp.interpolation = interpolation


def animate_gift(crown_rig, diamond_rig) -> None:
    """Animate seamless 360-degree turntable rotation + floating bob over 60 frames @ 24 fps."""
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END

    loop_end = FRAME_END + 1  # Frame 61 matches Frame 1 for a seamless 60-frame loop
    mid_frame = FRAME_START + (FRAME_END // 2)

    # --- Crown Rig: 360° linear turntable + gentle vertical float ---
    crown_rig.rotation_mode = "XYZ"
    crown_rig.rotation_euler = (0.0, 0.0, 0.0)
    crown_rig.keyframe_insert(data_path="rotation_euler", index=2, frame=FRAME_START)

    crown_rig.rotation_euler = (0.0, 0.0, math.radians(360.0))
    crown_rig.keyframe_insert(data_path="rotation_euler", index=2, frame=loop_end)

    # Smooth floating bob (Bezier ease)
    crown_rig.location = (0.0, 0.0, 0.0)
    crown_rig.keyframe_insert(data_path="location", index=2, frame=FRAME_START)
    crown_rig.location = (0.0, 0.0, 0.14)
    crown_rig.keyframe_insert(data_path="location", index=2, frame=mid_frame)
    crown_rig.location = (0.0, 0.0, 0.0)
    crown_rig.keyframe_insert(data_path="location", index=2, frame=loop_end)

    set_action_interpolation(crown_rig, "rotation_euler", "LINEAR")
    set_action_interpolation(crown_rig, "location", "BEZIER")

    # --- Floating Diamond Rig: faster counter-spin + independent hover bob ---
    diamond_rig.rotation_mode = "XYZ"
    diamond_base_z = 1.48

    diamond_rig.rotation_euler = (0.0, 0.0, 0.0)
    diamond_rig.keyframe_insert(data_path="rotation_euler", index=2, frame=FRAME_START)
    diamond_rig.rotation_euler = (0.0, 0.0, math.radians(-720.0))
    diamond_rig.keyframe_insert(data_path="rotation_euler", index=2, frame=loop_end)

    diamond_rig.location = (0.0, 0.0, diamond_base_z)
    diamond_rig.keyframe_insert(data_path="location", index=2, frame=FRAME_START)
    diamond_rig.location = (0.0, 0.0, diamond_base_z + 0.12)
    diamond_rig.keyframe_insert(data_path="location", index=2, frame=mid_frame)
    diamond_rig.location = (0.0, 0.0, diamond_base_z)
    diamond_rig.keyframe_insert(data_path="location", index=2, frame=loop_end)

    set_action_interpolation(diamond_rig, "rotation_euler", "LINEAR")
    set_action_interpolation(diamond_rig, "location", "BEZIER")

    scene.frame_set(FRAME_START)
    print(f"[Lonkind 3D] Animation keyed ({FRAME_END} frames @ {FPS} fps, seamless 360° loop + bob).")


# =============================================================================
# 6. DRACO-COMPRESSED .GLB EXPORT
# =============================================================================
def resolve_output_path() -> str:
    """Resolve ./public/gifts/golden_crown.glb relative to the script directory or CWD."""
    script_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
    out_path = os.path.join(script_dir, OUTPUT_REL_PATH)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    return out_path


def select_hierarchy(root_obj) -> None:
    """Select only the gift rig and all its descendants (excluding preview camera/lights)."""
    bpy.ops.object.select_all(action="DESELECT")

    def _select_recursive(obj):
        obj.select_set(True)
        for child in obj.children:
            _select_recursive(child)

    _select_recursive(root_obj)
    bpy.context.view_layer.objects.active = root_obj


def export_draco_glb(root_obj) -> str:
    """Export the animated Golden Crown & Diamond as a lightweight Draco-compressed .glb."""
    out_path = resolve_output_path()
    select_hierarchy(root_obj)

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,  # Preserve parented rig animations
        export_materials="EXPORT",
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )

    if not os.path.exists(out_path):
        raise RuntimeError(f"Export finished without writing file at {out_path}")

    size_bytes = os.path.getsize(out_path)
    size_kb = size_bytes / 1024.0
    size_mb = size_kb / 1024.0

    print(f"[Lonkind 3D] Export SUCCESS -> {out_path}")
    print(f"[Lonkind 3D] File size: {size_kb:.1f} KB ({size_mb:.3f} MB)")
    if size_mb > MAX_EXPORT_SIZE_MB:
        print(f"[Lonkind 3D] WARNING: File exceeds {MAX_EXPORT_SIZE_MB} MB target!")
    else:
        print(f"[Lonkind 3D] Lightweight target met (< {MAX_EXPORT_SIZE_MB:.1f} MB, Draco compressed).")

    return out_path


# =============================================================================
# MAIN ENTRYPOINT
# =============================================================================
def main() -> None:
    print("=" * 68)
    print("  Lonkind 3D Virtual Gift Generator — Golden Crown & Diamond")
    print("=" * 68)

    clear_scene()
    mats = build_materials()

    # Root rig for the Crown + turntable/bob animation
    crown_rig = bpy.data.objects.new("Lonkind_GoldenCrown_Rig", None)
    crown_rig.empty_display_type = "PLAIN_AXES"
    link_object(crown_rig)

    # Child rig for the Floating Spinning Diamond above the crown
    diamond_rig = bpy.data.objects.new("Lonkind_FloatingDiamond_Rig", None)
    diamond_rig.empty_display_type = "SPHERE"
    diamond_rig.location = (0.0, 0.0, 1.48)
    diamond_rig.parent = crown_rig
    link_object(diamond_rig)

    # Assemble 3D geometry
    create_crown_band(mats["gold"], mats["gold_trim"], crown_rig)
    create_royal_velvet_cap(mats["velvet"], crown_rig)
    create_crown_spires_and_finials(mats["gold"], mats["gold_trim"], crown_rig, count=8)
    create_embedded_gems(mats, crown_rig, count=8)
    create_floating_diamond(mats, diamond_rig)
    print("[Lonkind 3D] Modeling complete: Golden Crown, 8 Cyan/Ruby Gems & Floating Diamond.")

    # Lighting, camera & animation
    setup_studio_lighting_and_camera()
    animate_gift(crown_rig, diamond_rig)

    # Export compressed .glb
    export_draco_glb(crown_rig)
    print("[Lonkind 3D] All done! Ready for Lonkind GiftTakeoverEngine.")


if __name__ == "__main__":
    main()
