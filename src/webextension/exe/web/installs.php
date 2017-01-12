<?php
	// globals
	date_default_timezone_set('America/Los_Angeles');

	// imports
	include 'assets/php/my/common.php';

	// connect to database
	require('assets/php/my/mysql_db.php');
	$mysql_host = 'localhost';
	$mysql_database = 'sundaysc_trigger';
	$mysql_user = 'sundaysc_php';
	$mysql_password = 'Bismillah&';
	$DB = new mysql_db();
	$connectid = $DB->sql_connect($mysql_host, $mysql_user, $mysql_password, $mysql_database);



	http_response_code(200);
	header('Content-Type: application/json');
	// header('Content-Type: text/html;charset=utf-8');

	$ojson = array();

	switch ($_GET['act']) {
		case 'increment':
				$ip = $_SERVER['REMOTE_ADDR'];
				$filename = $_GET['filename'];

				// validation
				if (is_null($filename)) {
					$ojson['error'] = '`filename` not provided';
					// http_response_code(406); // invalid data
					break;
				}
				if (strlen($filename) != 8) {
					$ojson['error'] = 'Incorrect `filename`';
					// http_response_code(406); // invalid data
					break;
				}

				// insert it
				$query1 = $DB->query('INSERT INTO installs (filename, ip, time) VALUES ("'. $filename .'", "'. $ip .'", "'. date("Y-m-d H:i:s") .'")');
				if (isQueryOk($query1)) {
					// $id = $DB->get_inserted_id();
					$ojson['ok'] = true;
				} else {
					$ojson['error'] = 'Something went wrong when trying to increment';
					$ojson['mysql_error'] = mysql_error();
				}

			break;
		case 'getcount':
				$where1 = $_GET['filename'] ? ' WHERE filename="'. $_GET['filename'] .'"' : '';
				// $ojson['$where1'] = $where1;
				$query1 = $DB->query('SELECT filename FROM installs' . $where1);

				// $ojson['$DB->get_num_rows()'] = $DB->get_num_rows();

				while ($row = mysql_fetch_assoc($query1)) {
					$filename = $row['filename'];
					if (array_key_exists($filename, $ojson)) {
						$ojson[$filename]++;
					} else {
						$ojson[$filename] = 1;
					}
				}
			break;
		default:
			$ojson['error']	= 'Invalid action `act`';
			// http_response_code(405); // method not allowed
	}

	// always return 200 status code, so ill know if i get 200, then it is JSON.parse'able

	print json_encode($ojson);

	exit();
?>
