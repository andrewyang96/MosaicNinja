
  

$('#mosaicform').submit(function(event){
	event.preventDefault();
	var selected = $("select#choice").val();
	var destinations = [];
	var checkbox = $('.checkbox input:checked').each(function(){
		destinations.push(this.value);		
	});
	for(var i =0; i<destinations.length; i++){
		console.log(destinations[i]);
	}
	if((destinations.length>4 || destinations.length<2 )&& selected === "travel"){
		console.log('error');
		$('.error').replaceWith("<p>You need to select at least two and less than five</p>");
	}else{
		
		$('.checkbox input:checked').removeAttr('checked');
    console.log("Destinations:", destinations);
		$.ajax({
  		url: '/mosaic',
  		type: 'POST',
  		dataType: 'json',
  		data: {fbid: authData.userID, theme: selected, cities: destinations},
  		success: function(data){
  			console.log(data);
  			$('.success').show();
  			$('#about').hide();
  			$(".progress").show();
  			$('.message').show();
  			$("#mosaicgenerator").hide();
  			$(".drop").hide();
  		}

		});
	}
	
	

	
});


$(document).ready(function(){
	$('.success').hide();
	$('#new_canvas').hide();
	$("select#choice").val("like");
	$('.checkbox').hide();
	$('.animation').hide();
	$('#mosaicgenerator').hide();
  $('.progress').hide();
  $('.message').hide();
  $('.drop').hide();

  $("#choice").change(function () {
    if ($("#choice").val() === "travel") {
      $(".checkbox").show();
    } else {
      $(".checkbox").hide();
    }
  });

	$("#choice").click(function(){
		$("#mosaicgenerator").show();
  });
	$("#mosaicgenerator").click(function(){

		
	});

});

