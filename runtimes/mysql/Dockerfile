FROM mysql:8.0

# Set root password — required for initialization
ENV MYSQL_ROOT_PASSWORD=root

# Optimize MySQL startup: skip DNS lookups and use tmpfs for temp tables
ENV MYSQL_INITDB_SKIP_TZINFO=1

# Custom MySQL config for faster startup and lower resource usage
RUN echo '[mysqld]\nskip-name-resolve\nskip-log-bin\ninnodb_buffer_pool_size=128M\ninnodb_log_file_size=48M\nmax_connections=20\ntmp_table_size=16M\nmax_heap_table_size=16M' > /etc/mysql/conf.d/optimized.cnf

# Set up working directory
WORKDIR /app
