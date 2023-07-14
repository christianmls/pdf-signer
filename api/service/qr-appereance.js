const { createCanvas, loadImage, createJPEGStream } = require('canvas');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class QrAppereance {
  constructor(nombreFirmante, reason, location, signTime, infoQR) {
    this.nombreFirmante = nombreFirmante;
    this.reason = reason;
    this.location = location;
    this.signTime = signTime;
    this.infoQR = infoQR;
  }

  getLinesForText(text, maxWidth, ctx) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const metrics = ctx.measureText(`${currentLine} ${word}`);
      const lineWidth = metrics.width;

      if (lineWidth > maxWidth && currentLine !== '') {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += ` ${word}`;
      }
    }
    lines.push(currentLine.trim());

    return lines;
  }  

  async createCustomAppearance(signaturePosition, outputFolderPath) {
    const canvas = createCanvas(signaturePosition.width, signaturePosition.height);
    const ctx = canvas.getContext('2d');

    const qrSize = signaturePosition.height;

    ctx.fillStyle = '#ffffff'; // Establecer el fondo blanco
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const text = `FIRMADO POR: ${this.nombreFirmante.trim()}\n` +
      `RAZON: ${this.reason}\n` +
      `LOCALIZACION: ${this.location}\n` +
      `FECHA: ${this.signTime}\n` +
      `${this.infoQR}`;

    const textStartX = qrSize + 2.5; // Espacio entre el código QR y el inicio del texto

    let byteQR;
    try {
      byteQR = await QRCode.toBuffer(text, { errorCorrectionLevel: 'L', width: qrSize, height: qrSize });
    } catch (e) {
      console.warn('Error al generar QR:', e);
      return null;
    }

    const image = await loadImage(byteQR);
    ctx.drawImage(image, 0, 0, qrSize, qrSize);

    const maxTextWidth = signaturePosition.width - textStartX - 10; // Ancho máximo para el texto
    const lines = this.getLinesForText(this.nombreFirmante.trim(), maxTextWidth, ctx);
    const lineHeight = 16;
    const textStartY = (signaturePosition.height - lineHeight * lines.length) / 2; // Centrar verticalmente el texto

    ctx.font = '8px Courier';
    ctx.fillStyle = '#000000'; // Establecer el color de texto en negro
    ctx.fillText('Firmado electrónicamente por:', textStartX, textStartY);
    
    ctx.font = '13px Courier-Bold';
    ctx.fillStyle = '#000000';
    let y = textStartY + lineHeight;
    for (const line of lines) {
      ctx.fillText(line, textStartX, y);
      y += lineHeight;
    }

    const outputFilePath = path.join(outputFolderPath, 'signature.png');
    const jpegStream = canvas.createPNGStream({});

    const writeStream = fs.createWriteStream(outputFilePath);
    jpegStream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log(`Imagen guardada en: ${outputFilePath}`);
        resolve(outputFilePath);
      });

      writeStream.on('error', (err) => {
        console.error('Error al guardar la imagen:', err);
        reject(err);
      });
    });
  }
}

module.exports = QrAppereance;
