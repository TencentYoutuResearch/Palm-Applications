-- 创建数据库
CREATE DATABASE IF NOT EXISTS `palmracer` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE `palm_racer`;

-- game_scores 游戏分数表
CREATE TABLE IF NOT EXISTS `t_game_scores` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '用户ID',
  `user_name` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '用户名',
  `score` INT NOT NULL DEFAULT 0 COMMENT '游戏分数',
  `max_speed` DOUBLE NOT NULL DEFAULT 0 COMMENT '最大速度',
  `survive_time` DOUBLE NOT NULL DEFAULT 0 COMMENT '存活时间(秒)',
  `cheated` TINYINT NOT NULL DEFAULT 0 COMMENT '是否作弊: 0-否, 1-是',
  `cheat_user_id` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '替玩用户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_score` (`cheated`, `score` DESC),
  INDEX `idx_leaderboard` (`cheated`, `created_at`, `score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='游戏分数表';

-- palm_registrations 掌纹注册记录表（一号一掌约束）
CREATE TABLE IF NOT EXISTS `t_palm_registrations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='掌纹注册记录表';

-- 从 t_game_scores 补全存量已注册用户数据
INSERT IGNORE INTO t_palm_registrations (user_id)
SELECT DISTINCT user_id FROM t_game_scores;
