import { addressConfig, Config } from '../config/config';
import axios from 'axios';
import { ProcessingJob, processingQueue } from '../temp-db/processing-queue';

export async function sendRemote(processingJob: ProcessingJob, buffer: Buffer) {
  await registerDoc(processingJob);
  await sendPrnFile(processingJob, buffer).then(() => {
    processingQueue.removeJob(processingJob.queueId);
  });
}

function registerDoc(processingJob: ProcessingJob) {
  const body = {
    nonmember_id: processingJob.nickname,
    franchise: Config.service.franchise_id,
    pc_mac: addressConfig.macAddress,
    docs: [
      {
        doc_name: processingJob.jobName,
        queue_id: processingJob.queueId,
        pc_id: addressConfig.ipAddress,
        pages: [
          {
            size: 'A4',
            color: 0,
            cnt: processingJob.length,
          },
        ],
      },
    ],
  };
  return axios.post(
    'http://u-printon.canon-bs.co.kr:62301/nologin/regist_doc/',
    JSON.stringify(body),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

async function sendPrnFile(processingJob: ProcessingJob, buffer: Buffer) {
  await axios.post(Config.service.upload_bin_url, buffer, {
    headers: {
      'Content-Type': 'application/X-binary',
      'Content-Disposition': `attachment;filename=${processingJob.queueId}.prn`,
    },
  });
}
