var express = require('express');
var router = express.Router();

// config
var config = {};
if (process.env.FB_APP_ID) {
  // production
  config.fbAppID = process.env.FB_APP_ID;
  config.fbAppSecret = process.env.FB_APP_SECRET;
  config.firebaseSecret = process.env.FIREBASE_SECRET;
  config.expediaKey = process.env.EXPEDIA_KEY;
} else {
  // development
  config = require('../config');
}


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
var Jimp = require('jimp');

var distance = function (a, b) {
  // For kdtree
  return Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2);
};

/* POST to trigger mosaic rendering */
router.post('/', function (req, res, next) {
  res.send({ "socket": "/mosaic/" + req.body.fbid });
  if (req.body.theme === "like") {
    // Facebook
    console.log("Making Facebook mosaic");
    getLikes(req.body.fbid, function (err, likes) {
      if (err) throw err;
      downloadPictures(likes, function (err, imageData) {
        if (err) throw err;
        // Adding to KD-tree
        var coords = [];
        _.each(imageData, function (value, key) {
          var point = getAverageColor(value.pixels);
          point.b64 = value.base64;
          point.name = key;
          coords.push(point);
        });
        var tree = kdt.createKdTree(coords, distance, ["r", "g", "b"]);
        // download profile picture
        downloadProfilePicture(req.body.fbid, function (err, propicImage, size) {
          if (err) throw err;
          pixelGetter.get(new Buffer(propicImage, 'base64'), function (err, pixels) {
            if (err) throw err;
            var mosaic = splitProfilePicture(pixels, size);
            var nearests = returnNearests(tree, mosaic);
            nearests.lastUpdated = Firebase.ServerValue.TIMESTAMP; // guarantee trigger child_changed
            mosaicsRef.child(req.body.fbid).set(nearests, function (error) {
              if (error) {
                console.log("Error storing mosaic for user", req.body.fbid);
              } else {
                console.log("Done!");
                // Now notify frontend to fetch mosaic data
              }
            });
          });
        });
      });
    });
  } else if (req.body.theme === "travel") {
    // Expedia
    console.log("Making Expedia mosaic");
    getCities(req.body["cities[]"], function (err, images) {
      if (err) throw err;
      downloadCities(images, function (err, citiesImages) {
        if (err) throw err;
        // construct KD-tree
        var coords = [];
        console.log(citiesImages);
        for (var i = 0; i < citiesImages.length; i++) {
          var point = citiesImages[i];
          point.r = point.avgColor.r;
          point.g = point.avgColor.g;
          point.b = point.avgColor.b;
          delete point.avgColor;
          coords.push(point);
        }
        console.log("Coords");
        console.log(coords);
        var tree = kdt.createKdTree(coords, distance, ["r", "g", "b"]);
        // download profile picture
        downloadProfilePicture(req.body.fbid, function (err, propicImage, size) {
          if (err) throw err;
          pixelGetter.get(new Buffer(propicImage, 'base64'), function (err, pixels) {
            if (err) throw err;
            var mosaic = splitProfilePicture(pixels, size);
            var nearests = returnNearests(tree, mosaic);
            nearests.lastUpdated = Firebase.ServerValue.TIMESTAMP;
            mosaicsRef.child(req.body.fbid).set(nearests, function (error) {
              if (error) {
                console.log("Error storing mosaic for user", req.body.fbid);
              } else {
                console.log("Done!");
                // Now notify frontend to fetch mosaic data
              }
            });
          });
        });
      });
    });
  } else {
    // Do nothing
    console.log("Invalid theme");
  }
});

/* Begin Facebook mosaic making methods */

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
        callback(err, null, null);
        return;
      }
      if (image) {
        callback(null, image, propicData.data.width);
      } else {
        callback("image is null", null, null);
      }
    });
  });
};

/* Begin Expedia mosaic methods */

var getCityPhotos = function (city, callback) {
  // Pull image URLs from Expedia's Activities API
  request({
    url: "http://terminal2.expedia.com/x/activities/search?location=" + city + "&apikey=" + config.expediaKey,
    headers: {
      'User-Agent': 'request'
    }
  }, function (err, res, body) {
    if (err) throw err;
    console.log("Got response for photos from", city);
    if (body && res.statusCode === 200) {
      var j = JSON.parse(body);
      var ret = [];
      for (var i = 0; i < j.activities.length; i++) {
        console.log("Pushing item", i, "for city", city);
        ret.push(j.activities[i].imageUrl);
      }
      callback(null, ret);
    } else {
      console.log("Error getting", city);
      callback(null, null);
    }
  });
};

var getCities = function (cities, callback) {
  // cities - array of 2 to 5 cities
  var ret = {};
  async.each(cities, function (city, cb) {
    getCityPhotos(city, function (err, images) {
      if (err) {
        cb(err, null);
        return;
      }
      ret[city] = images;
      cb();
    });
  }, function (err) {
    if (err) {
      callback(err, null);
      return;
    }
    callback(null, ret);
  });
};

var downloadCities = function (cities, callback) {
  // cities - object with city key and array of images URL value
  // returns list of RGB avgs and base64s
  // first flatten array
  var inputImages = [];
  _.each(cities, function (value, key) {
    inputImages = inputImages.concat(value);
  });
  var ret = [];
  async.each(inputImages, function (url, cb) {
    console.log("Finding image at URL", url);
    cropPicture("http:" + url, function (err, buf, b64) {
      if (err) {
        cb(err, null);
        return;
      }
      pixelGetter.get(buf, function (err, pixels) {
        if (err) {
          cb(err, null);
          return;
        }
        var avgColor = getAverageColor(pixels);
        console.log("Pushing city image:", url);
        ret.push({
          avgColor: pixels,
          b64: b64
        });
        cb();
      });
    });
  }, function (err) {
    if (err) {
      console.log("Error in downloadCities");
      callback(err, null);
      return;
    }
    console.log("Downloaded city images!");
    callback(null, ret);
  });
};

var cropPicture = function (url, callback) {
  // crop pictures from 350x197
  // returns buffer and base64
  console.log(url);
  encodeBase64(url, function (err, image) {
    if (err) {
      callback(err, null);
      return;
    }
    if (!image) {
      callback("Image not found", null);
      return;
    }
    var buf = new Buffer(image, 'base64');
    var image = new Jimp(buf, function (err, image) {
      if (err) {
        console.log("Error in cropping");
        callback(err, null);
        return;
      }
      // crop then resize down to 50x50
      image.crop(76, 0, 197, 197).resize(50, 50);
      image.getBuffer(Jimp.MIME_JPEG, function (err, buffer) {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, buffer, image);
      });
    });
  });
};

/* Begin general mosaic methods */

var encodeBase64 = function (url, callback) {
  request({
    url: url,
    encoding: null,
    headers: {
      'User-Agent': 'request'
    }
  }, function (err, res, body) {
    if (err) {
      callback(err, null);
      return;
    }
    if (body && res.statusCode === 200) {
      var image = body.toString('base64');
      callback(null, image);
    } else {
      console.log("Request error:", res.statusCode);
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

var getAverageColorOfRegion = function (pixels, width, xBounds, yBounds) {
  var numPixels = (xBounds[1] - xBounds[0]) * (yBounds[1] - yBounds[0]);
  var r = 0;
  var g = 0;
  var b = 0;
  for (var x = xBounds[0]; x < xBounds[1]; x++) {
    for (var y = yBounds[0]; y < yBounds[1]; y++) {
      var pixel = pixels[0][x * width + y];
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

var splitProfilePicture = function (pixels, size, resolution) {
  // pixels - pixelGetter.get
  // resolution - int (defaults to 50)
  // DO NOT ASSUME SIZE!!!
  // returns a 2d array
  if (!resolution) resolution = 50;
  var interval = size / resolution;
  var ret = [];
  for (var ro = 0; ro < resolution; ro++) {
    var row = [];
    console.log("Calculating row =", ro);
    for (var c = 0; c < resolution; c++) {
      var xBounds = [Math.floor(c * interval), Math.floor((c+1) * interval)];
      var yBounds = [Math.floor(ro * interval), Math.floor((ro+1) * interval)];
      row.push(getAverageColorOfRegion(pixels, size, xBounds, yBounds));
    }
    ret.push(row);
  }
  console.log("Size is square px:", size);
  return ret;
};

var returnNearests = function (tree, mosaic) {
  // tree - kdtree
  // mosaic - 2d array from splitProfilePicture
  var ret = []
  for (var row = 0; row < mosaic.length; row++) {
    var rowRet = [];
    console.log("Calcing nearest for row", row)
    for (var col = 0; col < mosaic[row].length; col++) {
      var nearest = tree.nearest(mosaic[row][col], 1);
      rowRet.push(nearest[0][0]);
    }
    ret.push(rowRet);
  }
  return ret;
};

 module.exports = router;
