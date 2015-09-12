
  

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
      $("#mosaicgenerator").show();
      $(".progress").hide();
	  $('.message').hide();
      $(".message").text($(this).text()+" is being generated!");
   });
	$("#mosaicgenerator").click(function(){
		$(".progress").show();
		$('.message').show();
		$("#mosaicgenerator").hide();
		$(".btn-group").hide();
	});
  
  $('#mosaicgenerator').hide();
  $('.progress').hide();
  $('.message').hide();

});

