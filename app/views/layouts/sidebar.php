<?php
$roleConfig = $roleConfig ?? [];
$navItems = $roleConfig['nav'] ?? [];
$workspaceLabel = $roleConfig['workspaceLabel'] ?? 'Workspace';
$sidebarClass = $roleConfig['sidebarClass'] ?? '';
$logoutUrl = $logoutUrl ?? '../auth/logout.php';
?>
<aside class="sidebar <?= e($sidebarClass) ?>" id="sidebar" aria-label="<?= e($roleConfig['ariaLabel'] ?? 'Main navigation') ?>">
  <div class="sidebar-head">
    <a class="admin-brand" href="<?= e($roleConfig['homeUrl'] ?? 'dashboard.php') ?>" aria-label="Clinic Management System dashboard">
      <span class="admin-brand-mark" data-icon="medical"></span>
      <span><strong>Clinic Management</strong><small><?= e($roleConfig['brandSmall'] ?? 'Workspace') ?></small></span>
    </a>
    <button class="icon-button close-sidebar" type="button" aria-label="Close navigation" data-close-sidebar data-icon-button="close"></button>
  </div>

  <nav class="sidebar-nav">
    <p class="nav-label"><?= e($workspaceLabel) ?></p>
    <?php foreach ($navItems as $index => $item): ?>
      <?php if (!empty($item['section'])): ?>
        <p class="nav-label nav-label-spaced"><?= e($item['section']) ?></p>
        <?php continue; ?>
      <?php endif; ?>
      <a href="<?= e($item['href']) ?>" class="nav-item <?= $index === 0 ? 'active' : '' ?>" data-page="<?= e($item['page']) ?>" data-icon-name="<?= e($item['icon']) ?>">
        <span><?= e($item['label']) ?></span>
        <?php if (!empty($item['count'])): ?><b class="nav-count"><?= e($item['count']) ?></b><?php endif; ?>
      </a>
    <?php endforeach; ?>
  </nav>

  <div class="<?= e($roleConfig['infoClass'] ?? 'sidebar-clinic') ?>">
    <?= $roleConfig['illustration'] ?? '' ?>
    <strong><?= e($roleConfig['infoTitle'] ?? 'Care works better together.') ?></strong>
    <span><?= e($roleConfig['infoText'] ?? 'Secure clinic operations, all in one place.') ?></span>
  </div>

  <a class="sidebar-logout" href="<?= e($logoutUrl) ?>" data-logout data-icon-name="logout"><span>Log out</span></a>
</aside>
<div class="sidebar-scrim" data-close-sidebar></div>

