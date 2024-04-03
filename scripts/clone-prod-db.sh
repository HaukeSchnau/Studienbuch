#!/bin/sh

set -eau
. ../.env

dropdb studienbuch
createdb studienbuch
ssh studienbuch@schnau.dev "pg_dump" | psql studienbuch
