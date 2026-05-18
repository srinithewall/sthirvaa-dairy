const Jimp = require('jimp');

async function processLogo() {
  try {
    const image = await Jimp.read('public/logo.jpg');
    const w = image.bitmap.width;
    const h = image.bitmap.height;

    // The emblem is roughly the top half, horizontally centered
    const cropX = Math.floor(w * 0.2);
    const cropY = Math.floor(h * 0.05);
    const cropW = Math.floor(w * 0.6);
    const cropH = Math.floor(h * 0.45);

    image.crop(cropX, cropY, cropW, cropH);

    // Make white/textured background transparent
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red   = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue  = this.bitmap.data[idx + 2];
      
      // If the pixel is very light (the textured paper background)
      if (red > 230 && green > 230 && blue > 230) {
        this.bitmap.data[idx + 3] = 0; // Alpha to 0
      }
    });

    await image.writeAsync('public/perfect-emblem.png');
    console.log('Successfully created perfect-emblem.png');
  } catch (error) {
    console.error('Error processing logo:', error);
  }
}

processLogo();
