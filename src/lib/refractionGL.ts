import type { EffectsParams } from '../types'

export type RefractionParams = Pick<
  EffectsParams,
  'barsEnabled' | 'barWidth' | 'refractStrength' | 'barSeed'
>

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

export function createRefractionRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  })

  if (!gl) {
    throw new Error('WebGL2 is required for refraction rendering')
  }

  const vertSrc = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`

  const fragSrc = `#version 300 es
    precision highp float;
    uniform sampler2D u_gradient;
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
      float x = v_uv.x * u_resolution.x;
      float barIndex = floor(x / max(u_barWidth, 1.0));
      float offset = (hash(barIndex + u_seed * 0.01) - 0.5) * 2.0 * u_refraction;
      float shiftedX = clamp((x + offset) / u_resolution.x, 0.0, 1.0);
      fragColor = texture(u_gradient, vec2(shiftedX, v_uv.y));
    }`

  const program = createProgram(gl, vertSrc, fragSrc)
  const vao = gl.createVertexArray()
  const positionBuffer = gl.createBuffer()
  const texture = gl.createTexture()

  if (!vao || !positionBuffer || !texture) {
    throw new Error('Failed to initialize WebGL resources')
  }

  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  )

  const positionLocation = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const gradientLocation = gl.getUniformLocation(program, 'u_gradient')
  const barWidthLocation = gl.getUniformLocation(program, 'u_barWidth')
  const refractionLocation = gl.getUniformLocation(program, 'u_refraction')
  const seedLocation = gl.getUniformLocation(program, 'u_seed')
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
  let textureWidth = 0
  let textureHeight = 0

  const uploadGradient = (gradientCanvas: HTMLCanvasElement | OffscreenCanvas) => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    if (textureWidth !== gradientCanvas.width || textureHeight !== gradientCanvas.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gradientCanvas)
      textureWidth = gradientCanvas.width
      textureHeight = gradientCanvas.height
      return
    }

    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, gradientCanvas)
  }

  return {
    uploadGradient,
    render(params: RefractionParams) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(gradientLocation, 0)
      gl.uniform1f(barWidthLocation, params.barWidth)
      gl.uniform1f(refractionLocation, params.barsEnabled ? params.refractStrength : 0)
      gl.uniform1f(seedLocation, params.barSeed)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(positionBuffer)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
    },
  }
}
