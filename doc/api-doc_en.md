# Palm API Protocol Documentation

> This document defines a general API protocol for palm recognition services, including authentication, data structures, API specifications, and error codes. It is applicable to any server or client implementing this protocol.

---

## 1. Overview

This protocol defines a set of RESTful palm recognition APIs with the following core capabilities:

| Capability | Description |
|------|------|
| Palm Registration | Upload RGB palm image to create a palm print and bind it to a user |
| 1:1 Comparison | Upload RGB palm image and compare with a specific user |
| 1:N Search | Upload RGB palm image and search against the database |
| Palm Deletion | Delete palm print information for a specified user |

Default rate limit: **20 requests/second**.

---

## 2. Authentication

All API requests use **Bearer Token** authentication.

| Item | Value |
|------|-------|
| Auth Method | HTTP Bearer Auth |
| Security Scheme Type | HTTP |
| Authorization Scheme | bearer |

### Request Example

```http
POST /palm/your-own-server/register_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

---

## 3. Common Data Structures

### 3.1 Image

Image data structure.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| Data | String | Yes | Image data, Base64 encoded |
| ThreePointList | Array of Pointf | No | Three-point data (coordinates after detection and registration) |
| ImageType | ImageType | Yes | Image type |
| DataDigest | String | No | MD5 checksum of the image data |

### 3.2 Pointf

Coordinate point.

| Name | Type | Description |
|------|------|-------------|
| PointX | Float | X coordinate |
| PointY | Float | Y coordinate |

---

## 4. Enumerations

### 4.1 ImageType

Image type.

| Value | Description |
|-------|-------------|
| 1 | Rgb (color image) |
| 2 | Ir (infrared image) |

### 4.2 PalmDirectionType

Palm direction.

| Value | Description |
|-------|-------------|
| 1 | Left hand |
| 2 | Right hand |

---

## 5. API Specifications

### 5.1 Common Response Format

All API responses use a unified JSON format:

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "unique_request_id",
  "data": {
    // business data
  }
}
```

- `code`: Error code, `0` indicates success, non-zero indicates failure
- `message`: Error description
- `requestId`: Unique request identifier for tracing
- `data`: Business response data

---

### 5.2 Register RGB Palm

**API:** `RegisterRgbPalm`

API request domain: your own server

Upload an RGB palm image to create a palm print and bind it to a specified user.

#### Request

```http
POST /palm/your-own-server/register_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| UserId | Yes | String | Unique user identifier |
| RgbImage | Yes | Image | RGB image data, Data and ImageType are required |
| IsForce | No | Boolean | Whether to force rebind (overwrite if user already has a palm print) |

#### Response

| Parameter | Type | Description |
|-----------|------|-------------|
| PalmId | String | User's palm print ID. If the user already has a palm print, the existing data is updated automatically (original PalmId remains unchanged) |

#### Example

**Request:**

```json
{
  "UserId": "user001",
  "RgbImage": {
    "Data": "base64_encoded_image_data",
    "ImageType": 1
  },
  "IsForce": false
}
```

**Response:**

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "4d5912a82af144f8a982c2da031c1035",
  "data": {
    "PalmId": "8db884f9-1fb8-44f5-bdaa-f98fdcb3cd47"
  }
}
```

---

### 5.3 Compare RGB Palm

**API:** `CompareRgbPalm`

API request domain: your own server

Upload an RGB palm image and perform a 1:1 comparison with a specified user.

#### Request

```http
POST /palm/your-own-server/compare_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| RgbImage | Yes | Image | RGB image data, Data and ImageType are required |
| CompareUserId | Yes | String | User ID to compare against |

#### Response

| Parameter | Type | Description |
|-----------|------|-------------|
| IsMatch | Boolean | Whether it matches |
| Score | Integer | Similarity score (0-100) |
| AlgorithmVersion | String | Algorithm version |
| PalmDirection | PalmDirectionType | Palm direction |

#### Example

**Request:**

```json
{
  "RgbImage": {
    "Data": "base64_encoded_image_data",
    "ImageType": 1
  },
  "CompareUserId": "user001"
}
```

**Response:**

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "4d5912a82af144f8a982c2da031c1035",
  "data": {
    "IsMatch": true,
    "Score": 95,
    "AlgorithmVersion": "v2.0",
    "PalmDirection": 1
  }
}
```

---

### 5.4 Search RGB Palm

**API:** `SearchRgbPalm`

API request domain: your own server

Upload an RGB palm image and perform a 1:N search against the database.

#### Request

```http
POST /palm/your-own-server/search_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| RgbImage | Yes | Image | RGB image data |

#### Response

| Parameter | Type | Description |
|-----------|------|-------------|
| UserId | String | Matched unique user identifier |
| Score | Integer | Similarity score (0-100) |
| AlgorithmVersion | String | Algorithm version |
| PalmDirection | PalmDirectionType | Palm direction |

#### Example

**Request:**

```json
{
  "RgbImage": {
    "Data": "base64_encoded_image_data",
    "ImageType": 1
  }
}
```

**Response:**

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "4d5912a82af144f8a982c2da031c1035",
  "data": {
    "UserId": "user001",
    "Score": 92,
    "AlgorithmVersion": "v2.0",
    "PalmDirection": 1
  }
}
```

---

### 5.5 Delete Palm

**API:** `DeletePalm`

API request domain: your own server

Delete palm print information for a specified user.

#### Request

```http
POST /palm/your-own-server/delete_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| UserId | Yes | String | Unique user identifier |
| PalmDirectionList | Yes | Array of PalmDirectionType | List of palm directions to delete (can include both left and right hands) |

#### Response

No business data.

#### Example

**Request:**

```json
{
  "UserId": "user001",
  "PalmDirectionList": [1, 2]
}
```

**Response:**

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "4d5912a82af144f8a982c2da031c1035",
  "data": {}
}
```

---

## 6. Error Codes

When the response contains a `code` field with a non-zero value, the API call has failed.

| Error Code | Description |
|------------|-------------|
| 1000000 | Invalid parameter (invalid format, type, etc.) |
| 1000001 | Internal system error |
| 1000002 | Missing required parameter |
| 1000003 | Callback event processing failed |
| 1000004 | Filters parameter exceeds limit |
| 1000005 | Pagination parameter exceeds limit |
| 1001001 | No available version |
| 1001002 | Unknown image type |
| 1001003 | Image MD5 mismatch |
| 1001004 | Liveness detection failed |
| 1001005 | Quality check failed |
| 1001006 | Video liveness detection failed |
| 1001007 | PalmId not found, please re-enroll |
| 1001008 | Already bound |
| 1001009 | PalmId may be bound by another user (incorrect binding) |
| 1001011 | Third-party authentication failed |
| 1001012 | No data found in database |
| 1001013 | No matching user found in palm database |
| 1001014 | Auxiliary image not found |
| 1001015 | Unknown verification type |
| 1001016 | System capacity full |
| 1001017 | User auxiliary image count exceeded |
| 1001018 | Verification UserId does not match |
| 1001019 | Verification ID expired |
| 1001020 | PalmId already exists |
| 1001021 | High similarity palm exists |
| 1001022 | User palm database capacity reached |
| 1001023 | Database operation failed / User deleted |
| 1001024 | User not found in database |
| 1001025 | Palm print for specified direction not found |
| 1001026 | Database concurrent operation conflict, please retry |
| 1001027 | Palm print already exists |
| 1001028 | Current sync index for feature insertion already exists |
| 1001029 | Palm database feature quota exceeded |
| 1001030 | Feature not authorized |
| 1001031 | Database quota cannot be lower than current usage |
| 1001032 | Application does not exist |
| 1001033 | Application already exists |

---

## 7. Glossary

| Term | Description |
|------|-------------|
| RGB | Color image |
| Three Points | Coordinate point data output after image detection and registration |
| PalmId | Unique palm print identifier |
| UserId | Unique user identifier |
