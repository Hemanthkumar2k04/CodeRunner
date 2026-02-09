FROM python:3.12-slim

# Install packages for notebook support (data science + visualization)
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    ipykernel \
    pillow \
    scikit-learn

# Create non-root user
RUN useradd -m runner
USER runner
WORKDIR /app