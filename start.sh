#!/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )"
sass --watch scss:public/css &
sasspid=$!
php -S 0.0.0.0:7777 -t public
kill $sasspid
