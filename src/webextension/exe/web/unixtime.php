<?php
	// globals
	date_default_timezone_set('America/Los_Angeles');

	// imports

	// connect to database

	http_response_code(200);
	header('Content-Type: application/json');
	// header('Content-Type: text/html;charset=utf-8');

	$ojson = array('unixtime'=>time());

	print json_encode($ojson);

	exit();
?>
