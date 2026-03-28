CREATE DATABASE IF NOT EXISTS smart_gate_db_new;
USE smart_gate_db_new;

CREATE TABLE `users` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Buat Tabel 'registered_clients' (sudah termasuk mac_address)
CREATE TABLE `registered_clients` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(50) NOT NULL,
  `mac_address` VARCHAR(20) DEFAULT NULL,
  `driver_name` VARCHAR(100) DEFAULT NULL,
  `plat_nomor` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_mac_address` (`mac_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Buat Tabel 'access_logs'
CREATE TABLE `access_logs` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(50) DEFAULT NULL,
  `driver_id` VARCHAR(50) DEFAULT NULL,
  `driver_name` VARCHAR(100) DEFAULT NULL,
  `muatan` VARCHAR(255) DEFAULT NULL,
  `plat_ble` VARCHAR(20) DEFAULT NULL,
  `plat_ocr` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('VALID','INVALID','MANUAL_OPEN') DEFAULT 'INVALID',
  `waktu_masuk` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `image_path_masuk` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;