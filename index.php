<?php
// Local servers serve assets and authentication pages from the public directory.
// Redirect instead of including the page under a URL with a different base path.
header('Location: public/index.php', true, 302);
exit;
