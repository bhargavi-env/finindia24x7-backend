CREATE DATABASE IF NOT EXISTS finindia24x7 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE finindia24x7;

CREATE TABLE IF NOT EXISTS customer_leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(160) NULL,
  product_type VARCHAR(80) NOT NULL,
  monthly_income DECIMAL(12,2) NULL,
  city VARCHAR(100) NULL,
  message TEXT NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('NEW','CONTACTED','CLOSED') NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_customer_leads_created_at (created_at),
  INDEX idx_customer_leads_phone (phone)
) ENGINE=InnoDB;
