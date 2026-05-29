# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [api/protoapi-spec/sea-palm-racer/v1/api.proto](#api_protoapi-spec_sea-palm-racer_v1_api-proto)
    - [AppVersionData](#sea-api-seapalmracer-AppVersionData)
    - [CreateTokenData](#sea-api-seapalmracer-CreateTokenData)
    - [CreateTokenError](#sea-api-seapalmracer-CreateTokenError)
    - [CreateTokenRequest](#sea-api-seapalmracer-CreateTokenRequest)
    - [CreateTokenResponse](#sea-api-seapalmracer-CreateTokenResponse)
    - [GetAppVersionRequest](#sea-api-seapalmracer-GetAppVersionRequest)
    - [GetAppVersionResponse](#sea-api-seapalmracer-GetAppVersionResponse)
    - [GetLeaderboardRequest](#sea-api-seapalmracer-GetLeaderboardRequest)
    - [GetLeaderboardResponse](#sea-api-seapalmracer-GetLeaderboardResponse)
    - [GetUserHistoryRequest](#sea-api-seapalmracer-GetUserHistoryRequest)
    - [GetUserHistoryResponse](#sea-api-seapalmracer-GetUserHistoryResponse)
    - [HistoryEntry](#sea-api-seapalmracer-HistoryEntry)
    - [LeaderboardData](#sea-api-seapalmracer-LeaderboardData)
    - [LeaderboardEntry](#sea-api-seapalmracer-LeaderboardEntry)
    - [RegisterRgbPalmData](#sea-api-seapalmracer-RegisterRgbPalmData)
    - [RegisterRgbPalmRequest](#sea-api-seapalmracer-RegisterRgbPalmRequest)
    - [RegisterRgbPalmResponse](#sea-api-seapalmracer-RegisterRgbPalmResponse)
    - [RgbImageInfo](#sea-api-seapalmracer-RgbImageInfo)
    - [SearchRgbPalmData](#sea-api-seapalmracer-SearchRgbPalmData)
    - [SearchRgbPalmRequest](#sea-api-seapalmracer-SearchRgbPalmRequest)
    - [SearchRgbPalmResponse](#sea-api-seapalmracer-SearchRgbPalmResponse)
    - [SubmitScoreRequest](#sea-api-seapalmracer-SubmitScoreRequest)
    - [SubmitScoreResponse](#sea-api-seapalmracer-SubmitScoreResponse)
    - [UserHistoryData](#sea-api-seapalmracer-UserHistoryData)
    - [UserHistoryStats](#sea-api-seapalmracer-UserHistoryStats)
  
    - [SeaPalmRacerService](#sea-api-seapalmracer-SeaPalmRacerService)
  
- [Scalar Value Types](#scalar-value-types)



<a name="api_protoapi-spec_sea-palm-racer_v1_api-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/protoapi-spec/sea-palm-racer/v1/api.proto



<a name="sea-api-seapalmracer-AppVersionData"></a>

### AppVersionData
App 版本信息


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| version | [string](#string) |  | 最新版本号（如 &#34;1.1.0&#34;），客户端通过语义化版本号比较判断是否需要升级 |
| download_url | [string](#string) |  | APK 下载链接 |
| force_update | [bool](#bool) |  | 是否强制更新（true 时客户端必须升级才能继续使用） |
| changelog | [string](#string) |  | 更新日志 |






<a name="sea-api-seapalmracer-CreateTokenData"></a>

### CreateTokenData
创建 AccessToken 响应数据


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_token | [string](#string) |  |  |
| expires_in | [int64](#int64) |  |  |






<a name="sea-api-seapalmracer-CreateTokenError"></a>

### CreateTokenError
创建 AccessToken 错误信息


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [string](#string) |  |  |
| message | [string](#string) |  |  |






<a name="sea-api-seapalmracer-CreateTokenRequest"></a>

### CreateTokenRequest
创建 AccessToken 请求


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| grant_type | [string](#string) |  |  |
| user_id | [string](#string) |  |  |






<a name="sea-api-seapalmracer-CreateTokenResponse"></a>

### CreateTokenResponse
创建 AccessToken 响应（结构化字段，适配前端和 app 侧解析）


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| response | [CreateTokenData](#sea-api-seapalmracer-CreateTokenData) |  |  |
| error | [CreateTokenError](#sea-api-seapalmracer-CreateTokenError) |  | 兼容刷掌平台 Error 包裹格式 |






<a name="sea-api-seapalmracer-GetAppVersionRequest"></a>

### GetAppVersionRequest
获取 App 最新版本请求


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| platform | [string](#string) |  | 客户端当前平台（android / ios） |
| current_version | [string](#string) |  | 客户端当前版本号（如 &#34;1.0.0&#34;），服务端通过比较版本号判断是否需要升级 |






<a name="sea-api-seapalmracer-GetAppVersionResponse"></a>

### GetAppVersionResponse
获取 App 最新版本响应


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [int32](#int32) |  |  |
| message | [string](#string) |  |  |
| data | [AppVersionData](#sea-api-seapalmracer-AppVersionData) |  |  |






<a name="sea-api-seapalmracer-GetLeaderboardRequest"></a>

### GetLeaderboardRequest
排行榜请求


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| period | [string](#string) |  | today / week / all |
| limit | [int32](#int32) |  | 每页条数，默认 50，最大 100。与 offset 配合实现分页查询。 |
| user_id | [string](#string) |  | 当前登录用户 ID。传入后服务端在响应的 my_rank 字段返回该用户的全局排名条目（不在 Top N 内也会返回）。 传空字符串则不计算 my_rank。 |
| offset | [int32](#int32) |  | 分页偏移量，默认 0。与 limit 配合实现分页查询。 |






<a name="sea-api-seapalmracer-GetLeaderboardResponse"></a>

### GetLeaderboardResponse
排行榜响应


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [int32](#int32) |  |  |
| message | [string](#string) |  |  |
| data | [LeaderboardData](#sea-api-seapalmracer-LeaderboardData) |  |  |






<a name="sea-api-seapalmracer-GetUserHistoryRequest"></a>

### GetUserHistoryRequest
用户历史成绩请求


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |
| offset | [int64](#int64) |  | 偏移量，默认 0 |
| limit | [int32](#int32) |  | 每页数量，默认 20，最大 100 |






<a name="sea-api-seapalmracer-GetUserHistoryResponse"></a>

### GetUserHistoryResponse
用户历史成绩响应


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [int32](#int32) |  |  |
| message | [string](#string) |  |  |
| data | [UserHistoryData](#sea-api-seapalmracer-UserHistoryData) |  |  |






<a name="sea-api-seapalmracer-HistoryEntry"></a>

### HistoryEntry
历史成绩条目


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| index | [int32](#int32) |  |  |
| user_id | [string](#string) |  |  |
| user_name | [string](#string) |  |  |
| score | [int32](#int32) |  |  |
| max_speed | [double](#double) |  |  |
| survive_time | [double](#double) |  |  |
| cheated | [bool](#bool) |  |  |
| timestamp | [int64](#int64) |  |  |
| cheat_user_id | [string](#string) |  | 替玩用户ID |






<a name="sea-api-seapalmracer-LeaderboardData"></a>

### LeaderboardData



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| list | [LeaderboardEntry](#sea-api-seapalmracer-LeaderboardEntry) | repeated |  |
| total | [int32](#int32) |  | 去重后的排行榜总条数（用于前端计算总页数）。 受 period 上限约束：all 最大 500、today 最大 20、week 最大 50。 |
| my_rank | [LeaderboardEntry](#sea-api-seapalmracer-LeaderboardEntry) |  | 当前登录用户的全局排名条目（请求传 user_id 时返回）。 不在 Top N 里时，rank 为真实名次；用户在该 period 无成绩时 rank=0。 |






<a name="sea-api-seapalmracer-LeaderboardEntry"></a>

### LeaderboardEntry
排行榜条目


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| rank | [int32](#int32) |  |  |
| user_id | [string](#string) |  |  |
| user_name | [string](#string) |  |  |
| score | [int32](#int32) |  |  |
| max_speed | [double](#double) |  |  |
| survive_time | [double](#double) |  |  |
| cheated | [bool](#bool) |  |  |
| timestamp | [int64](#int64) |  |  |
| cheat_user_id | [string](#string) |  | 替玩用户ID |






<a name="sea-api-seapalmracer-RegisterRgbPalmData"></a>

### RegisterRgbPalmData
注册 RGB 手掌响应数据


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| palm_id | [string](#string) |  | 用户的掌纹 ID（游戏侧一般不关心，仅作透传便于排障） |






<a name="sea-api-seapalmracer-RegisterRgbPalmRequest"></a>

### RegisterRgbPalmRequest
注册 RGB 手掌请求（字段与 RegisterRgbPalm 对齐）


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| user_id | [string](#string) |  | 用户唯一标识 |
| rgb_image | [RgbImageInfo](#sea-api-seapalmracer-RgbImageInfo) |  | RGB 手掌图片信息 |
| is_force | [bool](#bool) |  | 是否强制换绑（业务使用时传 false） |
| user_token | [string](#string) |  | 用户 Token（可选，非空则对图片数据加密） |






<a name="sea-api-seapalmracer-RegisterRgbPalmResponse"></a>

### RegisterRgbPalmResponse
注册 RGB 手掌响应（结构化字段，适配前端和 app 侧解析）


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [int32](#int32) |  |  |
| message | [string](#string) |  |  |
| data | [RegisterRgbPalmData](#sea-api-seapalmracer-RegisterRgbPalmData) |  |  |






<a name="sea-api-seapalmracer-RgbImageInfo"></a>

### RgbImageInfo
RGB 手掌图片信息（全部基础类型，避免 Struct 循环引用导致框架 truncate 栈溢出）


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| data | [string](#string) |  | base64 编码的图片数据 |
| image_type | [int32](#int32) |  | 图片类型（1=RGB） |
| data_digest | [string](#string) |  | 图片数据的 MD5 摘要 |






<a name="sea-api-seapalmracer-SearchRgbPalmData"></a>

### SearchRgbPalmData
搜索 RGB 手掌响应数据


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| score | [double](#double) |  |  |
| algorithm_version | [string](#string) |  |  |
| palm_direction | [int32](#int32) |  |  |






<a name="sea-api-seapalmracer-SearchRgbPalmRequest"></a>

### SearchRgbPalmRequest
搜索 RGB 手掌请求（字段与前端直接对齐，无需 payload 包裹）


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| rgb_image | [RgbImageInfo](#sea-api-seapalmracer-RgbImageInfo) |  | RGB 手掌图片信息 |
| sdk_version | [string](#string) |  | SDK 版本号 |
| sdk_timestamps | [string](#string) |  | SDK 时间戳 JSON 字符串 |
| user_token | [string](#string) |  | 用户 Token |
| user_id | [string](#string) |  | 用户 ID（可选） |






<a name="sea-api-seapalmracer-SearchRgbPalmResponse"></a>

### SearchRgbPalmResponse
搜索 RGB 手掌响应（结构化字段，适配前端和 app 侧解析）


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [int32](#int32) |  |  |
| message | [string](#string) |  |  |
| data | [SearchRgbPalmData](#sea-api-seapalmracer-SearchRgbPalmData) |  |  |






<a name="sea-api-seapalmracer-SubmitScoreRequest"></a>

### SubmitScoreRequest
提交分数请求


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| request_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |
| user_name | [string](#string) |  |  |
| score | [int32](#int32) |  |  |
| max_speed | [double](#double) |  |  |
| survive_time | [double](#double) |  |  |
| cheated | [bool](#bool) |  |  |
| cheat_user_id | [string](#string) |  | 替玩用户ID（多个不同替玩用户以最后1个为准） |






<a name="sea-api-seapalmracer-SubmitScoreResponse"></a>

### SubmitScoreResponse
提交分数响应


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| code | [int32](#int32) |  |  |
| message | [string](#string) |  |  |






<a name="sea-api-seapalmracer-UserHistoryData"></a>

### UserHistoryData



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| list | [HistoryEntry](#sea-api-seapalmracer-HistoryEntry) | repeated |  |
| total | [int32](#int32) |  |  |
| stats | [UserHistoryStats](#sea-api-seapalmracer-UserHistoryStats) |  | 用户历史全量聚合统计（不受分页影响） |






<a name="sea-api-seapalmracer-UserHistoryStats"></a>

### UserHistoryStats
用户历史全量聚合统计


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| best_score | [int32](#int32) |  | 非作弊最高分 |
| total_games | [int32](#int32) |  | 总场次 |
| cheat_count | [int32](#int32) |  | 作弊场次 |





 

 

 


<a name="sea-api-seapalmracer-SeaPalmRacerService"></a>

### SeaPalmRacerService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| SubmitScore | [SubmitScoreRequest](#sea-api-seapalmracer-SubmitScoreRequest) | [SubmitScoreResponse](#sea-api-seapalmracer-SubmitScoreResponse) | 游戏分数管理 |
| GetLeaderboard | [GetLeaderboardRequest](#sea-api-seapalmracer-GetLeaderboardRequest) | [GetLeaderboardResponse](#sea-api-seapalmracer-GetLeaderboardResponse) |  |
| GetUserHistory | [GetUserHistoryRequest](#sea-api-seapalmracer-GetUserHistoryRequest) | [GetUserHistoryResponse](#sea-api-seapalmracer-GetUserHistoryResponse) |  |
| CreateToken | [CreateTokenRequest](#sea-api-seapalmracer-CreateTokenRequest) | [CreateTokenResponse](#sea-api-seapalmracer-CreateTokenResponse) | 刷掌平台 API 代理 |
| SearchRgbPalm | [SearchRgbPalmRequest](#sea-api-seapalmracer-SearchRgbPalmRequest) | [SearchRgbPalmResponse](#sea-api-seapalmracer-SearchRgbPalmResponse) |  |
| RegisterRgbPalm | [RegisterRgbPalmRequest](#sea-api-seapalmracer-RegisterRgbPalmRequest) | [RegisterRgbPalmResponse](#sea-api-seapalmracer-RegisterRgbPalmResponse) |  |
| GetAppVersion | [GetAppVersionRequest](#sea-api-seapalmracer-GetAppVersionRequest) | [GetAppVersionResponse](#sea-api-seapalmracer-GetAppVersionResponse) | App 版本管理 |

 



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

