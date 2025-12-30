#!/bin/bash
set -e

# Start MySQL server in the background
/usr/sbin/mysqld --user=root &
MYSQL_PID=$!

# Wait for MySQL to start
echo "Waiting for MySQL to start..."
sleep 5

# Check if a SQL file is provided and execute it
if [ $# -gt 0 ]; then
  SQL_FILE="$1"
  if [ -f "$SQL_FILE" ]; then
    echo "Executing SQL file: $SQL_FILE"
    mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS testdb;"
    mysql -u root -proot testdb < "$SQL_FILE"
  fi
fi

# Keep the container running
wait $MYSQL_PID
