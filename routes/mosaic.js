var express = require('express');
var router = express.Router();

var config = require('../config');
var request = require('request');
var Facebook = require('facebook-node-sdk');
var facebook = new Facebook({ appID: config.fbAppID, secret: config.fbAppSecret });

/* POST to trigger mosaic rendering */
router.post('/mosaic', function (req, res, next) {
  getLikes(req.body.fbid);
  res.send('Mosaic making with theme ' + req.body.theme + ' started for ID ' + req.body.fbid);
});

/* Begin mosaic making methods */

var getLikes = function (id) {
  facebook.api('/' + id + '/likes?limit=100', function (err, data) {
    if (err) throw err;
    extractLikes(data, function (err, likes) {
      if (err) throw err;
      console.log(likes);
    });
  });
};

var extractLikes = function (likes, callback) {
  var ret = likes.data || [];
  if (likes.paging.cursors.after) { // recursive case
    facebook.api('/' + id + '/likes?limit=100&after=' + likes.paging.cursors.after, function (err, data) {
      if (err) callback(err, null);
      extractLikes(data, function (err, more) {
        if (err) callback(err, null);
        callback(null, ret.concat(more));
      });
    });
  } else { // base case
    callback(null, ret);
  }
};
