
  

$('#mosaicgenerator').click(function(){
	$.ajax({
		url: '/mosaic',
		type: 'POST',
		dataType: 'json',
		data: {fbid: authData.userID, theme: 'like'},
		success: function(data){
			console.log(data);
		}

	})
});

$(document).ready(function(){
	
  
  $('#mosaicgenerator').hide();

});

