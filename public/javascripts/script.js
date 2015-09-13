
  

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
  	$('.progress').hide();
  	$('.message').hide();
  	$('.drop').hide();
	
	$(".dropdown-menu li a").click(function(){
		$("#mosaicgenerator").show();
      $(".default").text($(this).text());
   
      
      $(".progress").hide();
	  $('.message').hide();
      $(".message").text($(this).text()+" is being generated!");
   });
	$("#mosaicgenerator").click(function(){
		$('#about').hide();
		$(".progress").show();
		$('.message').show();
		$("#mosaicgenerator").hide();
		$(".drop").hide();
	});
  
  

});

