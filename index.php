<?php
	http_response_code(200);
	header('Content-Type: application/json');
	// header('Content-Type: text/html;charset=utf-8');

	$ojson = array();

	$ojson['location'] = array(
		lat => $_GET['lat'],
		lng => $_GET['lng']
	);
	$ojson['accuracy'] = 4000;

	print json_encode($ojson);

	exit();
?>
