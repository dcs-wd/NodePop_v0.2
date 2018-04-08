'use strict';

const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const jwtAuth = require('./lib/jwtAuth');

const db = require('./lib/connectMongoose');

// Cargamos las definiciones de todos nuestros modelos
require('./models/Anuncio');
const Usuario = require('./models/Usuario');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
// Cambio motor a html
app.set('view engine', 'html');
app.engine('html', require('ejs').__express);

// Global Template variables
app.locals.title = 'NodePop';

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// middleware de estáticos
app.use(express.static(path.join(__dirname, 'public')));

// i18n config
const i18n = require('./lib/i18nConfigure')();
app.use(i18n.init);

// login controller
const loginController = require('./routes/loginController');

// API v1
app.use('/apiv1/anuncios', jwtAuth(), require('./routes/apiv1/anuncios'));
app.use('/loginJWT', loginController.postLoginJWT);

// middleware de control de sesiones
app.use(session({
  name: 'token-session',
  secret: 'askjdahjdhakdhaskdas7dasd87asd89as7d89asd7a9s8dhjash',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 24 * 60 * 60 * 1000, httpOnly: true }, // dos dias de inactividad
  store: new MongoStore({
    url: 'mongodb://localhost/nodepop'
  })
}));

app.use(async (req, res, next) => {
  try {
    // si el usuario está logado, cargamos en req.user el objeto de usuario desde la base de datos
    // para que los siguientes middlewares lo puedan usar
    req.user = req.session.authUser ? await Usuario.findById(req.session.authUser._id) : null;
    next();
  } catch (err) {
    next(err);
    return;
  }
});

// Web
app.use(function (req, res, next) {
  next();
});

app.get('/login', loginController.index);
app.post('/login', loginController.post);
app.get('/logout', loginController.logout);

app.use('/', require('./routes/index'));
app.use('/about', require('./routes/about'));
app.use('/lang', require('./routes/lang'));

app.use('/ads', require('./routes/anuncios'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {

  if (err.array) { // validation error
    err.status = 422;
    const errInfo = err.array({ onlyFirstError: true })[0];
    err.message = isAPI(req) ?
      { message: 'not valid', errors: err.mapped() }
      : `not valid - ${errInfo.param} ${errInfo.msg}`;
  }

  // establezco el status a la respuesta
  err.status = err.status || 500;
  res.status(err.status);

  // si es un 500 lo pinto en el log
  if (err.status && err.status >= 500) console.error(err);

  // si es una petición de API, respondemos con JSON
  if (isAPI(req)) {
    res.json({ success: false, error: err.message });
    return;
  }

  // Respondo con una página de error

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.render('error');
});

function isAPI(req) {
  return req.originalUrl.indexOf('/api') === 0;
}

module.exports = app;
