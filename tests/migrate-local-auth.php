<?php
require_once __DIR__ . '/../app/config/database.php';
if (DB_DRIVER !== 'mysql' || !in_array(DB_HOST, ['127.0.0.1', 'localhost'], true)) {
    throw new RuntimeException('This helper only runs against local MariaDB.');
}
$sql = file_get_contents(__DIR__ . '/../database/authentication_migration.mysql.sql');
$sql = preg_replace('/^--.*$/m', '', $sql);
foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) db()->exec($statement);
echo "Local authentication migration applied.\n";
