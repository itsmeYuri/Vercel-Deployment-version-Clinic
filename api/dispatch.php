<?php

function clinic_dispatch_action($defaultAction)
{
    if (empty($_GET['action']) && empty($_POST['action'])) {
        $_GET['action'] = $defaultAction;
    }

    require __DIR__ . '/index.php';
}

