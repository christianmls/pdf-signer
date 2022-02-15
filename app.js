const dotenv = require('dotenv');
const express = require('express');
const app = express();
const PDFRoutes = require('./api/route/pdf-routes');
const Validation = require('./api/config/validation');

const result = dotenv.config({path: __dirname + '/.env'})
const PORT = process.env.PORT || 8080;

console.log('Resultado:', result);

app.use(express.json({limit: '50mb'}));
app.use('/pdf', PDFRoutes);

Validation.validateRequirements();

const server = app.listen(PORT, function () {
  console.log('Example app listening on port ' + PORT + '!');
});
