<?php
    class mysql_db{
        //+======================================================+
        function sql_connect($sqlserver, $sqluser, $sqlpassword, $database){
            $this->connect_id = mysql_connect($sqlserver, $sqluser, $sqlpassword);
            if($this->connect_id){
                if (mysql_select_db($database)){
                    return $this->connect_id;
                }else{
                    return $this->error();
                }
            }else{
                return $this->error();
            }
        }
        //+======================================================+
        function error(){
            if(mysql_error() != ''){
                return 'DATABASE_ERROR: ' . mysql_error();
            }
        }
        //+======================================================+
        function query($query){
            if ($query != NULL){
                $this->query_result = mysql_query($query, $this->connect_id);
                if(!$this->query_result){
                    return $this->error();
                }else{
                    return $this->query_result;
                }
            }else{
                return '<b>MySQL Error</b>: Empty Query!';
            }
        }
        //+======================================================+
        function get_num_rows($query_result=NULL){
			// This command is only valid for statements like SELECT or SHOW that return an actual result set. To retrieve the number of rows affected by a INSERT, UPDATE, REPLACE or DELETE query, use mysql_affected_rows().
            if($query_result == NULL){
                $return = mysql_num_rows($this->query_result); //mysqli_stmt_num_rows
            }else{
                $return = mysql_num_rows($query_result); //mysql_num_rows
            }
            if($return === false){
                return $this->error();
            }else{
                return $return;
            }
        }
        //+======================================================+
        function get_affected_rows($link_identifier=NULL){
			// Get the number of affected rows by the last INSERT, UPDATE, REPLACE or DELETE query associated with link_identifier.
            if($query_result == NULL){
                $return = mysql_affected_rows($this->connect_id); //mysqli_stmt_num_rows
            }else{
                $return = mysql_affected_rows($link_identifier); //mysql_num_rows
            }
            if($return == -1){
                return $this->error();
            }else{
                return $return;
            }
        }
        //+======================================================+
        function fetch_row($query_id = ""){
            if($query_id == NULL){
                $return = mysql_fetch_array($this->query_result);
            }else{
                $return = mysql_fetch_array($query_id);
            }
            if(!$return){
                return $this->error();
            }else{
                return $return;
            }
        }
        //+======================================================+
        //+======================================================+
        function get_inserted_id(){
            $return = mysql_insert_id();
            if($return===false){
                return $this->error();
            }else{
                return $return;
            }
        }
        //+======================================================+
        function sql_close(){
            if($this->connect_id){
                return mysql_close($this->connect_id);
            }
        }
        //+======================================================+
    }

?>
