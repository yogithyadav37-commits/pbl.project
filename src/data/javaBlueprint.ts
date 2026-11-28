export interface JavaBlueprintFile {
  id: string;
  path: string;
  category: 'Architecture' | 'SQL Schema' | 'Java Engine' | 'Servlet & DAO' | 'JSP & Maven';
  language: string;
  summary: string;
  content: string;
}

export const JAVA_PROJECT_TREE = `ReClaim-Campus-LostAndFound/
├── pom.xml                                  # Maven build (Servlet 5.0, MySQL Connector/J, JSTL, BCrypt)
├── sql/
│   └── reclaim_db.sql                       # MySQL 8 schema (8 normalized tables + seed records)
├── src/main/java/edu/campus/reclaim/
│   ├── config/
│   │   └── DBConnection.java                # JDBC DataSource & PreparedStatement helper
│   ├── model/
│   │   ├── User.java
│   │   ├── LostItem.java
│   │   ├── FoundItem.java
│   │   ├── MatchSuggestion.java
│   │   └── Claim.java
│   ├── engine/
│   │   ├── TextMatchingEngine.java          # Primary TF-IDF + Jaccard + Synonym Weighted Engine
│   │   └── ImageSimilarityAdapter.java      # Optional secondary visual comparison interface
│   ├── dao/
│   │   ├── ItemDAO.java                     # Parameterized JDBC queries for lost/found items
│   │   └── ClaimDAO.java                    # Private verification & admin handover transactions
│   └── servlet/
│       ├── AuthServlet.java                 # BCrypt + HttpSession RBAC authentication
│       ├── ReportItemServlet.java           # Multipart upload validation + instant matching
│       ├── MatchServlet.java                # Ranked textual match suggestions JSON/JSP controller
│       └── AdminClaimServlet.java           # Admin approval, status updates, & notifications
└── src/main/webapp/
    ├── WEB-INF/web.xml                      # Apache Tomcat deployment descriptor
    ├── index.jsp                            # Responsive Bootstrap 5 homepage
    ├── report-lost.jsp                      # Lost item form emphasizing textual description
    ├── search.jsp                           # Filterable search + match percentage cards
    └── admin-dashboard.jsp                  # Admin analytics, threshold config & claim verification`;

export const JAVA_BLUEPRINT_FILES: JavaBlueprintFile[] = [
  {
    id: 'mysql-schema',
    path: 'sql/reclaim_db.sql',
    category: 'SQL Schema',
    language: 'sql',
    summary: 'Complete MySQL 8 database schema with all 8 required tables, foreign keys, indexes, and sample records.',
    content: `CREATE DATABASE IF NOT EXISTS reclaim_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE reclaim_db;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  student_name VARCHAR(100) NOT NULL,
  college_email VARCHAR(160) NOT NULL UNIQUE,
  student_id VARCHAR(32) NOT NULL UNIQUE,
  department VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE administrators (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  high_match_threshold INT DEFAULT 70,
  possible_match_threshold INT DEFAULT 45,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(200),
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE lost_items (
  lost_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  lost_location VARCHAR(120) NOT NULL,
  date_lost DATE NOT NULL,
  approx_time VARCHAR(40),
  identifying_characteristics TEXT,
  photo_path VARCHAR(255),
  visual_signature VARCHAR(255),
  status ENUM('OPEN','MATCHED','CLAIMED','RETURNED','ARCHIVED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE found_items (
  found_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  found_location VARCHAR(120) NOT NULL,
  date_found DATE NOT NULL,
  private_characteristics TEXT,
  photo_path VARCHAR(255),
  visual_signature VARCHAR(255),
  status ENUM('OPEN','MATCHED','CLAIMED','RETURNED','ARCHIVED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE matches (
  match_id INT AUTO_INCREMENT PRIMARY KEY,
  lost_id INT NOT NULL,
  found_id INT NOT NULL,
  text_score DECIMAL(5,2) NOT NULL,
  visual_score DECIMAL(5,2) NULL,
  final_score DECIMAL(5,2) NOT NULL,
  match_tier ENUM('HIGH','POSSIBLE','LOW') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lost_found (lost_id, found_id),
  FOREIGN KEY (lost_id) REFERENCES lost_items(lost_id) ON DELETE CASCADE,
  FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON DELETE CASCADE
);

CREATE TABLE claims (
  claim_id INT AUTO_INCREMENT PRIMARY KEY,
  found_id INT NOT NULL,
  lost_id INT NULL,
  claimant_user_id INT NOT NULL,
  verification_answer TEXT NOT NULL,
  unique_marks TEXT,
  status ENUM('PENDING','APPROVED','REJECTED','HANDED_OVER') DEFAULT 'PENDING',
  reviewed_by INT NULL,
  admin_notes VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (found_id) REFERENCES found_items(found_id),
  FOREIGN KEY (lost_id) REFERENCES lost_items(lost_id),
  FOREIGN KEY (claimant_user_id) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES administrators(admin_id)
);

CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  kind ENUM('MATCH','CLAIM','APPROVAL','RETURNED') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

INSERT INTO categories (name, description) VALUES
  ('Wallets & IDs', 'Wallets, student ID cards, and cardholders'),
  ('Water Bottles & Gear', 'Insulated bottles and tumblers'),
  ('Calculators & Lab Gear', 'Scientific calculators and lab equipment'),
  ('Electronics', 'Headphones, laptops, chargers, and flash drives');`,
  },
  {
    id: 'text-matching-engine',
    path: 'src/main/java/edu/campus/reclaim/engine/TextMatchingEngine.java',
    category: 'Java Engine',
    language: 'java',
    summary: 'Primary Java text matching engine implementing normalization, synonym mapping, Jaccard, TF-IDF cosine, and weighted scoring.',
    content: `package edu.campus.reclaim.engine;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

public class TextMatchingEngine {
  private static final Set<String> STOP_WORDS = Set.of(
      "a","an","the","and","or","with","near","in","on","at","to","of","for","my","one"
  );

  private static final Map<String, String> SYNONYMS = Map.ofEntries(
      Map.entry("billfold", "wallet"), Map.entry("purse", "wallet"),
      Map.entry("emblem", "logo"), Map.entry("decal", "sticker"),
      Map.entry("flask", "bottle"), Map.entry("tumbler", "bottle"),
      Map.entry("soccer", "football"), Map.entry("cracked", "damage"),
      Map.entry("damaged", "damage"), Map.entry("chipped", "damage"),
      Map.entry("broken", "damage"), Map.entry("earphones", "headphones")
  );

  public List<String> tokenize(String raw) {
    if (raw == null || raw.isBlank()) return List.of();
    String clean = raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\\\s]", " ").trim();
    List<String> out = new ArrayList<>();
    for (String w : clean.split("\\\\s+")) {
      if (w.length() < 2 || STOP_WORDS.contains(w)) continue;
      String canon = SYNONYMS.getOrDefault(w, w.endsWith("s") && w.length() > 3 ? w.substring(0, w.length() - 1) : w);
      out.add(SYNONYMS.getOrDefault(canon, canon));
    }
    return out;
  }

  public double jaccard(List<String> a, List<String> b) {
    Set<String> sa = new HashSet<>(a), sb = new HashSet<>(b);
    if (sa.isEmpty() || sb.isEmpty()) return 0.0;
    long common = sa.stream().filter(sb::contains).count();
    return (double) common / (sa.size() + sb.size() - common);
  }

  public double tfidfCosine(List<String> a, List<String> b, Map<String, Double> idf) {
    if (a.isEmpty() || b.isEmpty()) return 0.0;
    Map<String, Integer> fa = new HashMap<>(), fb = new HashMap<>();
    a.forEach(t -> fa.merge(t, 1, Integer::sum));
    b.forEach(t -> fb.merge(t, 1, Integer::sum));
    Set<String> vocab = new HashSet<>(fa.keySet());
    vocab.addAll(fb.keySet());
    double dot = 0, na = 0, nb = 0;
    for (String term : vocab) {
      double w = idf.getOrDefault(term, 1.5);
      double va = (fa.getOrDefault(term, 0) / (double) a.size()) * w;
      double vb = (fb.getOrDefault(term, 0) / (double) b.size()) * w;
      dot += va * vb; na += va * va; nb += vb * vb;
    }
    return (na == 0 || nb == 0) ? 0.0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  public int computeScore(
      String lostName, String lostDesc, String lostCat, String lostLoc, LocalDate lostDate,
      String foundName, String foundDesc, String foundCat, String foundLoc, LocalDate foundDate,
      Map<String, Double> idf, Optional<Double> supplementaryVisualSim) {
    List<String> dA = tokenize(lostDesc + " " + lostName);
    List<String> dB = tokenize(foundDesc + " " + foundName);
    double descSim = 0.45 * tfidfCosine(dA, dB, idf) + 0.55 * jaccard(dA, dB);
    double nameSim = jaccard(tokenize(lostName), tokenize(foundName));
    double catSim = lostCat.equalsIgnoreCase(foundCat) ? 1.0 : 0.0;
    double locSim = jaccard(tokenize(lostLoc), tokenize(foundLoc));
    long days = ChronoUnit.DAYS.between(lostDate, foundDate);
    double dateSim = (days >= 0 && days <= 1) ? 1.0 : (days < -3 ? 0.1 : Math.max(0.1, 1.0 - Math.abs(days) / 21.0));

    // Default weights: Description 35%, Name 25%, Category 15%, Location 15%, Date 10%
    double weighted = 0.35 * descSim + 0.25 * nameSim + 0.15 * catSim + 0.15 * locSim + 0.10 * dateSim;
    int textScore = (int) Math.round(Math.min(1.0, weighted) * 100);

    // Optional visual similarity can NEVER override low text similarity (capped at +5 pts)
    int visualBonus = (supplementaryVisualSim.isPresent() && textScore >= 40 && supplementaryVisualSim.get() >= 0.65)
        ? (int) Math.min(5, Math.round((supplementaryVisualSim.get() - 0.60) * 12.5)) : 0;
    return Math.min(100, textScore + visualBonus);
  }
}`,
  },
  {
    id: 'jdbc-servlet',
    path: 'src/main/java/edu/campus/reclaim/servlet/MatchServlet.java',
    category: 'Servlet & DAO',
    language: 'java',
    summary: 'Java Servlet controller using JDBC PreparedStatements to run text matching and return ranked suggestions.',
    content: `package edu.campus.reclaim.servlet;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
import java.util.*;
import edu.campus.reclaim.config.DBConnection;
import edu.campus.reclaim.engine.TextMatchingEngine;

@WebServlet("/api/matches")
public class MatchServlet extends HttpServlet {
  private final TextMatchingEngine engine = new TextMatchingEngine();

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    HttpSession session = req.getSession(false);
    if (session == null || session.getAttribute("userId") == null) {
      resp.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Approved college session required.");
      return;
    }

    String sql = "SELECT m.match_id, m.final_score, m.match_tier, l.item_name AS lost_name, "
               + "f.item_name AS found_name, f.found_location, f.date_found "
               + "FROM matches m "
               + "JOIN lost_items l ON m.lost_id = l.lost_id "
               + "JOIN found_items f ON m.found_id = f.found_id "
               + "WHERE m.final_score >= ? ORDER BY m.final_score DESC";

    try (Connection conn = DBConnection.getConnection();
         PreparedStatement ps = conn.prepareStatement(sql)) {
      ps.setInt(1, 45);
      try (ResultSet rs = ps.executeQuery()) {
        List<Map<String, Object>> rows = new ArrayList<>();
        while (rs.next()) {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("matchId", rs.getInt("match_id"));
          row.put("score", rs.getDouble("final_score"));
          row.put("tier", rs.getString("match_tier"));
          row.put("lostName", rs.getString("lost_name"));
          row.put("foundName", rs.getString("found_name"));
          row.put("foundLocation", rs.getString("found_location"));
          rows.add(row);
        }
        req.setAttribute("matches", rows);
        req.getRequestDispatcher("/search.jsp").forward(req, resp);
      }
    } catch (Exception e) {
      resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database query failed.");
    }
  }
}`,
  },
  {
    id: 'maven-setup',
    path: 'pom.xml & Eclipse Tomcat Guide',
    category: 'JSP & Maven',
    language: 'xml',
    summary: 'Maven dependencies and step-by-step Eclipse IDE + Apache Tomcat 10 + MySQL 8 setup guide.',
    content: `<!-- pom.xml (Maven Web Application) -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>edu.campus</groupId>
  <artifactId>reclaim-lost-found</artifactId>
  <version>1.0.0</version>
  <packaging>war</packaging>
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
  </properties>
  <dependencies>
    <dependency>
      <groupId>jakarta.servlet</groupId>
      <artifactId>jakarta.servlet-api</artifactId>
      <version>6.0.0</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <version>8.4.0</version>
    </dependency>
    <dependency>
      <groupId>org.mindrot</groupId>
      <artifactId>jbcrypt</artifactId>
      <version>0.4</version>
    </dependency>
  </dependencies>
</project>

<!-- ECLIPSE IDE + APACHE TOMCAT SETUP STEPS:
1. Run sql/reclaim_db.sql in MySQL Workbench to create reclaim_db and tables.
2. In Eclipse IDE: File -> Import -> Existing Maven Projects -> select ReClaim-Campus-LostAndFound.
3. Configure DBConnection.java via environment variables RECLAIM_DB_URL, RECLAIM_DB_USER, RECLAIM_DB_PASS.
4. Window -> Preferences -> Server -> Runtime Environments -> Add Apache Tomcat v10.1.
5. Right-click project -> Run As -> Run on Server -> Select Tomcat v10.1 -> http://localhost:8080/reclaim-lost-found/
-->`,
  },
];
