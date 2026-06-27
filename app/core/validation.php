<?php

function is_valid_username($username)
{
    return preg_match('/^[a-zA-Z0-9._-]{3,20}$/', (string) $username) === 1;
}

function is_valid_password($password)
{
    return preg_match('/^(?=.*[A-Za-z])(?=.*\d).{8,}$/', (string) $password) === 1;
}

