FROM mysql:8.0

# Create a non-root user for running queries
RUN useradd -m runner

# Set up MySQL to allow connections from the runner user
ENV MYSQL_ROOT_PASSWORD=root

# Expose MySQL port
EXPOSE 3306

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set up working directory
WORKDIR /app
RUN chown -R runner:runner /app

USER runner

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
