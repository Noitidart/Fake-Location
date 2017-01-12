<?php
	function str_replace_first($haystack, $needle, $replace) {
		$pos = strpos($haystack, $needle);
		if ($pos !== false) {
			$newstring = substr_replace($haystack, $replace, $pos, strlen($needle));
		}
		return $newstring;
	}
	function isQueryOk($query_result) {
		// for use with assets/php/my/mysql_db.php
		if (is_string($query_result) && substr($query_result, 0, strlen('DATABASE_ERROR: ')) === 'DATABASE_ERROR: ') {
			return false;
		} else {
			return true;
		}
	}
?>