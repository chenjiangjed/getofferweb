declare module "ali-oss" {
  type ClientOptions = {
    region: string;
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    secure?: boolean;
  };

  type SignatureOptions = {
    method: "GET" | "PUT" | "POST" | "DELETE";
    expires?: number;
    [key: string]: unknown;
  };

  export default class OSS {
    constructor(options: ClientOptions);
    signatureUrl(key: string, options: SignatureOptions): string;
    put(
      key: string,
      body: Buffer,
      options?: { headers?: Record<string, string> }
    ): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  }
}
