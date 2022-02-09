const fs = require('fs').promises;
const path = require('path');
const uuidv4 = require('uuid/v4');
const { spawnSync} = require('child_process');
const Crypto = require('../util/crypto');
const RequestValidator = require('../util/request-validator');
const { degrees, PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const SIGNER_JAR = path.join(__dirname, '../../', 'jsignpdf', 'JSignPdf.jar');
const VERIFIER_JAR = path.join(__dirname, '../../', 'jsignpdf', 'Verifier.jar');

const sign = async ( pdf, p12, password ) => {
    const PRIVATE_KEY = await fs.readFile(process.env.PRIVATE_KEY_FILE_PATH);

    RequestValidator.isNotNull('pdf', pdf);
    RequestValidator.isNotNull('p12', p12);
    RequestValidator.isNotNull('password', password);

    const tmpPdfFolder = path.join(__dirname, '../../', 'tmp', uuidv4());
    const pdfFileName = path.join(tmpPdfFolder, 'demo.pdf');
    const pdfSignedFileName = path.join(tmpPdfFolder, 'demo_signed.pdf');
    const p12Filename = path.join(tmpPdfFolder, 'cert.p12');

    pdf = await firmaQr(pdf, 0, 0, 0);

    try {
        await spawnSync('mkdir', [ tmpPdfFolder ]);

	    const decryptedPassword = Crypto.decrypt(password, PRIVATE_KEY);
        const pdfResult = await fs.writeFile(pdfFileName, pdf, {encoding: 'base64'});
        const p12Result = await fs.writeFile(p12Filename, p12, {encoding: 'base64'});


        const options = [
            '-jar',
            SIGNER_JAR,
            '-a',
            '-kst',
            'PKCS12',
            '-ksf',
            p12Filename,
            '-ksp',
            decryptedPassword,
            '-pe',
            'NONE',
            '-pr',
            'DISALLOW_PRINTING',
            '--ocsp',
            '--crl',
            '-d',
            tmpPdfFolder,
            pdfFileName
        ];


        const child = spawnSync('java', options);
        const { error, stderr, stdout } = child;

        if(error) {
            throw error;
        } else if(stderr.toString('utf8').length > 0) {
            throw new Error(stderr.toString('utf8'));
        }

        const signedPdf = fs.readFile(pdfSignedFileName);

        return signedPdf;
    } catch(err) {
        throw err;
    } finally {
	console.log('Finalizado');
        await spawnSync('rm', [ '-rf', tmpPdfFolder ]);
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

const firmaQr = async (pdf, page, x, y) => {
    const pdfDoc = await PDFDocument.load(pdf);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const firstPage = pages[page];
    const { width, height } = firstPage.getSize();

    print(pdf);

    firstPage.drawText('This text was added with JavaScript!', {
        x: 5,
        y: height / 2 + 300,
        size: 50,
        font: helveticaFont,
        color: rgb(0.95, 0.1, 0.1),
        rotate: degrees(-45),
    });

    return await pdfDoc.save();
}

module.exports = {
    sign,
    verify
}
