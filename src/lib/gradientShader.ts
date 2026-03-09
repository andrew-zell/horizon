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
precision highp int;

uniform vec2 u_resolution;
uniform float u_zenithHue;
uniform float u_zenithSat;
uniform float u_zenithLight;
uniform float u_horizonHue;
uniform float u_horizonSat;
uniform float u_horizonLight;
uniform float u_horizonIntensity;
uniform float u_hazeWidth;
uniform float u_hazeIntensity;
uniform float u_groundHue;
uniform float u_groundSat;
uniform float u_groundLight;
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
  vec3 ground = hsl2rgb(u_groundHue, u_groundSat, u_groundLight);
  vec3 scatter = hsl2rgb(210.0, 60.0 * u_scatter, 40.0);
  vec3 hazeLight = hsl2rgb(
    u_horizonHue - 4.0,
    u_horizonSat * 0.48,
    min(97.0, u_horizonLight + 26.0)
  );

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
  float hazeCenter = 0.72;
  float hazeHalfWidth = 0.06 + u_hazeWidth * 0.16;
  float hazeMask = max(0.0, 1.0 - abs(t - hazeCenter) / hazeHalfWidth);

  vec3 color = zenith;
  color = mix(color, color + scatter * 0.4, wScatter);
  color = mix(color, horizonWarm, smoothstep(0.3, 0.72, t) * (1.0 - wGround));
  vec3 horizonBand = mix(
    mix(horizon, hazeLight, 0.42 + (1.0 - u_clarity) * 0.28),
    hazeLight,
    smoothstep(0.62, 0.82, t) * (0.22 + u_hazeWidth * 0.32)
  );
  color = mix(color, horizonBand, hazeMask * u_hazeIntensity * (0.25 + u_horizonIntensity * 0.55));
  color = mix(color, ground, wGround);

  float sunsetMask = smoothstep(0.3, 0.6, t) * (1.0 - smoothstep(0.6, 0.85, t));
  vec3 sunsetTint = hsl2rgb(30.0, 80.0, 55.0);
  color = mix(color, mix(color, sunsetTint, 0.35), sunsetMask * u_sunsetIntensity);

  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(grey) * 0.9 + 0.1, color, u_clarity);

  return clamp(color, 0.0, 1.0);
}

float interleavedNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))) - 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float linearT = 1.0 - uv.y;
  float xCurve = 1.0 - pow(abs(uv.x - 0.5) * 2.0, 2.0);
  float bend = u_radialDispersion * xCurve * 0.35;
  float t = linearT - bend;
  t = clamp((t / max(u_gradientScale, 0.0001)) - u_gradientShift, 0.0, 1.0);
  vec3 color = skyColor(t);
  color += interleavedNoise(gl_FragCoord.xy) / 192.0;
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

float interleavedNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))) - 0.5;
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
  col.rgb += interleavedNoise(gl_FragCoord.xy + vec2(17.0, 29.0)) / 192.0;

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
    hazeIntensity: gl.getUniformLocation(gradientProgram, 'u_hazeIntensity'),
    groundHue: gl.getUniformLocation(gradientProgram, 'u_groundHue'),
    groundSat: gl.getUniformLocation(gradientProgram, 'u_groundSat'),
    groundLight: gl.getUniformLocation(gradientProgram, 'u_groundLight'),
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

  let textureWidth = 0
  let textureHeight = 0
  let fboUsesFloat = false

  const ensureTargetSize = () => {
    if (textureWidth === canvas.width && textureHeight === canvas.height) return
    textureWidth = canvas.width
    textureHeight = canvas.height
    gl.bindTexture(gl.TEXTURE_2D, fboTexture)
    const ext = gl.getExtension('EXT_color_buffer_half_float')

    const allocateTarget = (internalFormat: number, type: number) => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        textureWidth,
        textureHeight,
        0,
        gl.RGBA,
        type,
        null,
      )
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0)
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      return status === gl.FRAMEBUFFER_COMPLETE
    }

    fboUsesFloat = Boolean(ext) && allocateTarget(gl.RGBA16F, gl.HALF_FLOAT)
    if (!fboUsesFloat) {
      allocateTarget(gl.RGBA8, gl.UNSIGNED_BYTE)
    }
  }

  return {
    render(params: SkyParams) {
      gl.bindVertexArray(vao)
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
      gl.uniform1f(gradientUniforms.hazeIntensity, params.hazeIntensity)
      gl.uniform1f(gradientUniforms.groundHue, params.groundHue)
      gl.uniform1f(gradientUniforms.groundSat, params.groundSaturation)
      gl.uniform1f(gradientUniforms.groundLight, params.groundLightness)
      gl.uniform1f(gradientUniforms.scatter, params.atmosphericScatter)
      gl.uniform1f(gradientUniforms.sunsetIntensity, params.sunsetIntensity)
      gl.uniform1f(gradientUniforms.clarity, params.clarity)
      gl.uniform1f(gradientUniforms.radialDispersion, params.radialDispersion)
      gl.uniform1f(gradientUniforms.gradientScale, params.gradientScale)
      gl.uniform1f(gradientUniforms.gradientShift, params.gradientShift)

      if (!params.effects.barsEnabled) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        return
      }

      ensureTargetSize()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, fboTexture)
      if (fboUsesFloat) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }
      gl.useProgram(refractionProgram)
      gl.uniform1i(refractionUniforms.texture, 0)
      gl.uniform1f(refractionUniforms.barWidth, params.effects.barWidth)
      gl.uniform1f(refractionUniforms.refraction, params.effects.refractStrength)
      gl.uniform1f(refractionUniforms.seed, params.effects.barSeed)
      gl.uniform2f(refractionUniforms.resolution, canvas.width, canvas.height)
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
