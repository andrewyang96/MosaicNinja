var express = require('express');
var router = express.Router();

var config = require('../config');
var request = require('request');
var Facebook = require('facebook-node-sdk');
var facebook = new Facebook({ appID: config.fbAppID, secret: config.fbAppSecret });

var kdt = require('kdt');
var base64 = require('node-base64-image');
var async = require('async');
var _ = require('underscore');

/* POST to trigger mosaic rendering */
router.post('/mosaic', function (req, res, next) {
  getLikes(req.body.fbid, function (err, likes) {
    if (err) throw err;
    downloadPictures(likes, function (err, imageData) {
      if (err) throw err;
      console.log(imageData);
      // download profile picture
      downloadProfilePicture(req.body.fbid, function (err, propicImage) {
        if (err) throw err;
        console.log(propicImage);
        res.send('Mosaic making with theme ' + req.body.theme + ' started for ID ' + req.body.fbid);
      });
    });
  });
});

/* Begin mosaic making methods */

var getLikes = function (id, callback) {
  facebook.api('/' + id + '/likes?limit=100', function (err, data) {
    if (err) throw err;
    extractLikes(data, function (err, likes) {
      if (err) throw err;
      callback(null, likes);
    });
  });
};

var extractLikes = function (likes, callback) {
  // Helper function
  var likesObj = likes.data || [];
  var ret = [];
  for (var i = 0; i < likesObj.length; i++) {
    ret.push(likesObj[i].id);
  }
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

var downloadPictures = function (likes, callback) {
  // likes - array of ids
  // returns map of id keys and base 64 object values
  async.map(likes, function (like) {
    facebook.api('/' + like.id + '/picture?width=50&height=50', function (err, likeObj) {
      if (err) throw err;
      // encode image to base64
      base64.base64encode(likeObj.data.url, { string: true }, function (err, saved) {
        if (err) throw err;
        return saved;
      });
    });
  }, function (err, results) {
    if (err) callback(err, null);
    // zip the likes and results arrays
    var retObj = _.object(likes, results);
    callback(null, results);
  });
};

var downloadProfilePicture = function (id, callback) {
  facebook.api('/' + req.body.fbid + '/picture?width=9999&height=9999', function (err, propicData) {
    if (err) callback(err, null);
    base64.base64encode(propicData.data.url, { string: true}, function (err, saved) {
      if (err) callback(err, null);
      callback(null, saved);
    });
  });
};

 module.exports = router;
