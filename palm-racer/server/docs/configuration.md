# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [api/protoapi-spec/sea-palm-racer/v1/configuration.proto](#api_protoapi-spec_sea-palm-racer_v1_configuration-proto)
    - [Configuration](#sea-api-seapalmracer-Configuration)
    - [Configuration.AppVersion](#sea-api-seapalmracer-Configuration-AppVersion)
    - [Configuration.Auth](#sea-api-seapalmracer-Configuration-Auth)
    - [Configuration.Features](#sea-api-seapalmracer-Configuration-Features)
    - [Configuration.Palm](#sea-api-seapalmracer-Configuration-Palm)
  
- [Scalar Value Types](#scalar-value-types)



<a name="api_protoapi-spec_sea-palm-racer_v1_configuration-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/protoapi-spec/sea-palm-racer/v1/configuration.proto



<a name="sea-api-seapalmracer-Configuration"></a>

### Configuration
config file yaml


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| palm | [Configuration.Palm](#sea-api-seapalmracer-Configuration-Palm) |  | 刷掌平台 API 配置 |
| app_version | [Configuration.AppVersion](#sea-api-seapalmracer-Configuration-AppVersion) |  | App 版本管理配置 |
| features | [Configuration.Features](#sea-api-seapalmracer-Configuration-Features) |  | 功能开关配置 |
| auth | [Configuration.Auth](#sea-api-seapalmracer-Configuration-Auth) |  | 计分鉴权配置（身份 token 与单局 session） |






<a name="sea-api-seapalmracer-Configuration-AppVersion"></a>

### Configuration.AppVersion
App 版本管理配置，用于控制客户端升级策略


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| version | [string](#string) |  | 最新版本号（如 &#34;1.0.0&#34;），客户端通过语义化版本号比较判断是否需要升级 |
| download_url | [string](#string) |  | APK 下载链接 |
| force_update | [bool](#bool) |  | 是否强制更新（true 时客户端必须升级才能继续使用） |
| changelog | [string](#string) |  | 更新日志 |






<a name="sea-api-seapalmracer-Configuration-Auth"></a>

### Configuration.Auth
计分鉴权配置


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| jwt_secret | [string](#string) |  | 身份 token 的 HMAC-SHA256 签名密钥（至少 32 字节）；可由环境变量 JWT_SECRET 覆盖 |
| token_ttl_seconds | [int32](#int32) |  | 身份 token 有效期秒数：&gt; 0 显式有限有效期；0 表示未配置，使用默认 7 天； &lt; 0 表示永不过期（仅限长期 demo 等可控场景，token 无法撤销，泄露风险高）。 |
| session_ttl_seconds | [int32](#int32) |  | 单局 session 存活秒数（应覆盖单局最大时长 &#43; 缓冲） |






<a name="sea-api-seapalmracer-Configuration-Features"></a>

### Configuration.Features
功能开关配置


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| guest_mode | [bool](#bool) |  | 是否启用游客模式（前端登录页展示游客按钮） |






<a name="sea-api-seapalmracer-Configuration-Palm"></a>

### Configuration.Palm



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| app_id | [int32](#int32) |  |  |
| secret_id | [string](#string) |  |  |
| secret_key | [string](#string) |  |  |
| host | [string](#string) |  |  |
| base_url | [string](#string) |  |  |
| version | [string](#string) |  |  |





 

 

 

 



## Scalar Value Types

| .proto Type | Notes | C++ | Java | Python | Go | C# | PHP | Ruby |
| ----------- | ----- | --- | ---- | ------ | -- | -- | --- | ---- |
| <a name="double" /> double |  | double | double | float | float64 | double | float | Float |
| <a name="float" /> float |  | float | float | float | float32 | float | float | Float |
| <a name="int32" /> int32 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint32 instead. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="int64" /> int64 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint64 instead. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="uint32" /> uint32 | Uses variable-length encoding. | uint32 | int | int/long | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="uint64" /> uint64 | Uses variable-length encoding. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum or Fixnum (as required) |
| <a name="sint32" /> sint32 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int32s. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sint64" /> sint64 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int64s. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="fixed32" /> fixed32 | Always four bytes. More efficient than uint32 if values are often greater than 2^28. | uint32 | int | int | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="fixed64" /> fixed64 | Always eight bytes. More efficient than uint64 if values are often greater than 2^56. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum |
| <a name="sfixed32" /> sfixed32 | Always four bytes. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sfixed64" /> sfixed64 | Always eight bytes. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="bool" /> bool |  | bool | boolean | boolean | bool | bool | boolean | TrueClass/FalseClass |
| <a name="string" /> string | A string must always contain UTF-8 encoded or 7-bit ASCII text. | string | String | str/unicode | string | string | string | String (UTF-8) |
| <a name="bytes" /> bytes | May contain any arbitrary sequence of bytes. | string | ByteString | str | []byte | ByteString | string | String (ASCII-8BIT) |

