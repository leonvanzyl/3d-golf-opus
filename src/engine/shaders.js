// Custom GLSL shaders: sky, water, lava, waterfall, grass, portal, flame.
import * as THREE from 'three';
import { globalUniforms } from './materials.js';

const noiseGLSL = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  // returns (F1 distance, F2 - F1)
  vec2 voronoi(vec2 x, float t) {
    vec2 n = floor(x), f = fract(x);
    float f1 = 8.0, f2 = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + 0.5 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
    f1 = sqrt(f1); f2 = sqrt(f2);
    return vec2(f1, f2 - f1);
  }
`;

// ---------------------------------------------------------------------------
// Sky dome

export function createSky(opts = {}) {
  const uniforms = {
    uTime: globalUniforms.uTime,
    uTop: { value: new THREE.Color(opts.top ?? 0x3f8fe8) },
    uHorizon: { value: new THREE.Color(opts.horizon ?? 0xbfe6ff) },
    uBottom: { value: new THREE.Color(opts.bottom ?? 0x8fc4e8) },
    uSunDir: { value: new THREE.Vector3(...(opts.sunDir ?? [0.4, 0.5, -0.6])).normalize() },
    uSunColor: { value: new THREE.Color(opts.sunColor ?? 0xfff3c4) },
    uSunSize: { value: opts.sunSize ?? 1.0 },
    uCloudColor: { value: new THREE.Color(opts.cloudColor ?? 0xffffff) },
    uCloudShade: { value: new THREE.Color(opts.cloudShade ?? 0xc9dcf0) },
    uCloud: { value: opts.clouds ?? 0.5 },
    uStars: { value: opts.stars ?? 0 },
    uAurora: { value: opts.aurora ?? 0 },
    uNebula: { value: opts.nebula ?? 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uCloud, uStars, uAurora, uNebula, uSunSize;
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor, uCloudShade;
      varying vec3 vDir;
      ${noiseGLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.25, h));
        // stars
        if (uStars > 0.0) {
          vec3 sd = d * 180.0;
          vec3 cell = floor(sd);
          float s = hash12(cell.xy + cell.z * 17.0);
          vec3 fr = fract(sd) - 0.5;
          float star = smoothstep(0.08, 0.0, length(fr)) * step(0.985, s);
          float tw = 0.6 + 0.4 * sin(uTime * (2.0 + s * 5.0) + s * 40.0);
          col += vec3(1.0, 0.95, 0.85) * star * tw * uStars * smoothstep(-0.05, 0.15, h) * 2.0;
        }
        // nebula
        if (uNebula > 0.0) {
          vec2 np = d.xz / (abs(d.y) + 0.6) * 1.5;
          float n = fbm(np * 1.3 + vec2(uTime * 0.005, 0.0));
          float n2 = fbm(np * 2.1 - vec2(0.0, uTime * 0.004) + 5.0);
          vec3 neb = mix(vec3(0.55, 0.15, 0.75), vec3(0.1, 0.55, 0.9), n2);
          col += neb * smoothstep(0.45, 0.85, n) * uNebula * 0.9;
        }
        // aurora
        if (uAurora > 0.0 && h > 0.0) {
          float a = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float band = sin(d.x * (3.0 + fi) + uTime * (0.15 + fi * 0.05) + fbm(d.xz * 3.0 + fi) * 3.0);
            float y = 0.35 + 0.08 * fi + band * 0.06;
            a += smoothstep(0.09, 0.0, abs(h - y)) * (0.6 - fi * 0.15);
          }
          vec3 ac = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.3, 1.0), smoothstep(0.3, 0.55, h));
          col += ac * a * uAurora * (0.7 + 0.3 * sin(uTime * 0.7 + d.x * 4.0));
        }
        // sun
        float sd = dot(d, normalize(uSunDir));
        float disc = smoothstep(0.9990 - 0.0006 * uSunSize, 0.9993 - 0.0006 * uSunSize, sd);
        col = mix(col, uSunColor * 1.6, disc);
        col += uSunColor * pow(max(sd, 0.0), 40.0) * 0.35;
        // stylised clouds
        if (uCloud > 0.0 && h > 0.0) {
          vec2 cp = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.012, uTime * 0.004);
          float n = fbm(cp);
          float thresh = 0.72 - uCloud * 0.28;
          float m = smoothstep(thresh, thresh + 0.03, n);
          float shade = smoothstep(thresh + 0.02, thresh + 0.16, fbm(cp + vec2(0.06, 0.08)));
          vec3 cc = mix(uCloudColor, uCloudShade, 1.0 - shade);
          col = mix(col, cc, m * smoothstep(0.0, 0.12, h) * 0.95);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.name = 'sky';
  return mesh;
}

// ---------------------------------------------------------------------------
// Toon water

export function waterMaterial(opts = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uDeep: { value: new THREE.Color(opts.deep ?? 0x1f7fd1) },
    uShallow: { value: new THREE.Color(opts.shallow ?? 0x4fc3f7) },
    uFoam: { value: new THREE.Color(opts.foam ?? 0xffffff) },
    uScale: { value: opts.scale ?? 1.0 },
    uFlow: { value: new THREE.Vector2(...(opts.flow ?? [0.05, 0.02])) },
    uWave: { value: opts.wave ?? 0.03 },
  }]);
  uniforms.uTime = globalUniforms.uTime;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uWave;
      varying vec3 vWorld;
      varying float vWave;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w = sin(wp.x * 1.7 + uTime * 1.3) * 0.5 + cos(wp.z * 1.4 + uTime * 1.1) * 0.5;
        wp.y += w * uWave;
        vWave = w;
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uScale;
      uniform vec2 uFlow;
      uniform vec3 uDeep, uShallow, uFoam;
      varying vec3 vWorld;
      varying float vWave;
      #include <common>
      #include <fog_pars_fragment>
      ${noiseGLSL}
      void main() {
        vec2 p = vWorld.xz * 1.1 * uScale;
        vec2 v1 = voronoi(p + uFlow * uTime * 10.0, uTime * 0.8);
        vec2 v2 = voronoi(p * 1.7 - uFlow.yx * uTime * 8.0 + 3.1, uTime * 0.6);
        float lines = smoothstep(0.07, 0.02, v1.y) * 0.8 + smoothstep(0.05, 0.015, v2.y) * 0.45;
        float band = smoothstep(0.35, 0.65, fbm(p * 0.35 + uTime * 0.03));
        vec3 col = mix(uDeep, uShallow, band * 0.6 + vWave * 0.15 + 0.2);
        col = mix(col, uFoam, clamp(lines, 0.0, 1.0) * 0.75);
        // sparkles
        float sp = step(0.985, hash12(floor(vWorld.xz * 14.0) + floor(uTime * 3.0)));
        col += sp * 0.35;
        gl_FragColor = vec4(col, 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    transparent: true,
    fog: true,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------------------
// Lava

export function lavaMaterial(opts = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uFlow: { value: new THREE.Vector2(...(opts.flow ?? [0.03, 0.05])) },
    uIntensity: { value: opts.intensity ?? 1.0 },
  }]);
  uniforms.uTime = globalUniforms.uTime;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 2.3 + uTime * 1.7) * cos(wp.z * 1.9 + uTime * 1.3) * 0.025;
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uIntensity;
      uniform vec2 uFlow;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>
      ${noiseGLSL}
      void main() {
        vec2 p = vWorld.xz * 0.9;
        vec2 flow = uFlow * uTime * 10.0;
        float warp = fbm(p * 0.8 + flow * 0.5);
        vec2 v = voronoi(p * 1.3 + flow + warp * 1.2, uTime * 0.5);
        float crack = smoothstep(0.22, 0.02, v.y);
        float heat = fbm(p * 1.7 - flow * 0.7 + uTime * 0.05);
        vec3 crust = mix(vec3(0.16, 0.03, 0.02), vec3(0.45, 0.07, 0.02), heat);
        vec3 hot = mix(vec3(1.0, 0.35, 0.02), vec3(1.0, 0.85, 0.25), smoothstep(0.4, 0.9, heat + crack * 0.3));
        vec3 col = mix(crust, hot * (1.15 + 0.35 * sin(uTime * 2.0 + heat * 6.0)), max(crack * 0.9, smoothstep(0.6, 0.85, heat) * 0.7));
        gl_FragColor = vec4(col * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    fog: true,
  });
}

// ---------------------------------------------------------------------------
// Waterfall / lavafall (vertical scrolling flow on a plane, uv.y = down)

export function fallMaterial(opts = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uA: { value: new THREE.Color(opts.a ?? 0x4fc3f7) },
    uB: { value: new THREE.Color(opts.b ?? 0xffffff) },
    uSpeed: { value: opts.speed ?? 1.2 },
    uGlow: { value: opts.glow ?? 1.0 },
    uOpacity: { value: opts.opacity ?? 0.9 },
  }]);
  uniforms.uTime = globalUniforms.uTime;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSpeed, uGlow, uOpacity;
      uniform vec3 uA, uB;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      ${noiseGLSL}
      void main() {
        vec2 p = vec2(vUv.x * 6.0, vUv.y * 3.0 + uTime * uSpeed);
        float n = vnoise(vec2(p.x * 1.5, p.y * 0.6)) * 0.6 + vnoise(p * vec2(3.0, 1.2)) * 0.4;
        float streak = smoothstep(0.55, 0.62, n);
        vec3 col = mix(uA, uB, streak * 0.85);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        col = mix(col, uB, smoothstep(0.85, 1.0, vUv.y) * 0.7);
        gl_FragColor = vec4(col * uGlow, uOpacity * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });
}

// ---------------------------------------------------------------------------
// Swaying grass blades (InstancedMesh)

export function grassMaterial(opts = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uBase: { value: new THREE.Color(opts.base ?? 0x2f8f2a) },
    uTip: { value: new THREE.Color(opts.tip ?? 0x9be35a) },
    uWind: { value: opts.wind ?? 1.0 },
  }]);
  uniforms.uTime = globalUniforms.uTime;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uWind;
      varying float vH;
      varying float vVar;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec3 pos = position;
        vec4 wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
        float h = pos.y;
        float ph = wp.x * 0.35 + wp.z * 0.27;
        float gust = sin(uTime * 0.7 + wp.x * 0.08) * 0.5 + 0.5;
        float s = (sin(uTime * 2.2 + ph * 3.0) * 0.6 + gust * 0.8) * uWind * h * h;
        wp.x += s * 0.12;
        wp.z += s * 0.06;
        vH = h;
        vVar = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uTip;
      varying float vH;
      varying float vVar;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vH));
        col *= 0.85 + vVar * 0.3;
        col = floor(col * 8.0 + 0.5) / 8.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true,
  });
}

export function grassBladeGeometry() {
  // tapered blade, height 1 (scaled per instance), 3 segments
  const g = new THREE.BufferGeometry();
  const w = 0.5;
  const verts = [
    -w, 0, 0, w, 0, 0,
    -w * 0.75, 0.35, 0, w * 0.75, 0.35, 0,
    -w * 0.45, 0.7, 0, w * 0.45, 0.7, 0,
    0, 1, 0,
  ];
  const idx = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6];
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// Portal swirl

export function portalMaterial(color = 0x9b5cff, color2 = 0x3ee8ff) {
  const uniforms = {
    uTime: globalUniforms.uTime,
    uA: { value: new THREE.Color(color) },
    uB: { value: new THREE.Color(color2) },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uA, uB;
      varying vec2 vUv;
      ${noiseGLSL}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 10.0 - uTime * 5.0) * 0.5 + 0.5;
        float n = fbm(vec2(a * 2.0, r * 4.0 - uTime * 1.5));
        vec3 col = mix(uA, uB, smoothstep(0.3, 0.8, sw * 0.7 + n * 0.5));
        col *= 1.2 + 2.0 * smoothstep(0.6, 1.0, r);
        col += vec3(1.0) * smoothstep(0.25, 0.0, r) * 1.5;
        float alpha = smoothstep(1.0, 0.9, r);
        gl_FragColor = vec4(col * 1.4, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------------------
// Flame (additive, on a cone or plane with uv)

export function flameMaterial(opts = {}) {
  const uniforms = {
    uTime: globalUniforms.uTime,
    uSeed: { value: opts.seed ?? Math.random() * 10 },
    uInner: { value: new THREE.Color(opts.inner ?? 0xfff2a0) },
    uOuter: { value: new THREE.Color(opts.outer ?? 0xff5a14) },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uSeed;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float h = uv.y;
        p.x += sin(uTime * 9.0 + uSeed + h * 4.0) * 0.04 * h;
        p.z += cos(uTime * 7.0 + uSeed * 2.0 + h * 3.0) * 0.04 * h;
        p *= 1.0 + sin(uTime * 13.0 + uSeed) * 0.06;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed;
      uniform vec3 uInner, uOuter;
      varying vec2 vUv;
      ${noiseGLSL}
      void main() {
        float n = vnoise(vec2(vUv.x * 8.0, vUv.y * 3.0 - uTime * 4.0 + uSeed));
        float h = vUv.y;
        float f = (1.0 - h) * (0.7 + n * 0.6);
        vec3 col = mix(uOuter, uInner, smoothstep(0.45, 0.9, f));
        float a = smoothstep(0.15, 0.4, f);
        gl_FragColor = vec4(col * 2.4, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Simple glowing shield / beam (fresnel), used for UFO beams, force fields

export function beamMaterial(color = 0x7cf7ff, strength = 1.0) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: globalUniforms.uTime, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float bands = 0.6 + 0.4 * sin(vUv.y * 30.0 - uTime * 6.0);
        float a = (1.0 - vUv.y) * 0.45 * bands * uStrength;
        gl_FragColor = vec4(uColor * 1.8, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
