import { Config } from '../config/config';
import { Printer } from 'virtual-printer';
import { execSync } from 'child_process';
import * as ipp from 'ipp-easyprint';
import { v4 } from 'uuid';
import { sendRemote } from '../send-remote/send-remote';

export class FileInformation {
  constructor(public nickname = '', public length = 0) {}

  public queueId = v4();
}

export function createIppServer() {
  const frontPrinter = new Printer({
    name: Config.printer.front_printer_name,
    description: Config.printer.front_printer_name,
    bonjour: false,
    format: ['application/pdf'],
    serverUrl: new URL(Config.printer.front_printer_server_url),
  });

  frontPrinter.on('server-opened', (error) =>
    !error ? null : console.error(error),
  );

  frontPrinter.on('data', (handledJob, data) => {
    const countPage = (
      execSync('gs -q -o - -sDEVICE=inkcov -_', {
        stdio: 'pipe',
        input: data,
      })
        .toString()
        .match(/ok/gi) || [1]
    ).length;
    new ipp.IPPPrinter(Config.printer.filter_printer_cups_url)
      .printFile({
        buffer: data,
        jobName: handledJob['job-name'],
        username: JSON.stringify(new FileInformation('01084680551', countPage)),
        fileType: 'application/postscript',
      })
      .catch((error) => console.error(error));
  });

  const filterPrinter = new Printer({
    name: Config.printer.filter_printer_name,
    description: Config.printer.filter_printer_name,
    bonjour: false,
    serverUrl: new URL(Config.printer.filter_printer_server_url),
    format: ['application/pdf'],
  });

  filterPrinter.on('data', (handledJob, data) => {
    let fileInformation = new FileInformation();
    try {
      fileInformation = JSON.parse(handledJob['job-originating-user-name']);
    } catch {}
    if (fileInformation.length > 0 && !!fileInformation.nickname) {
      return sendRemote(handledJob, fileInformation, data);
    }
  });
}
