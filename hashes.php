<?php

function main() {
    $csp = '';

    $js = ['main.js', 'power.js', 'highstock-10.3.3.js'];
    foreach ($js as $path) {
        $fullPath = __DIR__ . "/public/{$path}";
        $hash = base64_encode(hash_file('sha256', $fullPath, true));
        echo "sha256-{$hash} {$path} \n";
    }
}

main();
