import { addressConfig, Config } from '../config/config';
import axios from 'axios';
import { HandledJob } from 'virtual-printer';
import { FileInformation } from '../ipp-server/create-ipp-server';

export async function sendRemote(
  handledJob: HandledJob,
  fileInformation: FileInformation,
  data: Buffer,
) {
  await registerDoc(handledJob, fileInformation);
  await sendPrnFile(fileInformation, data);
}

function registerDoc(handledJob: HandledJob, fileInformation: FileInformation) {
  const body = {
    nonmember_id: fileInformation.nickname,
    franchise: Config.service.franchise_id,
    pc_mac: addressConfig.macAddress,
    docs: [
      {
        doc_name: handledJob['job-name'],
        queue_id: fileInformation.queueId,
        pc_id: addressConfig.ipAddress,
        pages: [
          {
            size: 'A4',
            color: 0,
            cnt: fileInformation.length,
          },
        ],
      },
    ],
  };
  console.log(handledJob, body);
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

async function sendPrnFile(fileInformation: FileInformation, data: Buffer) {
  if (Config.debug) {
    console.log(fileInformation);
  }
  await axios.post(Config.service.upload_bin_url, data, {
    headers: {
      'Content-Type': 'application/X-binary',
      'Content-Disposition': `attachment;filename=${fileInformation.queueId}.prn`,
    },
  });
}
