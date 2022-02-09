const dotenv = require('dotenv');
const express = require('express');
const app = express();
const PDFRoutes = require('./api/route/pdf-routes');
const Validation = require('./api/config/validation');

const PORT = process.env.PORT || 8080;

<<<<<<< HEAD
app.use(express.json({limit: '50mb'}));

=======
const result = dotenv.config()

console.log('Resultado:', result);

app.use(express.json());
>>>>>>> 92c4a970576faa5f5edda5c8962cc8775d79ee78
app.use('/pdf', PDFRoutes);

Validation.validateRequirements();

const server = app.listen(PORT, function () {
  console.log('Example app listening on port ' + PORT + '!');
});
