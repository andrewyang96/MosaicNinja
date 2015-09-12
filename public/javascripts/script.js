
  

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
	$(".dropdown-menu li a").click(function(){

      $(".btn:first-child").text($(this).text());
      $(".btn:first-child").val($(this).text());

   });
  
  $('#mosaicgenerator').hide();

});

