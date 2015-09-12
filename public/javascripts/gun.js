var Gun = require('gun');
var gun = Gun('https://gunjs.herokuapp.com/gun');
gun.put({hello: "world"}).key('random/kUIkBxGFI');

var ref = gun.get('random/kUIkBxGFI');
ref.on(function(data){
  $('body').text(JSON.stringify(data));
});