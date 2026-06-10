declare module "aliyun-nls-filetrans" {
  type ClientConfig = {
    accessKeyId: string;
    accessKeySecret: string;
    endpoint: string;
    apiVersion: string;
  };

  export default class FileTransClient {
    constructor(config: ClientConfig);
    submitTask(params: { Task: string }, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
    getTaskResult(params: { TaskId: string }, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  }
}
