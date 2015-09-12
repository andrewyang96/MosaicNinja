var express = require('express');
var router = express.Router();

var config = require('../config');
var request = require('request');
var Facebook = require('facebook-node-sdk');
var facebook = new Facebook({ appId: config.fbAppID, secret: config.fbAppSecret });

var kdt = require('kdt');
var base64 = require('node-base64-image');
var request = require('request');
var async = require('async');
var _ = require('underscore');

/* POST to trigger mosaic rendering */
router.post('/', function (req, res, next) {
  res.send({ "socket": "/mosaic/" + req.body.fbid });
  getLikes(req.body.fbid, function (err, likes) {
    if (err) throw err;
    downloadPictures(likes, function (err, imageData) {
      if (err) throw err;
      console.log("Length of imageData:", Object.keys(imageData).length);
      // console.log(imageData);
      // download profile picture
      downloadProfilePicture(req.body.fbid, function (err, propicImage) {
        if (err) throw err;
        // console.log(propicImage);
        console.log("Done!");
      });
    });
  });
});

/* Begin mosaic making methods */

var getLikes = function (id, callback) {
  facebook.api('/' + id + '/likes?limit=100', function (err, data) {
    if (err) {
      callback(err, null);
      return;
    }
    console.log("Calling first 100");
    extractLikes(data, id, function (err, likes) {
      if (err) {
        callback(err, null);
        return;
      }
      callback(null, likes);
    });
  });
};

var extractLikes = function (likes, id, callback) {
  // Helper function
  var likesObj = likes.data || [];
  var ret = [];
  for (var i = 0; i < likesObj.length; i++) {
    ret.push(likesObj[i].id);
  }
  if (likes.paging && likes.paging.cursors && likes.paging.cursors.after) { // recursive case
    console.log("Calling next 100");
    facebook.api('/' + id + '/likes?limit=100&after=' + likes.paging.cursors.after, function (err, data) {
      if (err) {
        callback(err, null);
        return;
      }
      extractLikes(data, id, function (err, more) {
        if (err) {
          callback(err, null);
          return;
        }
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
  console.log("Num likes:", likes.length);
  var ret = {};
  async.each(likes, function (like, cb) {
    facebook.api('/' + like + '/picture?redirect=false&width=50&height=50', function (err, likeObj) {
      if (err) {
        cb(err, null);
        return;
      }
      // encode image to base64
      encodeBase64(likeObj.data.url, function (err, image) {
        if (err) {
          cb(err, null);
          return;
        }
        if (image) { // image could be null
          ret[like] = image;
        }
        cb();
      });
    });
  }, function (err) {
    if (err) {
      callback(err, null);
      return;
    }
    console.log("Returning thumbnails");
    callback(null, ret);
  });
};

var downloadProfilePicture = function (id, callback) {
  facebook.api('/' + id + '/picture?redirect=false&width=9999&height=9999', function (err, propicData) {
    if (err) {
      console.log("Error!");
      callback(err, null);
      return;
    }
    encodeBase64(propicData.data.url, function (err, image) {
      if (err) {
        callback(err, null);
        return;
      }
      if (image) {
        console.log("Big propic");
        callback(null, image);
      } else {
        callback("image is null", null);
      }
    });
  });
};

var encodeBase64 = function (url, callback) {
  request({url: url, encoding: null}, function (err, res, body) {
    if (err) {
      callback(err, null);
      return;
    }
    if (body && res.statusCode === 200) {
      var image = body.toString('base64');
      callback(null, image);
    } else {
      callback(null, null);
    }
  });
};

 module.exports = router;
