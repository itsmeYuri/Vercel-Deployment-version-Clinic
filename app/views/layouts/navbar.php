<?php
$currentUser = $currentUser ?? ['name' => 'User', 'role' => 'User', 'avatar' => 'U'];
$roleConfig = $roleConfig ?? [];
$notificationCount = $roleConfig['notificationCount'] ?? 0;
?>
<header class="topbar">
  <div class="topbar-title">
    <button class="icon-button menu-button" type="button" aria-label="Open navigation" aria-controls="sidebar" data-open-sidebar data-icon-button="menu"></button>
    <div><span><?= e($roleConfig['topbarLabel'] ?? 'Workspace') ?></span><h1 id="page-title"><?= e($roleConfig['title'] ?? 'Dashboard') ?></h1></div>
  </div>

  <div class="topbar-actions">
    <label class="global-search">
      <span class="sr-only">Global search</span>
      <i data-icon="search"></i>
      <input id="global-search" type="search" placeholder="<?= e($roleConfig['searchPlaceholder'] ?? 'Search records...') ?>" autocomplete="off" />
      <kbd>Ctrl K</kbd>
    </label>

    <button class="icon-button notification-button" type="button" aria-label="View <?= e($notificationCount) ?> unread notifications" data-go-page="notifications" data-icon-button="bell">
      <span class="notification-count"><?= e($notificationCount) ?></span>
    </button>

    <div class="profile-menu-wrap">
      <button class="profile-button" type="button" aria-expanded="false" data-profile-toggle>
        <span class="avatar <?= e($roleConfig['avatarClass'] ?? 'avatar-teal') ?>"><?= e($currentUser['avatar'] ?? 'U') ?></span>
        <span class="profile-copy"><strong><?= e($currentUser['name'] ?? 'User') ?></strong><small><?= e($currentUser['role'] ?? 'User') ?></small></span>
        <i data-icon="chevron"></i>
      </button>
      <div class="profile-dropdown" hidden>
        <button type="button" data-go-page="<?= e($roleConfig['profilePage'] ?? 'settings') ?>" data-icon-name="user">My profile</button>
        <button type="button" data-go-page="settings" data-icon-name="settings">Account settings</button>
        <a href="<?= e($logoutUrl ?? '../auth/logout.php') ?>" data-logout data-icon-name="logout">Log out</a>
      </div>
    </div>
  </div>
</header>

