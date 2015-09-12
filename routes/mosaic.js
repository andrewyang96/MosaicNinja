var express = require('express');
var router = express.Router();

var config = require('../config');
var request = require('request');
var Facebook = require('facebook-node-sdk');
var facebook = new Facebook({ appId: config.fbAppID, secret: config.fbAppSecret });

var Firebase = require('firebase');
var ref = new Firebase("https://facebookmosaic.firebaseio.com/");
ref.authWithCustomToken(config.firebaseSecret, function (error, authData) {
  if (error) {
    console.log("Firebase secret auth failed!");
    throw error;
  }
});
var mosaicsRef = ref.child("mosaics");

var kdt = require('kdt');
var request = require('request');
var async = require('async');
var _ = require('underscore');
var pixelGetter = require('pixel-getter');

/* POST to trigger mosaic rendering */
router.post('/', function (req, res, next) {
  res.send({ "socket": "/mosaic/" + req.body.fbid });
  getLikes(req.body.fbid, function (err, likes) {
    if (err) throw err;
    downloadPictures(likes, function (err, imageData) {
      if (err) throw err;
      // Adding to KD-tree
      var coords = []
      _.each(imageData, function (value, key) {
        var point = getAverageColor(value.pixels);
        point.b64 = value.base64;
        point.name = key;
        coords.push(point);
      });
      var distance = function (a, b) {
        
        return Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2);
      };
      var tree = kdt.createKdTree(coords, distance, ["r", "g", "b"]);
      // download profile picture
      downloadProfilePicture(req.body.fbid, function (err, propicImage) {
        if (err) throw err;
        pixelGetter.get(new Buffer(propicImage, 'base64'), function (err, pixels) {
          if (err) throw err;
          var mosaic = splitProfilePicture(pixels); // optional resolution param
          var nearests = returnNearests(tree, mosaic);
          mosaicsRef.child(req.body.fbid).set(nearests, function (error) {
            if (error) {
              console.log("Error storing mosaic for user", req.body.fbid);
            } else {
              console.log("Done!");
              // TODO notify frontend to fetch mosaic data
            }
          });
        });
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
          pixelGetter.get(new Buffer(image, 'base64'), function (err, pixels) {
            if (err) {
              cb(err, null);
              return;
            }
            ret[like] = {
              base64: image,
              pixels: pixels
            };
            console.log("Added image info for", like);
            cb();
          });
        } else {
          cb();
        }
      });
    });
  }, function (err) {
    if (err) {
      callback(err, null);
      return;
    }
    callback(null, ret);
  });
};

var downloadProfilePicture = function (id, callback) {
  facebook.api('/' + id + '/picture?redirect=false&width=9999&height=9999', function (err, propicData) {
    if (err) {
      callback(err, null);
      return;
    }
    encodeBase64(propicData.data.url, function (err, image) {
      if (err) {
        callback(err, null);
        return;
      }
      if (image) {
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

var getAverageColor = function (pixels) {
  var numPixels = pixels[0].length;
  var r = 0;
  var g = 0;
  var b = 0;
  for (var i = 0; i < numPixels; i++) {
    var pixel = pixels[0][i];
    r += pixel.r;
    g += pixel.g;
    b += pixel.b;
  }
  r /= numPixels;
  g /= numPixels;
  b /= numPixels;
  return { r: r, g: g, b: b };
};

var getAverageColorOfRegion = function (pixels, xBounds, yBounds) {
  var numPixels = (xBounds[1] - xBounds[0]) * (yBounds[1] - yBounds[0]);
  var r = 0;
  var g = 0;
  var b = 0;
  for (var x = xBounds[0]; x < xBounds[1]; x++) {
    for (var y = yBounds[0]; y < yBounds[1]; y++) {
      var pixel = pixels[0][y * 768 + x];
      if (pixel) {
        r += pixel.r;
        g += pixel.g;
        b += pixel.b;
      } else {
        console.log("Warning: Pixel at x =", x, " y =", y, "is undefined");
      }
    }
  }
  r /= numPixels;
  g /= numPixels;
  b /= numPixels;
  return { r: r, g: g, b: b };
};

var splitProfilePicture = function (pixels, resolution) {
  // pixels - pixelGetter.get
  // resolution - int (defaults to 24)
  // Assume 768x768, divisible by 24, 32, 48, 64
  // returns a 2d array
  if (!resolution) resolution = 24;
  var interval = 768 / resolution;
  var ret = [];
  for (var y = 0; y < resolution; y++) {
    var row = [];
    for (var x = 0; x < resolution; x++) {
      console.log("Calculating x =", x, "and y =", y);
      var xBounds = [Math.floor(x * interval), Math.floor((x+1) * interval)];
      var yBounds = [Math.floor(y * interval), Math.floor((y+1) * interval)];
      row.push(getAverageColorOfRegion(pixels, xBounds, yBounds));
    }
    ret.push(row);
  }
  return ret;
};

var returnNearests = function (tree, mosaic) {
  // tree - kdtree
  // mosaic - 2d array from splitProfilePicture
  var ret = []
  for (var row = 0; row < mosaic.length; row++) {
    var rowRet = [];
    for (var col = 0; col < mosaic[row].length; col++) {
      console.log("Calcing nearest of row", row, "and col", col);
      var nearest = tree.nearest(mosaic[row][col], 1);
      rowRet.push(nearest[0][0]);
    }
    ret.push(rowRet);
  }
  return ret;
};

 module.exports = router;
