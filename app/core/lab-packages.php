<?php

function clinic_lab_packages($pdo, $publishedOnly = false)
{
    $sql = 'SELECT p.id, p.name, p.description, p.price, p.status, p.display_order,
                   t.id AS test_id, t.name AS test_name, t.status AS test_status
            FROM lab_packages p
            LEFT JOIN lab_package_tests pt ON pt.package_id = p.id
            LEFT JOIN test_definitions t ON t.id = pt.test_id
            ' . ($publishedOnly ? "WHERE p.status = 'Published' " : '') . '
            ORDER BY p.display_order, p.id, t.name';
    $packages = [];
    foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int) $row['id'];
        if (!isset($packages[$id])) {
            $packages[$id] = [
                'id' => $id, 'name' => $row['name'], 'description' => $row['description'],
                'price' => (float) $row['price'], 'status' => $row['status'],
                'displayOrder' => (int) $row['display_order'], 'tests' => [],
            ];
        }
        if ($row['test_id'] !== null) $packages[$id]['tests'][] = [
            'id' => (int) $row['test_id'], 'name' => $row['test_name'], 'status' => $row['test_status'],
        ];
    }
    return array_values($packages);
}

function clinic_save_lab_package($pdo, $input, $actor = null)
{
    $id = filter_var($input['id'] ?? '0', FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
    $name = trim((string) ($input['name'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $price = trim((string) ($input['price'] ?? ''));
    $status = (string) ($input['status'] ?? 'Draft');
    $order = filter_var($input['display_order'] ?? '0', FILTER_VALIDATE_INT);
    $testIds = array_values(array_unique(array_map('intval', (array) ($input['test_ids'] ?? []))));
    if ($id === false || $name === '' || strlen($name) > 160) throw new InvalidArgumentException('Enter a package name up to 160 characters.');
    if (strlen($description) > 1500) throw new InvalidArgumentException('Keep the description under 1,500 characters.');
    if (!preg_match('/^\d+(?:\.\d{1,2})?$/', $price) || (float) $price > 99999999.99) throw new InvalidArgumentException('Enter a valid non-negative price.');
    if (!in_array($status, ['Draft', 'Published'], true)) throw new InvalidArgumentException('Select a valid visibility.');
    if ($order === false || $order < 0 || $order > 9999) throw new InvalidArgumentException('Display order must be between 0 and 9999.');
    if (!$testIds || count($testIds) > 30 || in_array(0, $testIds, true)) throw new InvalidArgumentException('Select 1 to 30 laboratory tests.');
    $marks = implode(',', array_fill(0, count($testIds), '?'));
    $check = $pdo->prepare("SELECT id FROM test_definitions WHERE id IN ($marks) AND status='Active'");
    $check->execute($testIds);
    if (count($check->fetchAll(PDO::FETCH_COLUMN)) !== count($testIds)) throw new InvalidArgumentException('Select only active laboratory tests.');
    $pdo->beginTransaction();
    try {
        if ($id) {
            $check = $pdo->prepare('SELECT id FROM lab_packages WHERE id=?');
            $check->execute([$id]);
            if (!$check->fetchColumn()) throw new InvalidArgumentException('Package not found.');
            $stmt = $pdo->prepare('UPDATE lab_packages SET name=?, description=?, price=?, status=?, display_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
            $stmt->execute([$name, $description, $price, $status, $order, $id]);
            $pdo->prepare('DELETE FROM lab_package_tests WHERE package_id=?')->execute([$id]);
        } else {
            $id = db_insert_id($pdo, 'INSERT INTO lab_packages (name, description, price, status, display_order) VALUES (?,?,?,?,?)', [$name, $description, $price, $status, $order]);
        }
        $stmt = $pdo->prepare('INSERT INTO lab_package_tests (package_id, test_id) VALUES (?,?)');
        foreach ($testIds as $testId) $stmt->execute([$id, $testId]);
        if ($actor) {
            $stmt = $pdo->prepare('INSERT INTO audit_logs (user_id, user_name, role_name, action, module, details, ip_address) VALUES (?,?,?,?,?,?,?)');
            $stmt->execute([(int) $actor['id'], $actor['name'], 'Admin', !empty($input['id']) ? 'UPDATE' : 'CREATE', 'Laboratory Package', substr('Saved package ' . $name, 0, 255), $_SERVER['REMOTE_ADDR'] ?? null]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
    return $id;
}
