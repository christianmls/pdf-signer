const express = require('express');
const controller = require('../controller/pdf-controller');

const Router = express.Router();

Router.post('/sign', controller.sign);
Router.post('/verify', controller.verify);
Router.post('/encrypt-password', controller.encryptPassword);
Router.get('/public-key', controller.getPublicKey);

module.exports = Router;