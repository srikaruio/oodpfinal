# HostelHub - Full Stack Hostel Management System

A premium hostel management application with a **React** frontend, **C++** backend, and **MySQL** database.

## 🚀 Features
- **Modern Dashboard**: Real-time stats on students, rooms, and fees.
- **Student Management**: Full CRUD operations with search.
- **Room Matrix**: Visual grid to monitor occupancy and status.
- **Fee Tracking**: Invoice generation and payment recording.
- **Support Tickets**: Maintenance request handling with priority levels.

---

## 🛠️ Prerequisites
- **Frontend**: Node.js & npm
- **Backend**: 
  - CMake (3.16+)
  - C++ Compiler (GCC, Clang, or MSVC)
  - MySQL Server (Installed and running)
  - MySQL Connector C (or MySQL Server include/lib files)

---

## 🏗️ Setup Instructions

### 1. Database Setup (MySQL)
1. Ensure MySQL is running on your system.
2. The backend will automatically create the `hostel_management` database and required tables upon first run.
3. **Configure Credentials**: Open `backend/include/db_config.h` and update your MySQL credentials:
   ```cpp
   const std::string USER = "root";
   const std::string PASSWORD = "your_mysql_password"; // <--- UPDATE THIS
   ```

### 2. Backend Compilation (C++)
1. Create a build directory:
   ```powershell
   cd backend
   mkdir build
   cd build
   ```
2. Run CMake:
   ```powershell
   # If MySQL is in a standard path:
   cmake ..
   
   # If you need to specify MySQL path (example for Windows):
   cmake -DMYSQL_DIR="C:/Program Files/MySQL/MySQL Server 8.0" ..
   ```
3. Build and Run:
   ```powershell
   cmake --build . --config Release
   ./server # or server.exe on Windows
   ```

### 3. Frontend Setup (React)
1. Install dependencies:
   ```powershell
   cd frontend
   npm install
   ```
2. Start the development server:
   ```powershell
   npm run dev
   ```

---

## 📂 Project Structure
- `/frontend`: React application using Vite, Lucide Icons, and custom CSS.
- `/backend`: C++ REST API server.
  - `/include`: Header-only libraries (`httplib.h`, `json.hpp`) and DB logic.
  - `/src`: Server implementation and routing.
- `/backend/CMakeLists.txt`: Build configuration.

---

## 💡 Notes
- The C++ backend runs on `http://localhost:8080`.
- The React frontend runs on `http://localhost:5173` (default Vite port).
- The backend includes a seed feature that populates the database with initial data if it's empty.
