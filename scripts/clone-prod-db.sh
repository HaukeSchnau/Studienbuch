#!/bin/sh

set -eu

dropdb studienbuch
createdb studienbuch
ssh studienbuch@schnau.dev "pg_dump" | psql studienbuch
