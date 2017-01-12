<?php
	// globals
	date_default_timezone_set('America/Los_Angeles');

	// imports

	// connect to database

	http_response_code(200);
	header('Content-Type: application/json');
	// header('Content-Type: text/html;charset=utf-8');

    // $hash = hash_hmac('sha1', '111', '563ee1a8f745e9b3b9bccc2f0994d8d6462e23da', true);
    // $hash = base64_encode($hash);
    // $key = "563ee1a8f745e9b3b9bccc2f0994d8d6462e23da";
    // $data = "111";
    // $my_sign = hash_hmac("sha1", $data, base64_decode(strtr($key, '-_', '+/')), true);
    // $hash = strtr(base64_encode($my_sign), '+/', '-_');

    // function salt() {
    // 	// salt generator from http://mxr.mozilla.org/mozilla-aurora/source/toolkit/profile/content/createProfileWizard.js?raw=1*/
    //
    // 	$mozKSaltTable = array(
    // 		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
    // 		'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    // 		'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
    // 	);
    //
    // 	$kSaltString = '';
    // 	for ($i = 0; $i < 8; ++$i) {
    // 		$kSaltString .= $mozKSaltTable[rand(0, count($mozKSaltTable))];
    // 	}
    // 	return $kSaltString;
    // 	// return kSaltString + '.' + aName;
    // }
    //
    // $hash = salt();
	// $ojson = array('ip'=>$_SERVER['REMOTE_ADDR'],'hash'=>$hash);

	$ojson = array('ip'=>$_SERVER['REMOTE_ADDR']);

	print json_encode($ojson);

	exit();
?>
