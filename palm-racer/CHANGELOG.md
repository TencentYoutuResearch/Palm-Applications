# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!-- 新的变更记录在此处 -->

---

## [1.0.0] - 2025-04-21

### Added
- `.editorconfig` for cross-IDE formatting consistency
- `.gitattributes` with line ending normalization and binary file rules
- `CONTRIBUTING.md` contribution guide
- `CHANGELOG.md` version changelog
- `SECURITY.md` vulnerability reporting process
- GitHub Issue and Pull Request templates
- `server/.env.example` environment variable template
- `server/Makefile` test and vet targets
- Database `cheat_user_id` column and leaderboard composite index
- Score submission input validation (score, max_speed, survive_time ranges)
- README badges (License, Go, Node.js)

### Changed
- Replaced hardcoded credentials in `palm-racer.yaml` with placeholder values
- Pinned Nginx Docker image to `1.27-alpine`
- Improved `.dockerignore` to exclude unnecessary files
- Migrated `fmt.Printf` to structured logging in server entry point
- Added proper error handling for `json.Marshal` calls
- Consolidated `server/doc/` into top-level `docs/api/`
- Moved `CODE_QUALITY_ANALYSIS.md` into `docs/`
- Enhanced TLS configuration (MinVersion TLS 1.2, InsecureSkipVerify disabled)

### Fixed
- Missing error handling in legacy HTTP route handlers
- Silent `json.Marshal` failures in Palm API proxy layer

### Security
- Removed hardcoded API credentials from configuration files
- Added security note for JWT parsing without signature verification

---

<!-- 版本比较链接 -->
[Unreleased]: https://github.com/TencentYoutuResearch/Palm-Applications/tree/main/palm-racer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/TencentYoutuResearch/Palm-Applications/tree/main/palm-racer/releases/tag/v1.0.0
