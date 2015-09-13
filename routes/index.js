var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Mosaic Ninja' });
});

router.get('/about', function (req, res, next) {
  res.render('about', { title: 'About Mosaic Ninja' });
});

router.get('/terms', function (req, res, next) {
  res.render('terms', { title: 'Mosaic Ninja | Terms and Conditions' });
});

module.exports = router;
