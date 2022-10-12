import { Config } from '../config/config';
import { HandledJob, Printer } from 'virtual-printer';
import { execSync } from 'child_process';
import { sendRemote } from '../send-remote/send-remote';
import {
  JobStatus,
  ProcessingJob,
  processingQueue,
} from '../temp-db/processing-queue';
import { resolve } from 'path';
import fastifyView from '@fastify/view';
import mustache from 'mustache';
import { printDirect } from '@grandchef/node-printer';

type FileType = 'PDF' | 'POSTSCRIPT';

function printFileToCupsPrinter(
  handledJob: HandledJob,
  nickname: string,
  buffer: Buffer,
  fileType: FileType,
) {
  const length = (
    execSync('gs -q -o - -sDEVICE=inkcov -_', {
      stdio: 'pipe',
      input: buffer,
    })
      .toString()
      .match(/ok/gi) || [1]
  ).length;
  const queueId = processingQueue.addJob(
    new ProcessingJob(handledJob['job-name'], nickname, length),
  );
  printDirect({
    data: buffer,
    type: fileType,
    printer: Config.printer.filter_printer_name,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    docname: queueId,
    options: {
      CNDuplex: 'none',
    },
  });
  return processingQueue.changeJobStatus(queueId, JobStatus.CONVERT_PRINT_FILE);
}

export function createIppServer() {
  const frontPrinter = new Printer({
    name: Config.printer.front_printer_name,
    description: Config.printer.front_printer_name,
    bonjour: false,
    format: ['application/postscript', 'application/pdf'],
    serverUrl: new URL(Config.printer.front_printer_server_url),
  });

  frontPrinter.on('server-opened', (error) =>
    !error ? null : console.error(error),
  );

  frontPrinter.on('data', (handledJob, _, request) => {
    let nicknameFromUrl = request.url;
    nicknameFromUrl = nicknameFromUrl.split('?')[0];
    nicknameFromUrl =
      nicknameFromUrl
        .split('/')
        .filter((v) => v.length !== 0)
        .pop() || '';
    if (nicknameFromUrl.length < 4 || isNaN(Number(nicknameFromUrl))) {
      return true;
    }
    let buffer = request.body as Buffer;
    // check it is pdf (end_byte 03 %PDF- 255044462d)
    let index = buffer.indexOf('03255044462d', 0, 'hex') + 1;
    if (index > 0) {
      buffer = buffer.subarray(index);
      return printFileToCupsPrinter(handledJob, nicknameFromUrl, buffer, 'PDF');
    }
    // check it is postscript (end_byte 03 %!PS- 252150532d)
    index = buffer.indexOf('03252150532d', 0, 'hex') + 1;
    if (index > 0) {
      buffer = buffer.subarray(index);
      return printFileToCupsPrinter(
        handledJob,
        nicknameFromUrl,
        buffer,
        'POSTSCRIPT',
      );
    }
  });

  frontPrinter.server.register(fastifyView, {
    engine: { mustache },
    root: resolve('views/'), // Points to `./views` relative to the current file
    viewExt: 'mustache', // Sets the default extension to `.handlebars`
  });

  frontPrinter.server.get('*', (request, reply) => {
    reply.view('index.mustache', {
      queue: Object.values(processingQueue.queue).map((v) => ({
        ...v,
        nickname: '********' + v.nickname.slice(v.nickname.length - 3),
        jobStatus: JobStatus[v.jobStatus],
      })),
      createdAt: processingQueue.createdAt,
      completed: processingQueue.completed,
    });
  });

  const filterPrinter = new Printer({
    name: Config.printer.filter_printer_name,
    description: Config.printer.filter_printer_name,
    bonjour: false,
    serverUrl: new URL(Config.printer.filter_printer_server_url),
    format: ['application/postscript', 'application/pdf'],
  });

  filterPrinter.on('data', (handledJob, _, request) => {
    const processingJob = processingQueue.getJob(
      handledJob['job-name']
        .trim()
        .slice(
          handledJob['job-name'].length - 36,
          handledJob['job-name'].length,
        ),
    );
    let buffer = request.body as Buffer;
    // check it is rasterized with ufr (end_byte 03 ufr_start_byte cdca101000)
    const index = buffer.indexOf('03cdca101000', 0, 'hex') + 1;
    if (processingJob && index > 0) {
      buffer = buffer.subarray(index);
      processingQueue.changeJobStatus(
        processingJob.queueId,
        JobStatus.SEND_REMOTE,
      );
      return sendRemote(processingJob, buffer);
    }
  });
}
