var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  console.log('Cookies: ', req.cookies);
  console.log(req.session);
  if (!req.session.userInfo){
    console.log('Not logged in!')
    res.render('welcome');
  }
  else res.render('index');
});

router.get('/login', function (req, res, next) {
  if (req.session.userInfo) res.redirect("/");
  else res.render('login',{notification:""});
});

router.get('/register', function (req, res, next) {
  if (req.session.userInfo) res.redirect("/");
  else res.render('register',{notification:""});
});

module.exports = router;
