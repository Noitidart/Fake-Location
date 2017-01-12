<?php
	// globals
	date_default_timezone_set('America/Los_Angeles');

	// imports

	// connect to database

	http_response_code(200);
	header('Content-Type: application/json');
	// header('Content-Type: text/html;charset=utf-8');

  $to = $_GET['to'];
  $subject = $_GET['s'];
  $body = $_GET['msg'];

  if (is_null($to)) {
		$ojson['error'] = '`to` not provided';
		print json_encode($ojson); exit();
	}
  if (is_null($subject)) {
		$ojson['error'] = 'Subject `s` not provided';
		print json_encode($ojson); exit();
	}
  if (is_null($body)) {
		$ojson['error'] = 'Body `msg` not provided';
		print json_encode($ojson); exit();
	}

  $headers = "From: Trigger-Mailer@trigger-community.org";
  $headers .= "\r\nReply-To: noitidart@gmail.com";
  // $headers .= "\r\nBcc:yasir.ali@email.ucr.edu";

  mail($to, $subject, $body, $headers);

	$ojson = array('ok'=>true);

	print json_encode($ojson);

	exit();
?>
