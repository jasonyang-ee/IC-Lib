#!/bin/bash

# Build the Docker image
docker compose build

# Tag the image
docker tag iclib:latest jasonyangee/iclib:development

# Push the image to Docker registry
docker login
docker push jasonyangee/iclib:development
