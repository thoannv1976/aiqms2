// Dependency chỉ dùng ở prod (driver S3). KHÔNG cài ở dev để giữ image nhẹ.
// Khi triển khai prod dùng S3:
//   npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
// rồi XÓA file này để dùng type thật của SDK.
declare module "@aws-sdk/client-s3";
declare module "@aws-sdk/s3-request-presigner";
