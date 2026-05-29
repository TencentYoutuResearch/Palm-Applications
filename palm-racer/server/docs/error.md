# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [api/protoapi-spec/sea-palm-racer/v1/error.proto](#api_protoapi-spec_sea-palm-racer_v1_error-proto)
    - [SeaPalmRacerReasonEnum](#sea-api-seapalmracer-SeaPalmRacerReasonEnum)
  
    - [SeaPalmRacerReasonEnum.SeaPalmRacerReason](#sea-api-seapalmracer-SeaPalmRacerReasonEnum-SeaPalmRacerReason)
  
- [Scalar Value Types](#scalar-value-types)



<a name="api_protoapi-spec_sea-palm-racer_v1_error-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/protoapi-spec/sea-palm-racer/v1/error.proto



<a name="sea-api-seapalmracer-SeaPalmRacerReasonEnum"></a>

### SeaPalmRacerReasonEnum






 


<a name="sea-api-seapalmracer-SeaPalmRacerReasonEnum-SeaPalmRacerReason"></a>

### SeaPalmRacerReasonEnum.SeaPalmRacerReason


| Name | Number | Description |
| ---- | ------ | ----------- |
| OK | 0 |  |
| CANCELLED | 1 |  |
| UNKNOWN | 2 |  |
| INVALID_ARGUMENT | 3 |  |
| DEADLINE_EXCEEDED | 4 |  |
| NOT_FOUND | 5 |  |
| ALREADY_EXISTS | 6 |  |
| PERMISSION_DENIED | 7 |  |
| UNAUTHENTICATED | 16 |  |
| RESOURCE_EXHAUSTED | 8 |  |
| FAILED_PRECONDITION | 9 |  |
| ABORTED | 10 |  |
| OUT_OF_RANGE | 11 |  |
| UNIMPLEMENTED | 12 |  |
| INTERNAL | 13 |  |
| UNAVAILABLE | 14 |  |
| DATA_LOSS | 15 |  |
| InvalidParameter | 1000 | 业务错误码 |
| DatabaseError | 1001 |  |
| PalmProxyError | 1002 |  |
| TokenExpired | 1003 |  |


 

 

 



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

