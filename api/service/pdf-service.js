const fs = require('fs').promises;
const path = require('path');
const uuidv4 = require('uuid/v4');
const { spawnSync} = require('child_process');
const Crypto = require('../util/crypto');
const RequestValidator = require('../util/request-validator');
const { degrees, PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const PDFLib = require('pdf-lib');
const HummusRecipe = require('hummus-recipe');
const Canvas = require('canvas');
const QRCode = require('qrcode');
const PfxToPem = require('pfx-to-pem');
const QrAppereance = require('./qr-appereance');
const { format } = require('date-fns');

const SIGNER_HOME = path.join(__dirname, '../../', 'jsignpdf', 'conf', 'conf.properties');
const SIGNER_JAR = path.join(__dirname, '../../', 'jsignpdf', 'JSignPdf.jar');
const VERIFIER_JAR = path.join(__dirname, '../../', 'jsignpdf', 'Verifier.jar');

const sign = async ( pdf, p12, password, pag, posX, posY ) => {
    const PRIVATE_KEY = await fs.readFile(process.env.PRIVATE_KEY_FILE_PATH);
    const PUBLIC_KEY = await fs.readFile(process.env.PUBLIC_KEY_FILE_PATH);

    RequestValidator.isNotNull('pdf', pdf);
    RequestValidator.isNotNull('p12', p12);
    RequestValidator.isNotNull('password', password);

    const tmpPdfFolder = path.join(__dirname, '../../', 'tmp', uuidv4());
    const pdfFileName = path.join(tmpPdfFolder, 'demo.pdf');
    const pdfSignedFileName = path.join(tmpPdfFolder, 'demo_signed.pdf');
    const p12Filename = path.join(tmpPdfFolder, 'cert.p12');
    
    try {
        await spawnSync('mkdir', [ tmpPdfFolder ]);

        //Encriptar password
        //console.log( 'Encriptar password', Crypto.encrypt(password, PRIVATE_KEY) );

	    const decryptedPassword = Crypto.decrypt(password, PRIVATE_KEY);
        const p12Result = await fs.writeFile(p12Filename, p12, {encoding: 'base64'});

        console.log('Prueba 13/07/2023');
        console.log(decryptedPassword);

        //Leer firma
        const pem = await PfxToPem.toPem({
            path: p12Filename,
            password: decryptedPassword
        });

        if(pem) {
            const cert = pem.attributes.subject;
            const date = pem.attributes.notAfter;
            const nombre = (cert.givenName) ? cert.givenName + ' ' + cert.surname : cert.commonName;
            const dateNow = new Date(Date.now())
            const isodate = format(dateNow, "yyyy-MM-dd'T'HH:mm:ss.SSSSSSxxx");

            //console.log('certificado:', pem.attributes);
            //console.log('certificado:', pem.attributes.subject); 
            //console.log('certificado:', pem.attributes.notAfter);
            //console.log('certificado nombre:', nombre);

            // X,Y 0,0 borde inferior izquierdo de la página
            pdf = await firmaQr(pdf, nombre, isodate, tmpPdfFolder);
        }

        const imgSign = path.join(tmpPdfFolder, 'signature.png');
    
        const pdfResult = await fs.writeFile(pdfFileName, pdf, {encoding: 'base64'});

        const options = [                        
            '-jar',
            SIGNER_JAR,
            '--load-properties-file',
            SIGNER_HOME,
            '-a',
            '-kst',
            'PKCS12',
            '-ksf',
            p12Filename,
            '-ksp',
            decryptedPassword,
            '-pe',
            'NONE',
            '--print-right',
            'DISALLOW_PRINTING',
            '-ha',
            'SHA512',
            '-cl',
            'CERTIFIED_NO_CHANGES_ALLOWED',
            '--bg-path',
            imgSign,
            '--bg-scale',
            '-1',
            '--page',
            pag,
            '-llx',
            posX,
            '-lly',
            posY,
            '-urx',
            posX+140,
            '-ury',
            posY+50,
            '--render-mode',
            'GRAPHIC_AND_DESCRIPTION',
            '--ocsp',
            '--crl',
            '--reason',
            ' ',
            '--location',
            ' ',
            '--l2-text',
            ' ',
            '--l4-text',
            ' ',
            '--out-directory',
            tmpPdfFolder,
            pdfFileName,
            '--visible-signature',
            '--quiet'
        ];

        const child = spawnSync('java', options);
        const { error, stderr, stdout } = child;
        

        if(error) {
            throw error;
        } else if(stderr.toString('utf8').length > 0) {
            throw new Error(stderr.toString('utf8'));
        }

        console.log('Sin errores 05/07/2023');
        const signedPdf = fs.readFile(pdfSignedFileName);

        return signedPdf;
    } catch(err) {
        console.log('Error al firmar:');
        console.log(err);
        throw err;
    } finally {
	    console.log('Finalizado');
        //await spawnSync('rm', [ '-rf', tmpPdfFolder ]);
    }
}

const verify = async (pdf) => {

    RequestValidator.isNotNull('pdf', pdf);

    const tmpPdfFolder = path.join(__dirname, '../../', 'tmp', uuidv4());
    const pdfFileName = path.join(tmpPdfFolder, 'demo.pdf');

    try {

        spawnSync('mkdir', [ tmpPdfFolder ]);
        fs.writeFileSync(pdfFileName, pdf);

        const child = spawnSync('java', [
            '-jar',
            VERIFIER_JAR,
            '-ff',
            pdfFileName
        ]);

        const { error, stderr, stdout } = child;
        if(error) {
            throw error;
        } else if(stderr.toString('utf8').length > 0) {
            throw new Error(stderr.toString('utf8'));
        }
        return stdout.toString('utf8');
    } catch(err) {
        throw err;
    } finally {
        spawnSync('rm', [ '-rf', tmpPdfFolder ]);
    }
}

const firmaQr = async (pdf, name, isodate, tmpPdfFolder) => {
  // Crear una instancia de QrAppereance con los valores deseados
  const qrAppearance = new QrAppereance(name, '', '', isodate, 'VALIDAR CON: www.firmadigital.gob.ec\n 3.0.2');
  const signaturePosition = { x: 0, y: 0, width: 280, height: 115 }; // Ejemplo de posición de la firma

  // Crear la apariencia personalizada
  const image = await qrAppearance.createCustomAppearance(signaturePosition, tmpPdfFolder);

  return pdf;
}

const firmaQrAnterior = async (pdf, page, posX, posY, name, isodate) => {
    const pdfDoc = await PDFDocument.load(pdf);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const firmaWidth = 400;
    const firmaHeight = 150;

    const pages = pdfDoc.getPages();
    const contentPage = pages[page];
    const { width, height } = contentPage.getSize();

    const canvasObj = Canvas.createCanvas(firmaWidth, firmaHeight);
    const context = canvasObj.getContext('2d');
    const imgQr = new Canvas.Image;

    const firma = `FIRMADO POR: ${name}\nRAZON: \nLOCALIZACION: \nFECHA: ${isodate}\nVALIDAR CON: www.firmadigital.gob.ec 3.0.2`;

    const signature = pdfDoc.createSignature();

    signature.setPage(contentPage);

    const signaturePosition = { x: 100, y: 100, width: 200, height: 100 };
    signature.setPosition(signaturePosition.x, signaturePosition.y);
    signature.setSize(signaturePosition.width, signaturePosition.height);
    
    signature.setSignerName('John Doe'); // Nombre del firmante
    signature.setReason('Firma de documento'); // Razón de la firma
    
    pdfDoc.addSignature(signature);
    
    // Registrar Fuentes
    Canvas.registerFont('fonts/cour.ttf', { family: 'Courier New' })
    Canvas.registerFont('fonts/courbd.ttf', { family: 'Courier New Bold' })

    // Crear el cuadro
    context.fillStyle = 'white';
    context.fillRect(0, 0, firmaWidth, firmaHeight);

    // Generar el QR
    const qr = await QRCode.toDataURL(firma, {width: firmaHeight, errorCorrectionLevel: 'L'});
    imgQr.src = qr;

    // Agregar el QR
    context.drawImage(imgQr, 0, 0);

    // Agregar texto
    context.fillStyle = '#000';
    context.font = '12px "Courier New"';
    context.textAlign = 'left';
    context.fillText('Firmado electrónicamente por:', firmaHeight + 2, 30);

    // Nombre en multiline
    context.font = '26px "Courier New Bold"';
    wrapText(context, name, firmaHeight + 2, 60, (firmaWidth-firmaHeight) + 10, 21);

    const buffer = canvasObj.toBuffer('image/png');

    const pngImage = await pdfDoc.embedPng(buffer);
    const pngDims = pngImage.scale(0.5)

    console.log('firmaQr', pages, width, height);

    contentPage.drawImage(pngImage, {
        x: posX, //contentPage.getWidth() / 2 - pngDims.width / 2 + 75
        y: posY - pngDims.height, //contentPage.getHeight() / 2 - pngDims.height + 250
        width: pngDims.width,
        height: pngDims.height,
    })

    // contentPage.drawText('This text was added with JavaScript!', {
    //     x: 5,
    //     y: height / 2 + 300,
    //     size: 50,
    //     font: helveticaFont,
    //     color: rgb(0.95, 0.1, 0.1),
    //     rotate: degrees(-45),
    // })    

    console.log('page width: ', contentPage.getWidth(), 'page width: ', contentPage.getHeight(), 'posX:', posX, 'posY:', posY);

    return pdfDoc.save();
}

function wrapText(context, text, x, y, line_width, line_height){
    var line = '';
    var paragraphs = text.split('\n');
    for (var i = 0; i < paragraphs.length; i++)
    {
        var words = paragraphs[i].split(' ');
        for (var n = 0; n < words.length; n++)
        {
            var testLine = line + words[n] + ' ';
            var metrics = context.measureText(testLine);
            var testWidth = metrics.width;
            if (testWidth > line_width && n > 0)
            {
                context.fillText(line, x, y);
                line = words[n] + ' ';
                y += line_height;
            }
            else
            {
                line = testLine;
            }
        }
        context.fillText(line, x, y);
        y += line_height;
        line = '';
    }
}

const encryptPassword = async (password) => {
    RequestValidator.isNotNull('password', password);

    const PRIVATE_KEY = await fs.readFile(process.env.PRIVATE_KEY_FILE_PATH);
    const encrypt = Crypto.encrypt(password, PRIVATE_KEY);

    return encrypt;
}
    
module.exports = {
    sign,
    verify,
    encryptPassword
}
