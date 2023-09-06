var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var spendingRouter = require('./routes/spending');
var category = require('./routes/category');
var review = require('./routes/review');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const dbOptions = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_USING,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000
};
const sessionStore = new MySQLStore(dbOptions);
app.use(session({
  key: 'session_cookie_expenditurerecord',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));
sessionStore.onReady().then(() => {
  console.log('MySQLStore ready');// MySQL session store ready for use.
}).catch(error => {
  console.error(error);// Something went wrong.
});

// app.use(session({
//   secret:process.env.SESSION_SECRET,
//   resave: false,
//   cookie: { maxAge: 864000000 }
// })); //prev version  before use sql

app.use(function (req, res, next) {
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  next();
}); //doesn't seem to work if placed after all those routes below...

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/spending', spendingRouter);
app.use('/category', category);
app.use('/review',review);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(8000, () => {
  console.log('Connected');
})

module.exports = app;
