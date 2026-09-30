// Toon materials, outline (inverted hull) materials and procedural canvas textures.
import * as THREE from 'three';

export const globalUniforms = {
  uTime: { value: 0 },
};

// ---------------------------------------------------------------------------
// Gradient maps for cel shading

const gradients = {};
export function gradientMap(steps = 3) {
  if (gradients[steps]) return gradients[steps];
  const tones = {
    2: [110, 255],
    3: [95, 185, 255],
    4: [80, 150, 210, 255],
  }[steps];
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((t, i) => { data[i * 4] = t; data[i * 4 + 1] = t; data[i * 4 + 2] = t; data[i * 4 + 3] = 255; });
  const tex = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  gradients[steps] = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Toon material factory with optional wind sway and a soft rim light

const swayVertex = /* glsl */ `
  #include <begin_vertex>
  {
    vec4 swWorld = modelMatrix * vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      swWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    #endif
    float swPh = swWorld.x * 0.61 + swWorld.z * 0.47;
    float swW = sway * sway;
    transformed.x += (sin(uTime * 1.6 + swPh) * 0.7 + sin(uTime * 2.9 + swPh * 1.7) * 0.3) * swayAmp * swW;
    transformed.z += (cos(uTime * 1.3 + swPh * 1.2) * 0.6) * swayAmp * swW;
  }
`;

const rimFragment = /* glsl */ `
  {
    vec3 rimView = normalize(vViewPosition);
    float rimF = 1.0 - clamp(dot(normal, rimView), 0.0, 1.0);
    rimF = smoothstep(0.62, 0.78, rimF) * rimStrength;
    outgoingLight += rimF * (diffuseColor.rgb * 0.5 + vec3(0.12));
  }
  #include <opaque_fragment>
`;

function patchToon(mat, { sway = 0, rim = 0.35 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.swayAmp = { value: sway };
    shader.uniforms.rimStrength = { value: rim };
    if (sway > 0) {
      shader.vertexShader = 'attribute float sway;\nuniform float uTime;\nuniform float swayAmp;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', swayVertex);
    }
    shader.fragmentShader = 'uniform float rimStrength;\n' +
      shader.fragmentShader.replace('#include <opaque_fragment>', rimFragment);
  };
  mat.customProgramCacheKey = () => `toon-${sway > 0 ? 'sway' : 'still'}`;
  mat.userData.sway = sway;
  return mat;
}

const toonCache = new Map();
export function toon(color, opts = {}) {
  const key = JSON.stringify([color, opts.map ? opts.map.uuid : null, opts.emissive, opts.emissiveIntensity, opts.sway, opts.steps, opts.transparent, opts.opacity, opts.side, opts.rim, opts.flat]);
  if (toonCache.has(key)) return toonCache.get(key);
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: gradientMap(opts.steps || 3),
    map: opts.map || null,
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  patchToon(mat, { sway: opts.sway || 0, rim: opts.rim ?? 0.35 });
  toonCache.set(key, mat);
  return mat;
}

// Emissive "glow" material (unlit, drives bloom)
const glowCache = new Map();
export function glow(color, intensity = 2.5, opts = {}) {
  const key = color + ':' + intensity + ':' + !!opts.transparent + ':' + (opts.opacity ?? 1);
  if (glowCache.has(key)) return glowCache.get(key);
  const c = new THREE.Color(color).multiplyScalar(intensity);
  const mat = new THREE.MeshBasicMaterial({ color: c, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: !opts.transparent, toneMapped: true });
  glowCache.set(key, mat);
  return mat;
}

export function clearMaterialCaches() {
  // Materials are shared across holes; they are small so we keep them.
}

// ---------------------------------------------------------------------------
// Outline material (inverted hull, roughly constant screen width)

const outlineCache = new Map();
export function outlineMaterial(color = 0x1b1530, sway = 0, width = 1) {
  const key = color + ':' + sway + ':' + width;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: globalUniforms.uTime,
      uColor: { value: new THREE.Color(color) },
      uWidth: { value: 0.0024 * width },
      swayAmp: { value: sway },
    },
    defines: sway > 0 ? { USE_SWAY: '' } : {},
    vertexShader: /* glsl */ `
      attribute vec3 outlineNormal;
      #ifdef USE_SWAY
      attribute float sway;
      #endif
      uniform float uTime;
      uniform float uWidth;
      uniform float swayAmp;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec3 transformed = position;
        #ifdef USE_SWAY
        {
          vec4 swWorld = modelMatrix * vec4(transformed, 1.0);
          float swPh = swWorld.x * 0.61 + swWorld.z * 0.47;
          float swW = sway * sway;
          transformed.x += (sin(uTime * 1.6 + swPh) * 0.7 + sin(uTime * 2.9 + swPh * 1.7) * 0.3) * swayAmp * swW;
          transformed.z += (cos(uTime * 1.3 + swPh * 1.2) * 0.6) * swayAmp * swW;
        }
        #endif
        vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * outlineNormal);
        vec4 viewPos = viewMatrix * worldPos;
        float dist = max(-viewPos.z, 0.1);
        float w = clamp(uWidth * dist, 0.0035, 0.06);
        worldPos.xyz += n * w;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.BackSide,
    fog: true,
  });
  mat.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, mat.uniforms]);
  mat.uniforms.uTime = globalUniforms.uTime;
  outlineCache.set(key, mat);
  return mat;
}

// Compute smoothed normals (averaged over coincident positions) for outlines
export function computeOutlineNormals(geometry) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const map = new Map();
  const q = (v) => Math.round(v * 1000);
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
    keys[i] = k;
    let acc = map.get(k);
    if (!acc) { acc = [0, 0, 0]; map.set(k, acc); }
    acc[0] += nrm.getX(i); acc[1] += nrm.getY(i); acc[2] += nrm.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
  return geometry;
}

// Attach an outline hull to a mesh (mesh geometry gets an outlineNormal attribute)
export function addOutline(mesh, { color = 0x1b1530, width = 1 } = {}) {
  const geo = mesh.geometry;
  if (!geo.attributes.outlineNormal) computeOutlineNormals(geo);
  const sway = (mesh.material && mesh.material.userData && mesh.material.userData.sway) || 0;
  if (sway > 0 && !geo.attributes.sway) {
    geo.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
  }
  const o = new THREE.Mesh(geo, outlineMaterial(color, sway, width));
  o.castShadow = false;
  o.receiveShadow = false;
  o.name = 'outline';
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

// ---------------------------------------------------------------------------
// Procedural canvas textures (world-space tiling; 1 texture repeat = `meters`)

const texCache = new Map();

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}

function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function finishTexture(canvas, meters = 1, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / meters, 1 / meters);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts.nearest) { tex.magFilter = THREE.NearestFilter; }
  return tex;
}

function speckle(ctx, size, r, count, colors, minS = 1, maxS = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = minS + r() * (maxS - minS);
    ctx.fillRect(r() * size, r() * size, s, s);
  }
}

export const textures = {
  fairway(base = '#5ccf4a', stripe = '#51bf40', meters = 3) {
    const key = 'fairway' + base + stripe + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = stripe;
    for (let i = 0; i < 4; i += 2) ctx.fillRect(0, (i * size) / 4, size, size / 4);
    const r = rand(7);
    speckle(ctx, size, r, 1400, ['rgba(255,255,255,0.08)', 'rgba(0,60,0,0.10)', 'rgba(255,255,160,0.07)'], 1, 2.5);
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  planks(base = '#b07642', line = '#6e4523', meters = 1.2, vertical = false) {
    const key = 'planks' + base + line + meters + vertical;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const r = rand(11);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = (i * size) / n;
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,220,170' : '80,40,10'},${0.06 + r() * 0.08})`;
      ctx.fillRect(0, y, size, size / n);
      // grain
      ctx.strokeStyle = 'rgba(90,50,20,0.25)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        ctx.beginPath();
        const gy = y + 6 + r() * (size / n - 12);
        ctx.moveTo(0, gy);
        for (let x = 0; x <= size; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.05 + r() * 6) * 2);
        ctx.stroke();
      }
      ctx.fillStyle = line;
      ctx.fillRect(0, y, size, 3);
      const off = r() * size;
      ctx.fillRect(off, y, 3, size / n);
      // nails
      ctx.fillStyle = 'rgba(40,25,10,0.7)';
      ctx.fillRect((off + 8) % size, y + 8, 3, 3);
      ctx.fillRect((off + 8) % size, y + size / n - 11, 3, 3);
    }
    if (vertical) {
      const c2 = makeCanvas(size), x2 = c2.getContext('2d');
      x2.translate(size / 2, size / 2); x2.rotate(Math.PI / 2); x2.drawImage(c, -size / 2, -size / 2);
      const t = finishTexture(c2, meters); texCache.set(key, t); return t;
    }
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  bricks(base = '#b9b2a6', mortar = '#7d7468', meters = 1.2, seed = 3) {
    const key = 'bricks' + base + mortar + meters + seed;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = mortar; ctx.fillRect(0, 0, size, size);
    const r = rand(seed);
    const rows = 6, bw = size / 3;
    for (let row = 0; row < rows; row++) {
      const y = (row * size) / rows;
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < size + bw; x += bw) {
        const col = new THREE.Color(base).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.08, (r() - 0.5) * 0.1);
        ctx.fillStyle = '#' + col.getHexString();
        ctx.beginPath();
        ctx.roundRect(x + off + 3, y + 3, bw - 6, size / rows - 6, 5);
        ctx.fill();
      }
    }
    speckle(ctx, size, r, 600, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 1, 3);
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  sand(base = '#f2d68f', meters = 2) {
    const key = 'sand' + base + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const r = rand(5);
    speckle(ctx, size, r, 3000, ['rgba(160,110,50,0.18)', 'rgba(255,255,230,0.3)', 'rgba(120,80,30,0.12)'], 1, 2);
    // ripples
    ctx.strokeStyle = 'rgba(190,140,70,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const y = i * 32 + 8;
      for (let x = 0; x <= size; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.049 + i) * 5);
      ctx.stroke();
    }
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  checker(a = '#ffffff', b = '#e8413c', meters = 1, n = 2) {
    const key = 'checker' + a + b + meters + n;
    if (texCache.has(key)) return texCache.get(key);
    const size = 128, c = makeCanvas(size), ctx = c.getContext('2d');
    const s = size / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? b : a;
      ctx.fillRect(i * s, j * s, s, s);
    }
    const t = finishTexture(c, meters, { nearest: false });
    texCache.set(key, t); return t;
  },

  stripes(a = '#ffcf33', b = '#262626', meters = 0.6, angle = 45) {
    const key = 'stripes' + a + b + meters + angle;
    if (texCache.has(key)) return texCache.get(key);
    const size = 128, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = a; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = b;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((angle * Math.PI) / 180);
    for (let x = -size * 2; x < size * 2; x += size / 2) ctx.fillRect(x, -size * 2, size / 4, size * 4);
    ctx.restore();
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  metal(base = '#8d96a3', meters = 1.5) {
    const key = 'metal' + base + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const r = rand(9);
    // brushed streaks
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.04})`;
      ctx.fillRect(0, r() * size, size, 1 + r() * 2);
    }
    // plates
    ctx.strokeStyle = 'rgba(30,35,45,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
    // rivets
    ctx.fillStyle = 'rgba(40,45,55,0.8)';
    for (const [x, y] of [[12, 12], [size / 2 - 12, 12], [size / 2 + 12, 12], [size - 12, 12], [12, size - 12], [size / 2 - 12, size - 12], [size / 2 + 12, size - 12], [size - 12, size - 12]]) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  ice(base = '#bfe9ff', meters = 3) {
    const key = 'ice' + base + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, size, size);
    grd.addColorStop(0, base); grd.addColorStop(0.5, '#d9f4ff'); grd.addColorStop(1, base);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, size, size);
    const r = rand(21);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = r() * size, y = r() * size;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,190,230,0.35)';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(r() * size, r() * size); ctx.lineTo(r() * size, r() * size); ctx.stroke();
    }
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  snow(meters = 2) {
    const key = 'snow' + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f8ff'; ctx.fillRect(0, 0, size, size);
    const r = rand(33);
    speckle(ctx, size, r, 900, ['rgba(160,190,230,0.25)', 'rgba(255,255,255,1)', 'rgba(200,220,255,0.4)'], 1, 3);
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  conveyor(meters = 0.8) {
    const key = 'conveyor' + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 128, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = '#2d2f36'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#3c3f48';
    for (let y = 0; y < size; y += 16) ctx.fillRect(0, y, size, 3);
    ctx.fillStyle = '#ffc233';
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.75); ctx.lineTo(size * 0.5, size * 0.35); ctx.lineTo(size * 0.8, size * 0.75);
    ctx.lineTo(size * 0.68, size * 0.75); ctx.lineTo(size * 0.5, size * 0.52); ctx.lineTo(size * 0.32, size * 0.75);
    ctx.closePath(); ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    texCache.set(key, tex);
    return tex; // not cached as it is animated per belt (clone it)
  },

  basalt(base = '#3a3033', meters = 2) {
    const key = 'basalt' + base + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const r = rand(44);
    // hex-ish cells
    for (let i = 0; i < 40; i++) {
      const x = r() * size, y = r() * size, rad = 14 + r() * 22;
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,120,40,0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); let x = r() * size, y = r() * size; ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    speckle(ctx, size, r, 800, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.05)'], 1, 3);
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  spacePanel(base = '#1c1f3a', line = '#59e8ff', meters = 1.5) {
    const key = 'space' + base + line + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const r = rand(55);
    speckle(ctx, size, r, 300, ['rgba(255,255,255,0.05)', 'rgba(120,140,255,0.08)'], 1, 3);
    ctx.strokeStyle = line; ctx.globalAlpha = 0.55; ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, size - 8, size - 8);
    ctx.globalAlpha = 0.25; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(size / 2, 4); ctx.lineTo(size / 2, size - 4); ctx.moveTo(4, size / 2); ctx.lineTo(size - 4, size / 2); ctx.stroke();
    ctx.globalAlpha = 1;
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  tiles(a = '#e9dcc0', b = '#d7c7a4', meters = 1, n = 4) {
    const key = 'tiles' + a + b + meters + n;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = '#8f7d5c'; ctx.fillRect(0, 0, size, size);
    const s = size / n;
    const r = rand(66);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const col = new THREE.Color((i + j) % 2 ? a : b).offsetHSL(0, 0, (r() - 0.5) * 0.06);
      ctx.fillStyle = '#' + col.getHexString();
      ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
    speckle(ctx, size, r, 500, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.08)'], 1, 3);
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },

  dirt(base = '#8a5a34', meters = 2) {
    const key = 'dirt' + base + meters;
    if (texCache.has(key)) return texCache.get(key);
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const r = rand(77);
    // strata bands
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,220,180' : '40,20,5'},${0.05 + r() * 0.07})`;
      ctx.fillRect(0, (i * size) / 6, size, size / 12 + r() * 20);
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,235,210' : '50,30,15'},${0.12 + r() * 0.12})`;
      ctx.beginPath(); ctx.ellipse(r() * size, r() * size, 3 + r() * 7, 2 + r() * 4, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
    const t = finishTexture(c, meters);
    texCache.set(key, t); return t;
  },
};
