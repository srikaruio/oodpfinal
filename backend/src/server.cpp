#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <arpa/inet.h>
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close
#endif

#include "../include/sqlite3.h"
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <ctime>
#include "../include/json.hpp"

using json = nlohmann::json;

class DatabaseManager {
private:
    sqlite3* db;
    static DatabaseManager* instance;
    DatabaseManager() {
        sqlite3_open("hostel_data.db", &db);
        
        // Enable WAL mode for concurrent read/write and set a timeout
        sqlite3_exec(db, "PRAGMA journal_mode=WAL;", 0, 0, 0);
        sqlite3_exec(db, "PRAGMA busy_timeout=5000;", 0, 0, 0);

        sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, courseYear TEXT, roomNumber TEXT)", 0, 0, 0);
        sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, roomNumber TEXT UNIQUE, block TEXT, type TEXT, rent INTEGER, status TEXT DEFAULT 'Available')", 0, 0, 0);
        sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS fees (id INTEGER PRIMARY KEY AUTOINCREMENT, studentId TEXT, studentName TEXT, date TEXT, amount INTEGER, type TEXT, status TEXT DEFAULT 'Pending')", 0, 0, 0);
        sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS complaints (id INTEGER PRIMARY KEY AUTOINCREMENT, studentName TEXT, date TEXT, description TEXT, status TEXT DEFAULT 'Open')", 0, 0, 0);
        
        sqlite3_exec(db, "ALTER TABLE students ADD COLUMN courseYear TEXT", 0, 0, 0);
        sqlite3_exec(db, "ALTER TABLE students ADD COLUMN roomNumber TEXT", 0, 0, 0);
        sqlite3_exec(db, "ALTER TABLE rooms ADD COLUMN block TEXT", 0, 0, 0);
        sqlite3_exec(db, "ALTER TABLE rooms ADD COLUMN rent INTEGER", 0, 0, 0);
        
        sqlite3_exec(db, "INSERT OR IGNORE INTO rooms (roomNumber, block, type, rent, status) VALUES ('101', 'A', 'Double Shared', 5000, 'Available')", 0, 0, 0);
        sqlite3_exec(db, "INSERT OR IGNORE INTO rooms (roomNumber, block, type, rent, status) VALUES ('102', 'A', 'Single Premium', 8500, 'Available')", 0, 0, 0);
        sqlite3_exec(db, "INSERT OR IGNORE INTO rooms (roomNumber, block, type, rent, status) VALUES ('201', 'B', 'Triple Shared', 4200, 'Available')", 0, 0, 0);
    }
public:
    static DatabaseManager* getInstance() { if (!instance) instance = new DatabaseManager(); return instance; }
    sqlite3* getDb() { return db; }
    void execute(std::string sql) {
        char* errMsg = 0;
        int rc = sqlite3_exec(db, sql.c_str(), 0, 0, &errMsg);
        if (rc != SQLITE_OK) {
            std::cerr << "SQL Error: " << errMsg << " | SQL: " << sql << std::endl;
            sqlite3_free(errMsg);
        } else {
            std::cout << "SQL Success: " << sql << std::endl;
        }
    }
};
DatabaseManager* DatabaseManager::instance = nullptr;

class HostelController {
public:
    std::string getDashboard() {
        sqlite3_stmt* stmt;
        auto db = DatabaseManager::getInstance()->getDb();
        int totalStudents = 0, allotted = 0, totalRooms = 0, available = 0, complaints = 0, feesDue = 0;
        
        sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM students", -1, &stmt, 0);
        if (sqlite3_step(stmt) == SQLITE_ROW) totalStudents = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM students WHERE roomNumber IS NOT NULL AND roomNumber != ''", -1, &stmt, 0);
        if (sqlite3_step(stmt) == SQLITE_ROW) allotted = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM rooms", -1, &stmt, 0);
        if (sqlite3_step(stmt) == SQLITE_ROW) totalRooms = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM rooms WHERE status = 'Available'", -1, &stmt, 0);
        if (sqlite3_step(stmt) == SQLITE_ROW) available = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM complaints WHERE status = 'Open'", -1, &stmt, 0);
        if (sqlite3_step(stmt) == SQLITE_ROW) complaints = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        sqlite3_prepare_v2(db, "SELECT SUM(amount) FROM fees WHERE status = 'Pending'", -1, &stmt, 0);
        if (sqlite3_step(stmt) == SQLITE_ROW) feesDue = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);

        json j = { {"totalStudents", totalStudents}, {"allottedStudents", allotted}, {"totalRooms", totalRooms}, {"availableRooms", available}, {"openComplaints", complaints}, {"totalFeesDue", feesDue} };
        return j.dump();
    }

    std::string getStudents() {
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(DatabaseManager::getInstance()->getDb(), "SELECT id, name, phone, courseYear, roomNumber FROM students", -1, &stmt, 0);
        json arr = json::array();
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string sid = std::to_string(sqlite3_column_int(stmt, 0));
            sqlite3_stmt* fstmt; int due = 0;
            std::string fsql = "SELECT SUM(amount) FROM fees WHERE studentId = '" + sid + "' AND status = 'Pending'";
            sqlite3_prepare_v2(DatabaseManager::getInstance()->getDb(), fsql.c_str(), -1, &fstmt, 0);
            if (sqlite3_step(fstmt) == SQLITE_ROW) due = sqlite3_column_int(fstmt, 0);
            sqlite3_finalize(fstmt);

            arr.push_back({ {"id", sid}, {"name", (const char*)sqlite3_column_text(stmt, 1)}, {"phone", (const char*)sqlite3_column_text(stmt, 2)}, {"courseYear", (const char*)sqlite3_column_text(stmt, 3)}, {"roomNumber", sqlite3_column_text(stmt, 4) ? (const char*)sqlite3_column_text(stmt, 4) : ""}, {"totalDue", due} });
        }
        sqlite3_finalize(stmt); return arr.dump();
    }

    std::string getRooms() {
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(DatabaseManager::getInstance()->getDb(), "SELECT roomNumber, block, type, rent, status FROM rooms", -1, &stmt, 0);
        json arr = json::array();
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            arr.push_back({ {"roomNumber", (const char*)sqlite3_column_text(stmt, 0)}, {"block", (const char*)sqlite3_column_text(stmt, 1)}, {"type", (const char*)sqlite3_column_text(stmt, 2)}, {"rent", sqlite3_column_int(stmt, 3)}, {"status", (const char*)sqlite3_column_text(stmt, 4)} });
        }
        sqlite3_finalize(stmt); return arr.dump();
    }

    std::string getFees() {
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(DatabaseManager::getInstance()->getDb(), "SELECT studentId, studentName, date, amount, type, status FROM fees", -1, &stmt, 0);
        json arr = json::array();
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            arr.push_back({ {"studentId", (const char*)sqlite3_column_text(stmt, 0)}, {"studentName", (const char*)sqlite3_column_text(stmt, 1)}, {"date", (const char*)sqlite3_column_text(stmt, 2)}, {"amount", sqlite3_column_int(stmt, 3)}, {"type", (const char*)sqlite3_column_text(stmt, 4)}, {"status", (const char*)sqlite3_column_text(stmt, 5)} });
        }
        sqlite3_finalize(stmt); return arr.dump();
    }

    std::string getComplaints() {
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(DatabaseManager::getInstance()->getDb(), "SELECT id, studentName, date, description, status FROM complaints", -1, &stmt, 0);
        json arr = json::array();
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            arr.push_back({ {"id", std::to_string(sqlite3_column_int(stmt, 0))}, {"studentName", (const char*)sqlite3_column_text(stmt, 1)}, {"date", (const char*)sqlite3_column_text(stmt, 2)}, {"description", (const char*)sqlite3_column_text(stmt, 3)}, {"status", (const char*)sqlite3_column_text(stmt, 4)} });
        }
        sqlite3_finalize(stmt); return arr.dump();
    }
};

class SimpleServer {
    int port;
public:
    SimpleServer(int p) : port(p) {
#ifdef _WIN32
        WSADATA wsa; WSAStartup(MAKEWORD(2, 2), &wsa);
#endif
    }
    void start() {
        SOCKET s = socket(AF_INET, SOCK_STREAM, 0);
        sockaddr_in addr;
        addr.sin_family = AF_INET;
        addr.sin_port = htons(port);
        addr.sin_addr.s_addr = INADDR_ANY;
        bind(s, (sockaddr*)&addr, sizeof(addr));
        listen(s, 10);
        std::cout << "Hostel Backend Connected to New UI - Port " << port << std::endl;
        
        HostelController controller;
        while (true) {
            SOCKET client = accept(s, 0, 0);
            char buffer[16384] = {0};
            int bytesReceived = recv(client, buffer, 16384, 0);
            if (bytesReceived <= 0) { closesocket(client); continue; }
            
            std::string req(buffer, bytesReceived);
            
            size_t headerEnd = req.find("\r\n\r\n");
            if (headerEnd != std::string::npos) {
                std::string headers = req.substr(0, headerEnd);
                for (char& c : headers) c = tolower(c);
                size_t clPos = headers.find("\r\ncontent-length: ");
                if (clPos == std::string::npos) clPos = headers.find("content-length: ") == 0 ? 0 : std::string::npos;
                
                if (clPos != std::string::npos) {
                    size_t valPos = clPos + (headers[clPos] == '\r' ? 18 : 16);
                    size_t clEnd = headers.find("\r\n", valPos);
                    if (clEnd != std::string::npos) {
                        int contentLength = std::stoi(headers.substr(valPos, clEnd - valPos));
                        int currentBodyLength = req.length() - (headerEnd + 4);
                        while (currentBodyLength < contentLength) {
                            int r = recv(client, buffer, 16384, 0);
                            if (r <= 0) break;
                            req.append(buffer, r);
                            currentBodyLength += r;
                        }
                    }
                }
            }

            std::string body = "{}";
            if (req.find("OPTIONS ") == 0) { body = ""; } 
            else if (req.find("GET /api/dashboard") != std::string::npos) body = controller.getDashboard();
            else if (req.find("GET /api/students") != std::string::npos) body = controller.getStudents();
            else if (req.find("GET /api/rooms") != std::string::npos) body = controller.getRooms();
            else if (req.find("GET /api/fees") != std::string::npos) body = controller.getFees();
            else if (req.find("GET /api/complaints") != std::string::npos) body = controller.getComplaints();
            else if (req.find("POST /api/students") != std::string::npos) {
                try {
                    size_t pos = req.find("\r\n\r\n") + 4;
                    auto j = json::parse(req.substr(pos));
                    std::string sql = "INSERT INTO students (name, phone, email, courseYear) VALUES ('" + j.value("name", "") + "', '" + j.value("phone", "") + "', '" + j.value("email", "") + "', '" + j.value("courseYear", "") + "')";
                    DatabaseManager::getInstance()->execute(sql);
                    body = "{\"status\":\"ok\"}";
                } catch (...) { body = "{\"status\":\"error\"}"; }
            }
            else if (req.find("POST /api/rooms/allocate") != std::string::npos) {
                try {
                    size_t pos = req.find("\r\n\r\n") + 4;
                    auto j = json::parse(req.substr(pos));
                    std::string sid = j["studentId"].get<std::string>();
                    std::string rno = j["roomNumber"].get<std::string>();
                    DatabaseManager::getInstance()->execute("UPDATE students SET roomNumber = '" + rno + "' WHERE id = " + sid);
                    DatabaseManager::getInstance()->execute("UPDATE rooms SET status = 'Occupied' WHERE roomNumber = '" + rno + "'");
                    time_t now = time(0); char tbuf[80]; strftime(tbuf, sizeof(tbuf), "%Y-%m-%d", localtime(&now));
                    DatabaseManager::getInstance()->execute("INSERT INTO fees (studentId, studentName, date, amount, type) SELECT id, name, '" + std::string(tbuf) + "', (SELECT rent FROM rooms WHERE roomNumber = '" + rno + "'), 'Room Rent' FROM students WHERE id = " + sid);
                    body = "{\"status\":\"ok\"}";
                } catch (...) { body = "{\"status\":\"error\"}"; }
            }
            else if (req.find("DELETE /api/students/") != std::string::npos) {
                size_t pos = req.find("/api/students/") + 14;
                std::string id = req.substr(pos, req.find(" ", pos) - pos);
                DatabaseManager::getInstance()->execute("UPDATE rooms SET status = 'Available' WHERE roomNumber = (SELECT roomNumber FROM students WHERE id = " + id + ")");
                DatabaseManager::getInstance()->execute("DELETE FROM fees WHERE studentId = '" + id + "'");
                DatabaseManager::getInstance()->execute("DELETE FROM complaints WHERE studentName = (SELECT name FROM students WHERE id = " + id + ")");
                DatabaseManager::getInstance()->execute("DELETE FROM students WHERE id = " + id);
                body = "{\"status\":\"ok\"}";
            }
            else if (req.find("POST /api/rooms") != std::string::npos && req.find("/allocate") == std::string::npos) {
                try {
                    size_t pos = req.find("\r\n\r\n") + 4;
                    auto j = json::parse(req.substr(pos));
                    std::string num = j.value("roomNumber", "");
                    std::string block = j.value("block", "");
                    std::string type = j.value("type", "");
                    std::string rent = j["rent"].is_number() ? std::to_string(j["rent"].get<int>()) : j.value("rent", "0");
                    DatabaseManager::getInstance()->execute("INSERT INTO rooms (roomNumber, block, type, rent) VALUES ('" + num + "', '" + block + "', '" + type + "', " + rent + ")");
                    body = "{\"status\":\"ok\"}";
                } catch (...) { body = "{\"status\":\"error\"}"; }
            }
            else if (req.find("DELETE /api/rooms/") != std::string::npos) {
                size_t pos = req.find("/api/rooms/") + 12;
                std::string num = req.substr(pos, req.find(" ", pos) - pos);
                DatabaseManager::getInstance()->execute("DELETE FROM rooms WHERE roomNumber = '" + num + "'");
                body = "{\"status\":\"ok\"}";
            }
            else if (req.find("POST /api/fees/pay") != std::string::npos) {
                try {
                    size_t pos = req.find("\r\n\r\n") + 4;
                    auto j = json::parse(req.substr(pos));
                    std::string sid = j.value("studentId", "");
                    DatabaseManager::getInstance()->execute("UPDATE fees SET status = 'Paid' WHERE studentId = '" + sid + "' AND status = 'Pending'");
                    body = "{\"status\":\"ok\"}";
                } catch (...) { body = "{\"status\":\"error\"}"; }
            }
            else if (req.find("POST /api/complaints/resolve") != std::string::npos) {
                try {
                    size_t pos = req.find("\r\n\r\n") + 4;
                    auto j = json::parse(req.substr(pos));
                    std::string cid = j["id"].is_number() ? std::to_string(j["id"].get<int>()) : j.value("id", "");
                    DatabaseManager::getInstance()->execute("UPDATE complaints SET status = 'Resolved' WHERE id = " + cid);
                    body = "{\"status\":\"ok\"}";
                } catch (...) { body = "{\"status\":\"error\"}"; }
            }
            else if (req.find("POST /api/complaints") != std::string::npos) {
                try {
                    size_t pos = req.find("\r\n\r\n") + 4;
                    auto j = json::parse(req.substr(pos));
                    std::string sid = j.value("studentId", "");
                    std::string desc = j.value("description", "");
                    time_t now = time(0); char tbuf[80]; strftime(tbuf, sizeof(tbuf), "%Y-%m-%d", localtime(&now));
                    DatabaseManager::getInstance()->execute("INSERT INTO complaints (studentName, date, description) SELECT name, '" + std::string(tbuf) + "', '" + desc + "' FROM students WHERE id = " + sid);
                    body = "{\"status\":\"ok\"}";
                } catch (...) { body = "{\"status\":\"error\"}"; }
            }

            std::string header = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, DELETE, OPTIONS, PUT\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept\r\nConnection: close\r\n\r\n";
            std::string response = header + body;
            send(client, response.c_str(), (int)response.length(), 0);
            closesocket(client);
        }
    }
};

#include <cstdlib>

int main() {
    const char* env_p = std::getenv("PORT");
    int port = env_p ? std::stoi(env_p) : 8080;
    SimpleServer(port).start();
    return 0;
}
