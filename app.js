const dotenv = require('dotenv');
const express = require('express');
const basicAuth = require('express-basic-auth');

const PDFRoutes = require('./api/route/pdf-routes');
const Validation = require('./api/config/validation');
const app = express();

const result = dotenv.config({path: __dirname + '/.env'})
const PORT = process.env.PORT || 8080;

console.log('Resultado:', result);

app.use(basicAuth({
  users: { 'compraspublicas': 'GFWHhYWC8GRmRy2FDcP4eyLqk9hAFB', 'nicec': 'JSAgkQHsLcQyLS2cQnZ8XAjYYQ7SU5' }
}))

app.use(function (req, res, next) {
  console.log('hostname:', req.hostname);
  next();
});

app.use(express.json({limit: '50mb'}));
app.use('/pdf', PDFRoutes);

Validation.validateRequirements();

const server = app.listen(PORT, function () {
  console.log('Example app listening on port ' + PORT + '!');
});
