import crypto from "node:crypto";

type RpcRequest = {
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  params: Record<string, string>;
};

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

export async function callAliyunRpc({ endpoint, accessKeyId, accessKeySecret, params }: RpcRequest) {
  const commonParams: Record<string, string> = {
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    AccessKeyId: accessKeyId,
    Timestamp: new Date().toISOString(),
    ...params
  };

  const canonicalizedQuery = Object.keys(commonParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(commonParams[key])}`)
    .join("&");
  const stringToSign = `POST&%2F&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");
  const body = `${canonicalizedQuery}&Signature=${percentEncode(signature)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    signal: AbortSignal.timeout(30_000)
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const detail =
      json && typeof json === "object"
        ? JSON.stringify({
            Code: (json as Record<string, unknown>).Code,
            Message: (json as Record<string, unknown>).Message,
            RequestId: (json as Record<string, unknown>).RequestId
          })
        : "";
    throw new Error(`Aliyun RPC request failed ${response.status} ${detail}`.trim());
  }
  return json;
}
