#!/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )"
sass --watch scss:public/css &
sasspid=$!
php -S 127.0.0.1:7777 -t public
kill -s SIGINT $sasspid
