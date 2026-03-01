FROM postgres:15-alpine

# Set root password — required for initialization
ENV POSTGRES_PASSWORD=root
ENV POSTGRES_USER=root
ENV POSTGRES_DB=devdb

# Optimize PostgreSQL for fast startup and development use.
# Pass settings directly as command-line flags so they are active from the very
# first boot — no init-script ALTER SYSTEM (which causes a restart cycle).
CMD ["postgres", \
     "-c", "fsync=off", \
     "-c", "synchronous_commit=off", \
     "-c", "full_page_writes=off", \
     "-c", "shared_buffers=32MB", \
     "-c", "wal_level=minimal", \
     "-c", "max_wal_senders=0", \
     "-c", "checkpoint_timeout=30min", \
     "-c", "max_connections=20"]

# Set up working directory
WORKDIR /app
