# Palm API 协议文档

> 本文档定义了掌纹识别服务的通用 API 协议，包括认证方式、数据结构、接口规范和错误码。适用于任何实现该协议的服务端或客户端。

---

## 1. 概述

本协议定义了一套基于 RESTful 风格的掌纹识别 API，支持以下核心能力：

| 能力 | 说明 |
|------|------|
| 掌纹注册 | 上传 RGB 掌图创建掌纹并绑定到指定用户 |
| 1:1 比对 | 上传 RGB 掌图与指定用户进行 1:1 身份核验 |
| 1:N 检索 | 上传 RGB 掌图在库中 1:N 搜索匹配用户 |
| 掌纹删除 | 删除指定用户的掌纹信息 |

接口默认请求频率限制：**20 次/秒**。

---

## 2. 认证方式

所有 API 请求使用 **Bearer Token** 进行认证。

| 项目 | 值 |
|------|-----|
| 认证方式 | HTTP Bearer Auth |
| 安全方案类型 | HTTP |
| Authorization 方案 | bearer |

### 请求示例

```http
POST /palm/your-own-server/register_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

---

## 3. 公共数据结构

### 3.1 Image

图片数据结构。

| 名称 | 类型 | 必填 | 描述 |
|------|------|------|------|
| Data | String | 是 | 图片数据，Base64 编码 |
| ThreePointList | Array of Pointf | 否 | 三点数据（检测配准后的坐标） |
| ImageType | ImageType | 是 | 图片类型 |
| DataDigest | String | 否 | 图片数据的 MD5 校验值 |

### 3.2 Pointf

坐标点。

| 名称 | 类型 | 描述 |
|------|------|------|
| PointX | Float | X 轴坐标 |
| PointY | Float | Y 轴坐标 |

---

## 4. 枚举类型

### 4.1 ImageType

图片类型。

| 枚举值 | 描述 |
|--------|------|
| 1 | Rgb（彩色图） |
| 2 | Ir（红外图） |

### 4.2 PalmDirectionType

手掌方向。

| 枚举值 | 描述 |
|--------|------|
| 1 | 左手 |
| 2 | 右手 |

---

## 5. 接口规范

### 5.1 公共响应格式

所有接口返回值使用统一的 JSON 格式：

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "唯一请求ID",
  "data": {
    // 业务数据
  }
}
```

- `code`：错误码，`0` 表示成功，非 `0` 表示失败
- `message`：错误描述
- `requestId`：请求唯一标识，用于链路追踪
- `data`：业务响应数据

---

### 5.2 注册RGB掌纹

**接口：** `RegisterRgbPalm`

接口请求域名：你自己的后台服务

上传 RGB 掌纹图片创建掌纹并绑定到指定用户。

#### 请求

```http
POST /palm/your-own-server/register_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| 参数 | 必选 | 类型 | 描述 |
|------|------|------|------|
| UserId | 是 | String | 用户唯一标识 |
| RgbImage | 是 | Image | RGB 图片数据，Data 和 ImageType 必填 |
| IsForce | 否 | Boolean | 是否强制换绑（用户已存在掌纹时是否覆盖） |

#### 响应

| 参数 | 类型 | 描述 |
|------|------|------|
| PalmId | String | 用户的掌纹 ID。若用户已绑定掌纹，系统自动更新现有掌纹数据（原 PalmId 保持不变） |

#### 示例

**请求：**

```json
{
  "UserId": "user001",
  "RgbImage": {
    "Data": "base64编码的图片数据",
    "ImageType": 1
  },
  "IsForce": false
}
```

**响应：**

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "4d5912a82af144f8a982c2da031c1035",
  "data": {
    "PalmId": "your_palm_id"
  }
}
```

---

### 5.3 比对RGB掌纹

**接口：** `CompareRgbPalm`

接口请求域名：你自己的后台服务

上传 RGB 掌纹图片与指定用户进行 1:1 比对。

#### 请求

```http
POST /palm/your-own-server/compare_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| 参数 | 必选 | 类型 | 描述 |
|------|------|------|------|
| RgbImage | 是 | Image | RGB 图片数据，Data 和 ImageType 必填 |
| CompareUserId | 是 | String | 待对比的用户 ID |

#### 响应

| 参数 | 类型 | 描述 |
|------|------|------|
| IsMatch | Boolean | 是否匹配 |
| Score | Integer | 相似度，百分制（0-100） |
| AlgorithmVersion | String | 算法版本号 |
| PalmDirection | PalmDirectionType | 手掌方向 |

#### 示例

**请求：**

```json
{
  "RgbImage": {
    "Data": "base64编码的图片数据",
    "ImageType": 1
  },
  "CompareUserId": "user001"
}
```

**响应：**

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

### 5.4 检索RGB掌纹

**接口：** `SearchRgbPalm`

接口请求域名：你自己的后台服务

上传 RGB 掌纹图片在库中进行 1:N 检索，匹配已注册用户。

#### 请求

```http
POST /palm/your-own-server/search_rgb_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| 参数 | 必选 | 类型 | 描述 |
|------|------|------|------|
| RgbImage | 是 | Image | RGB 图片数据 |

#### 响应

| 参数 | 类型 | 描述 |
|------|------|------|
| UserId | String | 匹配到的用户唯一标识 |
| Score | Integer | 相似度，百分制（0-100） |
| AlgorithmVersion | String | 算法版本号 |
| PalmDirection | PalmDirectionType | 手掌方向 |

#### 示例

**请求：**

```json
{
  "RgbImage": {
    "Data": "base64编码的图片数据",
    "ImageType": 1
  }
}
```

**响应：**

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

### 5.5 删除掌纹

**接口：** `DeletePalm`

接口请求域名：你自己的后台服务

删除指定用户的掌纹信息。

#### 请求

```http
POST /palm/your-own-server/delete_palm HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer {your_api_token}
```

| 参数 | 必选 | 类型 | 描述 |
|------|------|------|------|
| UserId | 是 | String | 用户唯一标识 |
| PalmDirectionList | 是 | Array of PalmDirectionType | 要删除的手掌方向列表（可同时传入左手和右手） |

#### 响应

无业务数据。

#### 示例

**请求：**

```json
{
  "UserId": "user001",
  "PalmDirectionList": [1, 2]
}
```

**响应：**

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "4d5912a82af144f8a982c2da031c1035",
  "data": {}
}
```

---

## 6. 错误码

当响应中存在 `code` 字段且值非 `0` 时，表示调用失败。

| 错误码 | 说明 |
|--------|------|
| 1000000 | 参数错误（参数格式、类型等不合法） |
| 1000001 | 系统内部错误 |
| 1000002 | 缺少必传参数 |
| 1000003 | 回调事件处理失败 |
| 1000004 | Filters 参数数量超过限制 |
| 1000005 | 分页参数超过限制 |
| 1001001 | 没有可用的版本 |
| 1001002 | 未知的图片类型 |
| 1001003 | 图片 MD5 不一致 |
| 1001004 | 活体检测未通过 |
| 1001005 | 质量检测未通过 |
| 1001006 | 视频活体检测未通过 |
| 1001007 | PalmId 不存在，请重新录入掌纹 |
| 1001008 | 已经绑定 |
| 1001009 | PalmId 可能已被他人绑定（错误绑定） |
| 1001011 | 第三方鉴权失败 |
| 1001012 | 数据库中未查询到数据 |
| 1001013 | 在掌纹检索库中未匹配到用户 |
| 1001014 | 辅助图片不存在 |
| 1001015 | 未知的验证类型 |
| 1001016 | 系统容量已满 |
| 1001017 | 用户辅助图片数量超限 |
| 1001018 | 验证用的 UserId 不匹配 |
| 1001019 | 验证 ID 已过期 |
| 1001020 | PalmId 已存在 |
| 1001021 | 存在高相似度的手掌 |
| 1001022 | 用户掌纹库容量已达上限 |
| 1001023 | 数据库操作失败 / 用户已被删除 |
| 1001024 | 用户在数据库中不存在 |
| 1001025 | 用户指定手掌方向对应的掌纹不存在 |
| 1001026 | 数据库并发操作冲突，请重试 |
| 1001027 | 掌纹已存在 |
| 1001028 | 待插入特征的当前同步索引已存在 |
| 1001029 | 掌库特征配额超限 |
| 1001030 | 平台未授权相关功能 |
| 1001031 | 掌库配额不能低于当前已使用量 |
| 1001032 | 应用不存在 |
| 1001033 | 应用已存在 |

---

## 7. 术语表

| 术语 | 说明 |
|------|------|
| RGB | 彩色图片 |
| 三点 | 图片检测配准后输出的坐标点数据 |
| PalmId | 掌纹唯一标识 |
| UserId | 用户唯一标识 |
