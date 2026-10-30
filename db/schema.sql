-- CallAgent MySQL sxemasi
CREATE DATABASE IF NOT EXISTS callagent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE callagent;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  system_prompt TEXT NOT NULL,
  first_message VARCHAR(500) DEFAULT '',
  language VARCHAR(10) DEFAULT 'uz-UZ',
  voice VARCHAR(40) DEFAULT 'nigora',
  voice_role VARCHAR(40) DEFAULT '',
  speed DECIMAL(3,2) DEFAULT 1.00,
  inbound_enabled TINYINT(1) DEFAULT 1,
  outbound_enabled TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  phone_number VARCHAR(30) DEFAULT NULL,   -- kiruvchi qo'ng'iroq shu raqamga kelsa, shu agent javob beradi
  result_fields JSON,                       -- [{"name":"nps","description":"1-10 baho"}]
  end_call_enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agent_phone (phone_number)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  status ENUM('draft','running','paused','done') DEFAULT 'draft',
  concurrency INT DEFAULT 2,
  max_attempts INT DEFAULT 2,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  campaign_id INT DEFAULT NULL,
  direction ENUM('inbound','outbound') NOT NULL,
  channel ENUM('browser','twilio','sip') NOT NULL,
  from_number VARCHAR(30) DEFAULT '',
  to_number VARCHAR(30) DEFAULT '',
  provider_call_id VARCHAR(64) DEFAULT NULL,
  status ENUM('in_progress','completed','failed') DEFAULT 'in_progress',
  ended_by VARCHAR(10) DEFAULT NULL,
  duration_sec INT DEFAULT 0,
  transcript JSON,
  result JSON,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  KEY idx_calls_agent (agent_id, started_at)
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  phone VARCHAR(30) NOT NULL,
  name VARCHAR(120) DEFAULT '',
  status ENUM('pending','calling','done','failed') DEFAULT 'pending',
  attempts INT DEFAULT 0,
  call_id INT DEFAULT NULL,
  last_error VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  KEY idx_cc_status (campaign_id, status)
);
