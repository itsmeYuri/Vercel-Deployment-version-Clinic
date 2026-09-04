<?php
require_once __DIR__ . '/../../middleware/require-role.php';

$assetBase = $assetBase ?? clinic_asset_base('../assets');
$apiUrl = $apiUrl ?? '../../api/index.php';
$loginUrl = $loginUrl ?? '../auth/login.php#login';
$logoutUrl = $logoutUrl ?? '../auth/logout.php';
$maintenanceUrl = $maintenanceUrl ?? '../maintenance.php';
$initialPage = $initialPage ?? 'dashboard';
$roleUrls = $roleUrls ?? [
    'Admin' => '../admin/dashboard.php#dashboard',
    'Doctor' => '../doctor/dashboard.php#dashboard',
    'Laboratory Staff' => '../laboratory/dashboard.php#dashboard',
    'Patient' => '../patient/dashboard.php#dashboard',
];

function clinic_route_nav($items)
{
    return array_map(function ($item) {
        if (!empty($item['section'])) {
            return $item;
        }
        $item['href'] = $item['href'] ?? (($item['file'] ?? 'dashboard') . '.php');
        return $item;
    }, $items);
}

$simpleClinicSvg = '<svg viewBox="0 0 238 118" aria-hidden="true"><ellipse cx="119" cy="108" rx="103" ry="8" fill="#bce9e5"/><path d="M56 103V44l62-26 64 26v59" fill="#fff" stroke="#b9dedd" stroke-width="3"/><path d="M93 103V69h51v34" fill="#dff5f2"/><path d="M110 34h17v15h15v17h-15v15h-17V66H95V49h15V34Z" fill="#0aa397"/><path d="M25 103h188" stroke="#78c9c3" stroke-width="4" stroke-linecap="round"/></svg>';
$patientPrivacySvg = '<div class="privacy-illustration"><svg viewBox="0 0 210 82" aria-hidden="true"><path d="M42 73V35l45-20 46 20v38" fill="#fff" stroke="#9fd8d4" stroke-width="3"/><path d="M78 28h17v13h13v17H95v13H78V58H65V41h13V28Z" fill="#0aa397"/><path d="M25 73h125" stroke="#6fc5be" stroke-width="4" stroke-linecap="round"/><path d="M168 22s22 7 22 24c0 17-22 27-22 27s-22-10-22-27c0-17 22-24 22-24Z" fill="#fff" stroke="#29a99f" stroke-width="3"/><path d="m158 47 7 7 13-16" fill="none" stroke="#0aa397" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';

$configs = [
    'Admin' => [
        'title' => 'Admin Dashboard',
        'topbarLabel' => 'Administration',
        'brandSmall' => 'Admin workspace',
        'ariaLabel' => 'Main navigation',
        'workspaceLabel' => 'Workspace',
        'searchPlaceholder' => 'Search users, laboratory requests, results, facilities...',
        'notificationCount' => 7,
        'drawerId' => 'admin-drawer',
        'drawerEyebrow' => 'Centralized Laboratory Results System',
        'bodyClass' => 'admin-app',
        'avatarClass' => 'avatar-teal',
        'profilePage' => 'profile',
        'infoTitle' => 'Care works better together.',
        'infoText' => 'Secure clinic operations, all in one place.',
        'illustration' => $simpleClinicSvg,
        'nav' => clinic_route_nav([
            ['page' => 'dashboard', 'file' => 'dashboard', 'icon' => 'dashboard', 'label' => 'Dashboard'],
            ['page' => 'users', 'file' => 'users', 'icon' => 'users', 'label' => 'Users'],
            ['page' => 'facilities', 'file' => 'facilities', 'icon' => 'facility', 'label' => 'Facilities'],
            ['page' => 'tests', 'file' => 'tests', 'icon' => 'test', 'label' => 'Laboratory Tests'],
            ['page' => 'orders', 'file' => 'orders', 'icon' => 'orders', 'label' => 'Laboratory Requests'],
            ['page' => 'results', 'file' => 'results', 'icon' => 'results', 'label' => 'Results'],
            ['section' => 'Insights & controls'],
            ['page' => 'reports', 'file' => 'reports', 'icon' => 'chart', 'label' => 'Reports'],
            ['page' => 'audit', 'file' => 'audit', 'icon' => 'audit', 'label' => 'Audit Trail'],
            ['page' => 'maintenance', 'file' => 'maintenance', 'icon' => 'maintenance', 'label' => 'Maintenance Mode'],
        ]),
    ],
    'Doctor' => [
        'title' => 'Doctor Dashboard',
        'topbarLabel' => 'Doctor Portal',
        'brandSmall' => 'Doctor workspace',
        'ariaLabel' => 'Doctor navigation',
        'workspaceLabel' => 'Clinical workspace',
        'searchPlaceholder' => 'Search patients, laboratory requests, results, facilities...',
        'notificationCount' => 5,
        'drawerId' => 'doctor-drawer',
        'drawerEyebrow' => 'Doctor Workspace',
        'bodyClass' => 'admin-app doctor-app',
        'avatarClass' => 'avatar-teal',
        'profilePage' => 'profile',
        'infoTitle' => 'Care guided by clarity.',
        'infoText' => 'Patients, laboratory requests, and results in one place.',
        'illustration' => $simpleClinicSvg,
        'nav' => clinic_route_nav([
            ['page' => 'dashboard', 'file' => 'dashboard', 'icon' => 'dashboard', 'label' => 'Dashboard'],
            ['page' => 'patients', 'file' => 'patients', 'icon' => 'users', 'label' => 'Patients'],
            ['page' => 'facilities', 'file' => 'facilities', 'icon' => 'facility', 'label' => 'Facilities & Tests'],
            ['page' => 'create-order', 'file' => 'create-order', 'icon' => 'plus-file', 'label' => 'New Laboratory Request'],
            ['page' => 'orders', 'file' => 'orders', 'icon' => 'orders', 'label' => 'My Laboratory Requests', 'count' => 12],
            ['page' => 'results', 'file' => 'results', 'icon' => 'results', 'label' => 'Results', 'count' => 7],
        ]),
    ],
    'Laboratory Staff' => [
        'title' => 'Laboratory Staff Dashboard',
        'topbarLabel' => 'Laboratory',
        'brandSmall' => 'Laboratory workspace',
        'ariaLabel' => 'Laboratory navigation',
        'workspaceLabel' => 'Laboratory workspace',
        'searchPlaceholder' => 'Search laboratory requests, patients, results, facilities...',
        'notificationCount' => 6,
        'drawerId' => 'lab-drawer',
        'drawerEyebrow' => 'Laboratory Workspace',
        'bodyClass' => 'admin-app lab-app',
        'avatarClass' => 'avatar-purple',
        'profilePage' => 'profile',
        'infoTitle' => 'Precision in every result.',
        'infoText' => 'Your assigned laboratory work, organized.',
        'illustration' => $simpleClinicSvg,
        'nav' => clinic_route_nav([
            ['page' => 'dashboard', 'file' => 'dashboard', 'icon' => 'dashboard', 'label' => 'Dashboard'],
            ['page' => 'orders', 'file' => 'orders', 'icon' => 'orders', 'label' => 'Laboratory Requests', 'count' => 18],
            ['page' => 'upload', 'file' => 'upload-result', 'icon' => 'upload', 'label' => 'Results Upload'],
            ['page' => 'review', 'file' => 'verify-result', 'icon' => 'review', 'label' => 'Result Review', 'count' => 9],
            ['page' => 'operations', 'file' => 'operations', 'icon' => 'activity', 'label' => 'Assigned Operations'],
            ['page' => 'facilities', 'file' => 'facilities', 'icon' => 'facility', 'label' => 'Assigned Facilities'],
            ['page' => 'queue', 'file' => 'queue', 'icon' => 'queue', 'label' => 'Test Queue', 'count' => 24],
        ]),
    ],
    'Patient' => [
        'title' => 'Patient Dashboard',
        'topbarLabel' => 'Patient Portal',
        'brandSmall' => 'Patient portal',
        'ariaLabel' => 'Patient portal navigation',
        'workspaceLabel' => 'My health records',
        'searchPlaceholder' => 'Search my laboratory requests, results, notifications...',
        'notificationCount' => 4,
        'drawerId' => 'patient-drawer',
        'drawerEyebrow' => 'My Secure Health Record',
        'bodyClass' => 'admin-app patient-app',
        'avatarClass' => 'avatar-pink',
        'profilePage' => 'profile',
        'infoClass' => 'patient-privacy-card',
        'infoTitle' => 'Your health information is secure and private.',
        'infoText' => 'Only records linked to your profile are shown.',
        'illustration' => $patientPrivacySvg,
        'nav' => clinic_route_nav([
            ['page' => 'dashboard', 'file' => 'dashboard', 'icon' => 'dashboard', 'label' => 'Dashboard'],
            ['page' => 'orders', 'file' => 'orders', 'icon' => 'orders', 'label' => 'My Laboratory Requests', 'count' => 8],
            ['page' => 'results', 'file' => 'results', 'icon' => 'results', 'label' => 'My Results', 'count' => 4],
            ['section' => 'My account'],
            ['page' => 'profile', 'file' => 'profile', 'icon' => 'user', 'label' => 'Profile'],
        ]),
    ],
];

$roleConfig = $configs[$requiredRole];
$pageTitle = $pageTitle ?? ($roleConfig['title'] . ' | Centralized Laboratory Results System');
$pageDescription = $pageDescription ?? 'Centralized Laboratory Results System ' . strtolower($roleConfig['brandSmall']);
$bodyAttributes = 'data-required-role="' . e($requiredRole) . '" data-user-id="' . e($currentUser['id'] ?? '') . '" data-initial-page="' . e($initialPage) . '"';

require __DIR__ . '/../layouts/header.php';
?>
    <div class="<?= e($roleConfig['bodyClass']) ?>">
      <?php require __DIR__ . '/../layouts/sidebar.php'; ?>

      <div class="admin-main">
        <?php require __DIR__ . '/../layouts/navbar.php'; ?>
        <main class="page-content" id="page-content" tabindex="-1"></main>
      </div>

      <div class="drawer-scrim" data-close-drawer></div>
      <aside class="drawer" id="<?= e($roleConfig['drawerId']) ?>" aria-hidden="true" aria-labelledby="drawer-title">
        <div class="drawer-head">
          <div><p class="eyebrow"><?= e($roleConfig['drawerEyebrow']) ?></p><h2 id="drawer-title">Details</h2></div>
          <button class="icon-button" type="button" aria-label="Close panel" data-close-drawer data-icon-button="close"></button>
        </div>
        <div class="drawer-body" id="drawer-body"></div>
      </aside>

      <div class="toast-region" aria-live="polite" aria-atomic="true"></div>
    </div>
<?php require __DIR__ . '/../layouts/footer.php'; ?>
