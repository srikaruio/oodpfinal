# Use an official Ubuntu base image
FROM ubuntu:22.04

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the backend source code into the container
COPY CMakeLists.txt .
COPY src/ ./src/
COPY include/ ./include/

# Create a build directory and compile the C++ server
RUN mkdir build && cd build && cmake .. && cmake --build . --config Release

# Expose the port the server runs on
EXPOSE 8080

# Run the compiled backend server
CMD ["./build/server"]
