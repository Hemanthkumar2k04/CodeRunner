FROM python:3.12-alpine AS base

# Install build deps for native packages, install pip packages, then remove build deps
RUN apk add --no-cache --virtual .build-deps gcc musl-dev g++ \
    && pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    ipykernel \
    pillow \
    scikit-learn \
    && apk del .build-deps \
    && rm -rf /root/.cache/pip /tmp/*

# Create non-root user
RUN adduser -D runner
USER runner
WORKDIR /app