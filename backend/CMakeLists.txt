cmake_minimum_required(VERSION 3.16)
project(HostelManagementServer)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add SQLite and Server source
add_executable(server src/server.cpp include/sqlite3.c)

target_include_directories(server PRIVATE include)

# Link Windows Sockets
target_link_libraries(server PRIVATE ws2_32)

if(MSVC)
    target_compile_options(server PRIVATE /W3 /EHsc)
else()
    target_compile_options(server PRIVATE -Wall -Wextra)
endif()
