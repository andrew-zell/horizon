import type { SkyParams } from '../types'

interface RendererOptions {
  preserveDrawingBuffer?: boolean
}

const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

const createProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
) => {
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'Unknown program link error'
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    gl.deleteProgram(program)
    throw new Error(info)
  }

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  return program
}

const FULLSCREEN_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const GRADIENT_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_zenithHue;
uniform float u_zenithSat;
uniform float u_zenithLight;
uniform float u_horizonHue;
uniform float u_horizonSat;
uniform float u_horizonLight;
uniform float u_horizonIntensity;
uniform float u_hazeWidth;
uniform float u_groundHue;
uniform float u_groundDarkness;
uniform float u_scatter;
uniform float u_sunsetIntensity;
uniform float u_clarity;
uniform float u_radialDispersion;
uniform float u_gradientScale;
uniform float u_gradientShift;

out vec4 fragColor;

vec3 hsl2rgb(float h, float s, float l) {
  h = mod(h, 360.0) / 360.0;
  s /= 100.0;
  l /= 100.0;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if      (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
  else                  rgb = vec3(c, 0.0, x);
  return rgb + m;
}

float smootherstep(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 skyColor(float t) {
  vec3 zenith = hsl2rgb(u_zenithHue, u_zenithSat, u_zenithLight);
  vec3 horizon = hsl2rgb(u_horizonHue, u_horizonSat, u_horizonLight);
  vec3 ground = hsl2rgb(u_groundHue, 20.0, (1.0 - u_groundDarkness) * 20.0);
  vec3 scatter = hsl2rgb(210.0, 60.0 * u_scatter, 40.0);

  vec3 horizonWarm = mix(
    horizon,
    hsl2rgb(u_horizonHue - 15.0, min(u_horizonSat + 20.0, 100.0), u_horizonLight * 0.7),
    u_horizonIntensity
  );

  float wZenith = 1.0 - smoothstep(0.0, 0.55, t);
  float wScatter = smoothstep(0.0, 0.3, t) * (1.0 - smoothstep(0.3, 0.65, t)) * u_scatter;
  float wHorizon = smoothstep(0.35, 0.65, t) * (1.0 - smoothstep(0.65, 0.85, t));
  wHorizon *= u_horizonIntensity * 0.8 + 0.2;
  float wGround = smoothstep(0.72, 0.92, t);

  vec3 color = zenith;
  color = mix(color, color + scatter * 0.4, wScatter);
  color = mix(color, horizonWarm, smoothstep(0.3, 0.72, t) * (1.0 - wGround));
  color = mix(color, ground, wGround);

  float sunsetMask = smoothstep(0.3, 0.6, t) * (1.0 - smoothstep(0.6, 0.85, t));
  vec3 sunsetTint = hsl2rgb(30.0, 80.0, 55.0);
  color = mix(color, mix(color, sunsetTint, 0.35), sunsetMask * u_sunsetIntensity);

  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(grey) * 0.9 + 0.1, color, u_clarity);

  return clamp(color, 0.0, 1.0);
}

float bayer(ivec2 p) {
  const int bayer4[16] = int[16](
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
  );
  return float(bayer4[(p.x & 3) + (p.y & 3) * 4]) / 16.0 - 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 origin = vec2(0.5, -0.08);
  vec2 toPixel = uv - origin;
  float maxDist = length(vec2(0.5, 1.08));
  float radialT = clamp(length(toPixel) / maxDist, 0.0, 1.0);
  float linearT = uv.y;
  float t = linearT + (radialT - linearT) * u_radialDispersion;
  t = clamp((t / max(u_gradientScale, 0.0001)) - u_gradientShift, 0.0, 1.0);
  vec3 color = skyColor(t);
  color += bayer(ivec2(gl_FragCoord.xy)) / 255.0;
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`

const REFRACTION_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform float u_barWidth;
uniform float u_refraction;
uniform float u_seed;
uniform vec2 u_resolution;
in vec2 v_uv;
out vec4 fragColor;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  float uvBarWidth = max(u_barWidth / u_resolution.x, 0.001);
  float barIndex = floor(v_uv.x / uvBarWidth);
  float barNext = barIndex + 1.0;

  float rand   = hash(barIndex + u_seed * 0.01);
  float rand2  = hash(barIndex + u_seed * 0.01 + 137.5);
  float randN  = hash(barNext  + u_seed * 0.01);
  float rand2N = hash(barNext  + u_seed * 0.01 + 137.5);

  float offsetX  = (rand  - 0.5) * 2.0 * (u_refraction / u_resolution.x);
  float offsetY  = (rand2 - 0.5) * 2.0 * (u_refraction / u_resolution.y);
  float offsetXN = (randN  - 0.5) * 2.0 * (u_refraction / u_resolution.x);
  float offsetYN = (rand2N - 0.5) * 2.0 * (u_refraction / u_resolution.y);

  float shiftedX = clamp(v_uv.x + offsetX, 0.0, 1.0);
  float shiftedY = clamp(v_uv.y + offsetY, 0.0, 1.0);
  vec4 col = texture(u_texture, vec2(shiftedX, shiftedY));

  float edgePos = fract(v_uv.x / uvBarWidth);
  float edgeDist = min(edgePos, 1.0 - edgePos);
  float edgeMask = 1.0 - smoothstep(0.0, 0.08, edgeDist);
  float divergence = length(vec2(offsetX - offsetXN, offsetY - offsetYN));
  float maxPossibleDivergence = 2.0 * (u_refraction / u_resolution.x) * 1.414;
  float normalizedDivergence = divergence / max(maxPossibleDivergence, 0.0001);
  float causticStrength = smoothstep(0.7, 1.0, normalizedDivergence);
  float caustic = edgeMask * causticStrength * 0.6;

  vec4 causticColor = texture(u_texture, vec2(0.5, shiftedY));
  col.rgb = mix(col.rgb, max(col.rgb, causticColor.rgb * 1.4), caustic);

  fragColor = vec4(clamp(col.rgb, 0.0, 1.0), 1.0);
}`

const PASSTHROUGH_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  fragColor = texture(u_texture, vec2(v_uv.x, 1.0 - v_uv.y));
}`

export function createGradientRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions = {},
) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    powerPreference: 'high-performance',
    premultipliedAlpha: false,
  })

  if (!gl) {
    throw new Error('WebGL2 is required for gradient rendering')
  }

  const gradientProgram = createProgram(gl, FULLSCREEN_VERT, GRADIENT_FRAG)
  const refractionProgram = createProgram(gl, FULLSCREEN_VERT, REFRACTION_FRAG)
  const passthroughProgram = createProgram(gl, FULLSCREEN_VERT, PASSTHROUGH_FRAG)

  const vao = gl.createVertexArray()
  const buffer = gl.createBuffer()
  const fbo = gl.createFramebuffer()
  const fboTexture = gl.createTexture()

  if (!vao || !buffer || !fbo || !fboTexture) {
    throw new Error('Failed to create WebGL resources')
  }

  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  )

  const bindProgramPosition = (program: WebGLProgram) => {
    const location = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
  }

  gl.useProgram(gradientProgram)
  bindProgramPosition(gradientProgram)
  gl.useProgram(refractionProgram)
  bindProgramPosition(refractionProgram)
  gl.useProgram(passthroughProgram)
  bindProgramPosition(passthroughProgram)

  gl.bindTexture(gl.TEXTURE_2D, fboTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  const gradientUniforms = {
    resolution: gl.getUniformLocation(gradientProgram, 'u_resolution'),
    zenithHue: gl.getUniformLocation(gradientProgram, 'u_zenithHue'),
    zenithSat: gl.getUniformLocation(gradientProgram, 'u_zenithSat'),
    zenithLight: gl.getUniformLocation(gradientProgram, 'u_zenithLight'),
    horizonHue: gl.getUniformLocation(gradientProgram, 'u_horizonHue'),
    horizonSat: gl.getUniformLocation(gradientProgram, 'u_horizonSat'),
    horizonLight: gl.getUniformLocation(gradientProgram, 'u_horizonLight'),
    horizonIntensity: gl.getUniformLocation(gradientProgram, 'u_horizonIntensity'),
    hazeWidth: gl.getUniformLocation(gradientProgram, 'u_hazeWidth'),
    groundHue: gl.getUniformLocation(gradientProgram, 'u_groundHue'),
    groundDarkness: gl.getUniformLocation(gradientProgram, 'u_groundDarkness'),
    scatter: gl.getUniformLocation(gradientProgram, 'u_scatter'),
    sunsetIntensity: gl.getUniformLocation(gradientProgram, 'u_sunsetIntensity'),
    clarity: gl.getUniformLocation(gradientProgram, 'u_clarity'),
    radialDispersion: gl.getUniformLocation(gradientProgram, 'u_radialDispersion'),
    gradientScale: gl.getUniformLocation(gradientProgram, 'u_gradientScale'),
    gradientShift: gl.getUniformLocation(gradientProgram, 'u_gradientShift'),
  }

  const refractionUniforms = {
    texture: gl.getUniformLocation(refractionProgram, 'u_texture'),
    barWidth: gl.getUniformLocation(refractionProgram, 'u_barWidth'),
    refraction: gl.getUniformLocation(refractionProgram, 'u_refraction'),
    seed: gl.getUniformLocation(refractionProgram, 'u_seed'),
    resolution: gl.getUniformLocation(refractionProgram, 'u_resolution'),
  }

  const passthroughUniforms = {
    texture: gl.getUniformLocation(passthroughProgram, 'u_texture'),
  }

  let textureWidth = 0
  let textureHeight = 0

  const ensureTargetSize = () => {
    if (textureWidth === canvas.width && textureHeight === canvas.height) return
    textureWidth = canvas.width
    textureHeight = canvas.height
    gl.bindTexture(gl.TEXTURE_2D, fboTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      textureWidth,
      textureHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
  }

  return {
    render(params: SkyParams) {
      ensureTargetSize()
      gl.bindVertexArray(vao)

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(gradientProgram)
      gl.uniform2f(gradientUniforms.resolution, canvas.width, canvas.height)
      gl.uniform1f(gradientUniforms.zenithHue, params.zenithHue)
      gl.uniform1f(gradientUniforms.zenithSat, params.zenithSaturation)
      gl.uniform1f(gradientUniforms.zenithLight, params.zenithLightness)
      gl.uniform1f(gradientUniforms.horizonHue, params.horizonHue)
      gl.uniform1f(gradientUniforms.horizonSat, params.horizonSaturation)
      gl.uniform1f(gradientUniforms.horizonLight, params.horizonLightness)
      gl.uniform1f(gradientUniforms.horizonIntensity, params.horizonIntensity)
      gl.uniform1f(gradientUniforms.hazeWidth, params.hazeWidth)
      gl.uniform1f(gradientUniforms.groundHue, params.groundHue)
      gl.uniform1f(gradientUniforms.groundDarkness, params.groundDarkness)
      gl.uniform1f(gradientUniforms.scatter, params.atmosphericScatter)
      gl.uniform1f(gradientUniforms.sunsetIntensity, params.sunsetIntensity)
      gl.uniform1f(gradientUniforms.clarity, params.clarity)
      gl.uniform1f(gradientUniforms.radialDispersion, params.radialDispersion)
      gl.uniform1f(gradientUniforms.gradientScale, params.gradientScale)
      gl.uniform1f(gradientUniforms.gradientShift, params.gradientShift)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, fboTexture)

      if (params.effects.barsEnabled) {
        console.log('refraction pass running, strength:', params.effects.refractStrength)
        gl.useProgram(refractionProgram)
        gl.uniform1i(refractionUniforms.texture, 0)
        gl.uniform1f(refractionUniforms.barWidth, params.effects.barWidth)
        gl.uniform1f(refractionUniforms.refraction, params.effects.refractStrength)
        gl.uniform1f(refractionUniforms.seed, params.effects.barSeed)
        gl.uniform2f(refractionUniforms.resolution, canvas.width, canvas.height)
      } else {
        gl.useProgram(passthroughProgram)
        gl.uniform1i(passthroughUniforms.texture, 0)
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    getGL() {
      return gl
    },
    dispose() {
      gl.deleteTexture(fboTexture)
      gl.deleteFramebuffer(fbo)
      gl.deleteBuffer(buffer)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(gradientProgram)
      gl.deleteProgram(refractionProgram)
      gl.deleteProgram(passthroughProgram)
    },
  }
}
