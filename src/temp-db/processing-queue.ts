import { v4 } from 'uuid';

export enum JobStatus {
  'INITIAL_JOB_PARSING',
  'CONVERT_PRINT_FILE',
  'SEND_REMOTE',
  'END',
}

export class ProcessingJob {
  constructor(
    public jobName: string,
    public nickname: string,
    public length: number,
  ) {}

  public queueId = v4();
  public createdAt = new Date();
  public jobStatus: JobStatus = JobStatus.INITIAL_JOB_PARSING;
}

class ProcessingQueue {
  public queue: Record<string, ProcessingJob> = {};
  public createdAt = new Date();
  public clearedAt = new Date();
  public completed: string[] = [];

  public getJob(queueId: string) {
    return this.queue[queueId];
  }

  public addJob(processingJob: ProcessingJob) {
    this.queue[processingJob.queueId] = processingJob;
    return processingJob.queueId;
  }

  public changeJobStatus(queueId: string, jobStatus: JobStatus) {
    this.queue[queueId].jobStatus = jobStatus;
  }

  public removeJob(queueId: string) {
    this.changeJobStatus(queueId, JobStatus.END);
    this.completed.push(queueId);
    if (Date.now() - this.clearedAt.valueOf() > 24 * 60 * 60 * 1000) {
      this.completed.forEach((queueId) => {
        delete this.queue[queueId];
      });
      this.completed = [];
      this.clearedAt = new Date();
    }
  }
}

export const processingQueue = new ProcessingQueue();
