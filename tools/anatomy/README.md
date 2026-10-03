# tools/anatomy: the atlas model

Builds `public/anatomy/body.glb` and `public/anatomy/manifest.json` for the 3D anatomy atlas
(`src/anatomy/`) from **BodyParts3D 3.0**, real segmented anatomy of an adult male in millimetres.
The data contract the viewer relies on is in `src/anatomy/DESIGN.md` §2; the part list is
`src/anatomy/data/catalog.json` (106 structures; catalog `id` = GLB node name).

## Rebuild

```sh
cd tools/anatomy
npm install
node build.mjs          # ≈ 1.5 min the first time, then about the same (the slow step is welding)
```

The first run downloads the part lists and about 470 STL files (≈ 650 MB) from the GitHub mirror into
`.cache/` (git-ignored), so later runs work offline. `GITHUB_TOKEN`, or a logged-in `gh`, is used for the
one GitHub API call that lists the files. The skin's outer shell, the slowest step, is cached in
`.cache/derived/`, keyed by its parameters and the source of `lib/skin.mjs`. With the cache in place,
a rebuild gives a byte-identical GLB.

To check the result, serve the repo root and open the preview:

```sh
cd ../.. && python3 -m http.server 5182
# http://localhost:5182/tools/anatomy/preview.html?view=front
# params: view=front|back|left|right|top|bottom|fl|fr  layers=shell,muscles,deep  skin=glass|solid
#         only=heart,aorta  target=heart (or x_y_z in m)  zoom=3  axes
node ../browser/shot.mjs 'http://localhost:5182/tools/anatomy/preview.html?view=left' side.png 500 900
```

The preview loads the GLB with `GLTFLoader` + `MeshoptDecoder`, colours each part with the atlas
tissue palette, logs the node names, and reports catalog ids that are missing or whose `extras`
disagree with the catalog. `window.__pick(x, y)` returns the part a tap at that pixel would hit.

## Output

- **body.glb**: one mesh node per catalog id (`node.name = mesh.name = id`), `extras = { system, layer,
  side, explode, group }` from the catalog, and one neutral material (the viewer assigns its own).
  Metres, +Y up with the soles at 0, the patient's left = +X, the face towards +Z, and the skin's
  bounding box centred on X and Z. Geometry is quantized (`KHR_mesh_quantization`) and
  meshopt-compressed (`EXT_meshopt_compression`). Quantization puts a translation and a uniform scale on
  every node, so read positions through world matrices (`Box3.setFromObject`, `matrixWorld`). About
  448k triangles, 2.5 MB.
- **manifest.json**: per id, triangle and vertex counts, `bboxMin`/`bboxMax`/`centroid` (m), the
  simplification error (mm), the BodyParts3D primitives used, how each catalog concept resolved, and a
  note wherever the build did more than merge primitives. It also has totals, the file size and the
  attribution.

## Pipeline

1. **Resolve** (`lib/resolve.mjs`). Each catalog concept is looked up by name in `parts_list_e.txt`
   and expanded to primitives (the parts that have an STL) through **both** `composite_parts.txt` and
   `conventional_part_of.txt`: neither hierarchy is complete on its own. For a sided part, "left X" or
   "right X" wins; otherwise the unsided concept is filtered by the primitive's centroid (x > 0 is the
   patient's left). Aliases cover FMA naming differences (`fibularis`/`peroneus`,
   `set of phalanges of hand`/`set of fingers`, …). Per-part extras: the large intestine gets the rectum
   and appendix; the heart gets the superior vena cava and the pulmonary trunk; the eyeballs are
   excluded from the skull and the pancreatic duct (hidden inside) from the pancreas.
2. **Merge** (`lib/stl.mjs`, `lib/mesh.mjs`). Binary STL → triangle soup → weld at 0.05 mm → drop
   collapsed and zero-area triangles, and drop both copies of a wall that two touching primitives share.
3. **Special cases.**
   - **Skin** (`lib/skin.mjs`). BodyParts3D's skin (1.6 M triangles) is the body volume minus everything
     in it: one surface holding the outer skin plus inner sheets (the subcutaneous boundary and the
     outlines of muscles, bones and organs). As a fresnel glass shell, each inner sheet would show as a
     ghostly double rim. Each triangle is tested for visibility from outside with 64 orthographic
     z-buffer renders (0.5 mm pixels, triangle ids, front faces only) from directions spread evenly
     over the sphere. Small unseen islands enclosed by seen skin (≤ 400 mm²: between the fingers,
     deep folds) are filled back in, and only the largest connected piece is kept, which drops a few
     hundred small specks of inner sheets glimpsed through openings. Result: one connected
     155k-triangle outer surface (66.5 L) with a few tiny openings (mostly at the crotch), no inner
     surfaces; checked visually in glass and solid renders from all sides.
   - **Heart, brain, lungs.** The same visibility pass removes hidden insides (chambers, valves and
     papillary muscles; ventricles and deep nuclei; the fissure walls between lung lobes). Here it also
     keeps hidden triangles within 3 mm (measured along the surface) of a visible one. Those are the
     crevices under the coronary vessels and between gyri, which would otherwise open into visible
     cracks after simplification.
   - **Trachea** (`lib/clip.mjs`). BodyParts3D has the whole bronchial tree (one mesh per lung) but no
     main bronchi. Each tree is cut exactly (triangles split along the sphere) with a sphere around the
     carina, 22 mm on the right and 45 mm on the left (the right main bronchus is about half as long).
     The cut ends are capped.
   - **Pulmonary trunk** (on the heart). The pulmonary arterial tree is cut the same way, 55 mm around
     the pulmonary valve.
   - **External oblique** (`lib/sheath.mjs`). The BodyParts3D muscle includes its aponeurosis, which
     covers the whole rectus abdominis from the front. It is trimmed back to the rectus's lateral border
     (the linea semilunaris) per 2 mm height slab, so the fleshy belly remains and the rectus can be
     seen and tapped.
   - **Thyroid gland** (`lib/thyroid.mjs`). Not in BodyParts3D 3.0 (only the thyroid cartilage is).
     It is modelled procedurally as one closed horseshoe fitted to the real trachea: two pear-shaped
     lobes joined by an isthmus over the upper tracheal rings, below the thyroid cartilage.
4. **Simplify** (`lib/simplify.mjs`, meshoptimizer, error measured in mm). Collapses cheaper than
   0.15 mm are always taken. Past that, the per-part caps in `lib/budget.mjs` decide: skin 72k, organs
   8k (brain 12k, intestines 14k), muscles 3.5k, bones 4k (skull, thoracic cage, vertebral column and
   pelvis 12k). If the total exceeds 450k, the muscle and bone caps shrink together (currently to about
   83%, so ~2.9k per muscle and ~3.3k per bone, with errors of 0.2–1.2 mm).
5. **Transform** BodyParts3D (mm; +x = patient's left, −y = anterior, +z = up) to the atlas frame:
   X = x, Y = z − soles, Z = −y, in metres, recentred on the skin. It is a proper rotation, so the
   winding is preserved.
6. **Normals** (`creasedNormals` in `lib/mesh.mjs`). Angle-weighted smooth normals with vertices split
   only along edges sharper than 60°, so cut vessel and bronchus ends read as clean sections.
7. **Encode** (`lib/glb.mjs`, glTF-Transform). One node per part, quantized and meshopt-compressed.

## Known gaps and substitutions

- **Thyroid gland**: procedural (see above). BodyParts3D 3.0 has no thyroid gland.
- **Coccyx**: no separate mesh; the BodyParts3D sacrum includes it.
- **Main bronchi**: cut from the bronchial trees (see above).
- The heart keeps the superior vena cava and the pulmonary trunk; the inferior vena cava and the
  pulmonary veins are not included (the IVC would stretch the heart's bounds into the abdomen).

## Source, license, attribution

BodyParts3D 3.0, © The Database Center for Life Science (DBCLS), from
<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/>, via the STL mirror at
<https://github.com/Kevin-Mattheus-Moerman/BodyParts3D>. It is licensed under
[CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).

`body.glb` and `manifest.json` are derived from it and are distributed under the same license, **CC
BY-SA 2.1 JP**. Credit wherever the model is shown (the atlas HUD does):

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan

Citation: Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure
database for anatomical concepts. *Nucleic Acids Res.* 2009;37:D782-5.

The code in this directory is part of the hackathon repository and is not covered by the data license.
