
  

$('#mosaicform').submit(function(event){
	event.preventDefault();
	$.ajax({
		url: '/mosaic',
		type: 'POST',
		dataType: 'json',
		data: {fbid: authData.userID, theme: 'like'},
		success: function(data){
			console.log(data);
			$('.animation').show()
			$('#about').hide();
			$(".progress").show();
			$('.message').show();
			$("#mosaicgenerator").hide();
			$(".drop").hide();
		}

	})
});


$(document).ready(function(){
	$("select#choice").val("like");
	$('.checkbox').hide();
	$('.animation').hide();
	$('#mosaicgenerator').hide();
  	$('.progress').hide();
  	$('.message').hide();
  	$('.drop').hide();
	console.log($("select#choice").val());
	$("#like").click(function(){
		$(".checkbox").hide();
	});
	$("#travel").click(function(){
		$(".checkbox").show();
	});
	$("#choice").click(function(){
		$("#mosaicgenerator").show();
      
   
      
      $(".progress").hide();
	  $('.message').hide();
      $(".message").text($(this).text()+" is being generated!");
   });
	$("#mosaicgenerator").click(function(){
		
	});
  
  

});

