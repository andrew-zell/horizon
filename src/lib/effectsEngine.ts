export const getNoiseBlurAmount = (scale: number) => ((scale - 10) / 190) * 2

export const renderGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const image = ctx.createImageData(width, height)
  const data = image.data

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.floor(Math.random() * 255)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }

  ctx.putImageData(image, 0, 0)
}
