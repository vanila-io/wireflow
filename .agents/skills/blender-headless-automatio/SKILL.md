---
name: blender-headless-automatio
description: Headless Blender (Cycles) environment production on Automatio sandboxes: installing Blender on ARM64, scripting scenes with bpy/bmesh, the bmesh half-scale cube gotcha, CPU-only render budgeting, no-denoiser workarounds, QC render loops, background render queues, and delivering renders to the user via a gallery app. Use whenever the task involves Blender, .blend files, Cycles rendering, bpy Python scripting, procedural scene building, or "render this 3D scene" on this platform.
---

# Headless Blender on Automatio sandboxes — field guide

A general playbook for building and rendering Blender scenes headlessly in Automatio sandboxes, and for offloading renders to GPU when the scene outgrows CPU. Distilled from production runs; everything below was learned the hard way — skip the re-derivation.

## 1. Environment reality check (do this FIRST)

- Automatio sandboxes are **ARM64, CPU-only, no GPU, no display**. Cycles runs on CPU. There is no CUDA/OptiX and no GPU path — plan render times around CPU.
- Blender official downloads are x86_64 only. An x86 build **will not run** on ARM64, even via qemu/box64 — don't waste an hour trying. Get a **Debian ARM64 build** from Debian repos (package `blender`, e.g. Debian Trixie ships 4.3.x) or a distro that publishes aarch64 builds.
- The Debian build's shared libs don't resolve from a bare extracted tree. The working pattern: extract the package root to `/tmp/blarm/root`, then run through a wrapper that invokes the dynamic linker directly with the library path:
  ```sh
  # /tmp/blarm/bl.sh
  L=/tmp/blarm/root
  LP="$L/usr/lib/aarch64-linux-gnu:$L/usr/lib/aarch64-linux-gnu/pulseaudio:$L/usr/lib/aarch64-linux-gnu/blas:$L/usr/lib/aarch64-linux-gnu/lapack:$L/usr/lib"
  export BLENDER_SYSTEM_RESOURCES=$L/usr/share/blender
  export HOME=/tmp/blarm/scratch; export TMPDIR=/tmp/blarm/scratch
  exec $L/usr/lib/aarch64-linux-gnu/ld-linux-aarch64.so.1 --library-path "$LP" $L/usr/bin/blender "$@"
  ```
  Expect to add library dirs incrementally until it launches; ~dozens of deps, resolve them with `ldd` on failure, not one at a time by hand.
- Verify with `bl.sh -b --version` (background mode, no display).

## 2. The #1 geometry gotcha: half-scale boxes

`bmesh.ops.create_cube(bm, size=1.0)` creates a cube spanning **±0.5** (total size 1). If your helper then scales verts by `size/2`, every box is **half the size the caller asked for**, while all the loc math assumes full size. Symptom in a big scene: floating towers, wall gaps leaking sky, everything reading like a dollhouse — and it's nearly invisible frame-by-frame until you compare against human heights.

Correct helper core:
```python
bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)   # NOT size/2
```
**Always build one `core.py` with primitives (box/cyl/sphere/plane/get_coll) and route ALL geometry through it** — a bug then costs one fix, not forty. Audit the primitive functions with a quick standalone render of known-size objects (e.g. a 2m box next to a 1.8m "person" cyl) before building anything large.

## 3. Project layout that survives long runs

```
project/
  scripts/
    core.py        # primitives, collections, linking
    materials.py   # procedural material registry (_reg/get, node helpers)
    arch.py city.py furniture.py lighting.py ...   # one module per area
    build.py       # assemble scene + set render settings, save .blend
    cameras.py     # named cameras
    render.py      # CLI: --preset contact|preview|half|final|hero --cams 3,7
    contact_sheet.py
  checkpoints/scene_current.blend
  renders/{contact,preview,final}/
  TASK_STATE.md    # append-only run log; resume notes for the next session
```
- **Materials as a registry** (`_reg(name, fn)` then `M(name)` on demand): avoids node-tree sprawl and lets any module reuse mats.
- **TASK_STATE.md is your memory.** Every session: append what was fixed, what's running, resume notes. Context compaction will eat your history; the file won't.
- Save the .blend to checkpoints after each build cycle; renders read from the checkpoint, never from live memory.

## 4. Render settings for CPU-only Cycles

- **There is no denoiser available.** Debian strips OpenImageDenoise from Blender, and Intel ships **no aarch64 Linux OIDN binary** (checked releases: x86_64 + macOS arm only). Do not promise denoised renders; budget samples instead. `sample_clamp_indirect = 8.0` kills fireflies cheaply.
- Use **adaptive sampling** (threshold ~0.010 QC / 0.006 final) — it cuts uniform-noise scenes massively.
- Work in quality presets, cheapest-first — each preset answers a different question:
  - thumbnail (~480p, ~24spp) — composition/aiming only; noise-dominated, never judge materials from it
  - draft (~960p, ~256spp) — framing, blocking, light balance
  - half (1280x720, ~160spp) — still noise-dominated for fine detail; don't QC textures at this tier
  - final (1080p+, 500spp+, adaptive threshold ~0.010) — the tier where you judge fine detail and ship
- Treat timings as scene-dependent, not absolute: a dense interior with glass and hundreds of lights runs several times slower per frame than a sparse exterior. Measure ONE frame of your chosen preset on the actual scene before quoting any timeline.
- Bounces: max 8, diffuse 3, glossy 3, transmission 6, transparent 8, volume 0. Interiors don't need more; more bounces = linear time cost.
- AgX view transform for photoreal HDR rolloff — set it in build.py, not per render.
- **Realistic total budget**: a full finals set (10-20 frames at 1080p) on CPU is measured in half-days to a day. Launch it as a queued background job and schedule cheaper-tier QC work around it. Tell the user the honest timeline — or move to GPU (§8b).

## 5. Render QC loop that actually finds problems

1. Contact renders of ALL cameras first — fix aiming (cameras aimed at floors/empty air are the most common failure), then blocking.
2. Preview (256spp) on 2-3 representative cams — judge scale, materials, light balance.
3. Only then launch finals. Do **not** QC fine detail at ≤720p/160spp — it's noise-dominated and you'll "fix" non-problems. Judge detail cams from their 1080p finals.
4. Re-render a single cam after a fix: `render.py --cams N` — never re-run the whole queue.
5. Cold-start validation at the end: reopen the .blend fresh (`bl.sh -b file.blend --python-expr "print(len(bpy.data.objects))"`) to prove no external deps broke.

## 6. Process discipline in the sandbox

- **Long renders must be nohup'd background jobs** writing to a log file: `nohup sh -c '...' > /tmp/render.log 2>&1 &`. The bash tool kills foreground commands after ~380s — a render will not survive foreground.
- Poll with `tail -c 200 /tmp/render.log` + `pgrep -f render.py`; don't sleep-loop in one call (box dies, output lost).
- **Never `pkill -f <name>`** — it matches the `sh -c` wrapper running your own command and kills your shell. Kill renders by PID from `ps aux | grep blender | grep -v grep`.
- The bash tool has its own box-lifetime limits: if a `sleep`-heavy command returns `__BOX_DEAD__`, just re-check state; nothing was lost if the work was nohup'd.
- Don't commit after every asset download; commit at feature milestones (build cycle, render preset change).

## 7. Showing renders to the user (non-negotiable)

The user cannot see /tmp files. Two working options:
- **In-chat**: renders are PNGs on disk; the gallery app is the durable path.
- **Gallery app**: the project's Next.js app (static export or `next build && next start` — plain `next dev` hangs on huge file trees) serving a renders page; a watcher script copies each finished frame from `renders/final/` into `public/renders/` as it lands so the user watches frames appear live. This turned "trust me" into something the user could judge — do it from the first QC render, not at the end.

## 8. Common failure catalogue (symptom → cause → fix)

- Floating towers / sky leaking through walls → half-scale box bug (§2)
- "Haze wall" slicing the room / fog plane at Y=0 → atmospheric effects belong in the **World shader**, not a giant plane in the scene
- City windows rendering as 8cm slots → texture mapping scale confusion; brick/window textures must be mapped in meters, verify against real window size (0.95m)
- Cameras framing empty floor → no one checks cam aim until a render exists; contact-render all cams before any polish
- Stools/bar/gap distances feeling wrong → check *human-scale* clearances (stool 0.42m from counter, not 0.65) — dimensional QA against real hospitality dimensions catches what eyeballing misses
- x86 Blender "cannot execute binary file" → wrong arch, get the ARM64 build (§1)
- Render taking 8x budget → check bounces, then object count; split far LOD into simplified geometry, or drop samples + raise threshold
- Object "floating" at a suspicious height / buried underground → check placement calls for a **rotation or angle value accidentally passed inside the location tuple** — e.g. `(x, y, math.pi/2)` puts the object 1.57m in the AIR instead of rotating it. Audit all place/spawn calls: any loc tuple containing `math.pi` (or any 1-4 radian-magnitude number) is a bug. The float height equals the stray constant, so different objects drift by different amounts — that pattern is the tell.
- "Objects near the ceiling" / phantom duplicates in glossy-ceiling or mirror-walled rooms → often **reflections in polished surfaces**, not real geometry. Prove it before editing code: cast rays from the camera through the suspicious pixel (`scene.ray_cast`) and report what it hits and its Z. A large share of "floating object" complaints are mirror physics.
- Vision-model QC gives false positives on perspective (near objects reaching the top of frame read as "hanging"). Never trust the model alone for position bugs — verify with numeric probes (world-space Z extents) or ray casts.

## 8b. GPU rendering on Modal — the 20-40x speedup (do this instead of long CPU queues)

If the user has a Modal account (or any GPU serverless), CPU render queues are obsolete. A 1080p final drops from ~1h+ on a many-core CPU to single-digit minutes on one T4-class GPU, and **fanning N cameras out with `.map()` renders them all in parallel — a whole finals set completes in about the wall time of ONE frame**, for a few dollars.

- **Auth without vault access**: vault secrets ({{MODAL_AUTH_TOKEN}}) do NOT reach the bash sandbox and Modal's API is gRPC-only (no plain REST header auth). Use the **token-flow browser approval**: generate a token flow from the Modal CLI, give the user the https://modal.com/token-flow/tf-... link, they click approve, and the CLI writes credentials locally. Zero secrets pasted in chat, no box restart needed. Persist the token path via env (XDG_CONFIG_HOME + MODAL_TOKEN_PATH) in every modal command.
- **Images**: official `modal.Image.from_registry("blender/blender:4.1.1", add_python="3.11")` gives the x64 build **with Cycles CUDA + OIDN bundled** — everything the Debian ARM64 build lacks.
- **Denoiser**: OptiX denoising FAILS to initialize on T4s. Use `--denoise 1` with CUDA compute devices and OpenImageDenoise (the default when OptiX is off). Configure `cycles.device = "GPU"` and add CUDA devices explicitly.
- **Pipeline shape**: upload `scene.blend` + `render_gpu.py` to a `modal.Volume` once; the app function reads the volume, renders one camera, returns the PNG bytes. Fan out with `.map()` over camera kwargs — Modal schedules one GPU per input. Download results in `@app.local_entrypoint()`.
- **`@modal.concurrent(max_inputs=1)` + `.map()` gotcha**: each mapped kwargs-dict arrives as ONE positional argument (a dict), not as **kwargs. Normalize inside the function:
  ```python
  def render_cam(*args, **kw):
      if args and isinstance(args[0], dict):
          kw = {**args[0], **kw}
  ```
- **Function annotations break Modal**: `tuple[int, bytes]` as a return annotation fails Modal's function hashing (`bytes` in a tuple generic). Drop return annotations on Modal functions.
- **`.map()` items must be flat kwargs**: dicts/tuples as values inside the mapped items are rejected ("kwargs values must be basic types"). Pass modes as strings (`{"cam": 3, "mode": "final"}`), look up settings inside the function.
- **Env vars set with `modal run` DO reach the container** (read with os.environ inside app code) — but they must be READ in code that runs; grep the script first to confirm the knob exists. A QC flag you never wired is a silent full-quality run.
- **`modal volume put` gotcha**: uploading to a nested remote path like `/renders/out.png` can create a *local-looking nested directory* in the download step (`skyline_restaurant_bar/skyline_restaurant_bar/...`). Upload flat (`/scene_current.blend`) and download to explicit local paths in the entrypoint.
- **Workflow**: fix scripts locally → rebuild .blend → `modal volume put` the new blend → `modal run` with ONLY_CAMS/TEST env knobs for a low-res spot-check of the worst 1-2 cameras → eyeball those → then fire the full set at final quality. Iteration cost per cycle ≈ 15 min, which turns the QC loop from "overnight" into "conversational".
- Re-render single cameras after fixes: `ONLY_CAMS=3,7 modal run ...` — same discipline as CPU, 100x faster.
