import util from 'util';
import AnsiToHtml from 'ansi-to-html';
import fs from 'fs';
import { max } from 'underscore';

/// Adapter for Node JS Server that use console.log().
/// provides capabilities to make logged information available as HTML Content.
/// WARNING: Due the complexity, it is only advised to instantiate this class only once.
export class LogToHtmlAdapter {


    /// stores a Log Entry as HTML Element.
    public logs: string[] = [];

    //private lastBackup = 0;

    log = console.log;


    public constructor(public printTimestamp: boolean = true, public storageFile?: string) {
        if (storageFile) {
            this.load();
        }
    }

    load() {
        let fileToLoad = this.ensureStorageFile();
        this.logs = fs.readFileSync(fileToLoad!, 'utf-8').split("\n");
        this.log("loaded ", this.logs.length, " lines.");
    }

    getStorageDir(): string {
        return 'output/watchdog/';
    }

    ensureStorageFile() {

        if (!this.storageFile) {
            return undefined;
        }

        const dir = this.getStorageDir();

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const path = dir + this.storageFile;

        fs.existsSync(path) || fs.writeFileSync(path, "");

        return path;

    }

    getLogsAsHTMLElements(maxLogs: number | undefined): string {

        let logsToPrint: string[] = [];

        if (maxLogs) {
            //logsToPrint =
            logsToPrint = this.logs.length < maxLogs ? this.logs : this.logs.slice(this.logs.length - maxLogs);

        } else {
            logsToPrint = this.logs;
        }

        return `<pre>${logsToPrint.join('<br>')}</pre>`;
    }

    getLogsAsHTMLDocument(maxLogs: number | undefined) {

        return this.getHTMLHeader() + this.getLogsAsHTMLElements(maxLogs) + this.getHTMLFooter();
    }

    private nowPrefix() {
        if (this.printTimestamp) {
            const now = new Date(Date.now());
            return now.toISOString().split('T')[0] + " " + now.toTimeString().split(" ")[0] + ": ";
        }

        return "";
    }

    /// Injects the adapter into the NodeJS console System
    public inject() {

        const convert = new AnsiToHtml();

        const argsToLog = (...args: any[]) => {
            return args.map(arg => format(formatArg(util.inspect(arg, { depth: null, colors: true })))).join(' ');
        }

        // const logReplacement = (...args: any[]) => {

        //     const message = format(this.nowPrefix() + argsToLog(...args));
        //     this.logs.push(convert.toHtml(message));
        // };

        const storageFile = this.ensureStorageFile();

        const log = console.log;
        const error = console.error;

        const writeHtmlMessage = (html: string) => {
            if (storageFile) {
                fs.appendFile(storageFile, html + "/n", { encoding: 'utf8', flag: 'a' }, (err) => {
                    if (err) {
                        error("Could not write log to file:", err);
                    }
                });
            }
            
            this.logs.push(html);
        };

        console.log = (...args: any[]) => {

            //const moment = moment();

            let message = this.nowPrefix() + args.map(arg => format(formatArg(util.inspect(arg, { depth: null, colors: true })))).join(' ');
            message = format(message);

            writeHtmlMessage(convert.toHtml(message));
            
        };

        //console.log = logReplacement;

        console.warn = (...args: any[]) => {

            let warn = "\u001b[1;33mWARN\u001b[0m'";
            // let warn = "WARN:";
            //let message = now.toISOString().split('T')[0] + " "  + now.toTimeString().split(" ")[0] +  ": " + warn + argsToLog(args);
            let message = format(this.nowPrefix() + warn + argsToLog(...args));
            writeHtmlMessage(message);
        };

        console.error = (...args: any[]) => {

            let error = "\u001b[1;31mERROR\u001b[0m'";
            //let error = "ERROR:";
            let message = format(this.nowPrefix() + error + argsToLog(...args));
            writeHtmlMessage(message);
        };

        console.table = (data: any[]) => {

            const tableHtml = formatTable(data);
            writeHtmlMessage(tableHtml);
            this.logs.push(tableHtml);
            // originalTable.apply(console, [data]);
        };


    }



    public getHTMLHeader() {

        return `<!DOCTYPE html>
        <html>
        <head>
          <title>bit.diamond Network Status</title>
          <style type="text/css">
          body {
            color: #FFFFFF;
            background-color: #000000 }
          table, th, td {
                border: 1px solid white;
                border-collapse: collapse;
              }  
          </style>  
        </head>
        <body>`;
    }

    public getHTMLFooter() {
        return `</body></html>`;
    }

    /// clears the storage of this Instance
    public clear() {
        this.logs = [];
    }
}


/// Helper functions:


function format(input: string) {

    let result = trim(input);

    while (result.modded) {
        result = trim(result.result);
    };

    return result.result;

}

/// removes unwanted characters at the beginning.
/// returns a boolean indicating if the string was modified
function trim(input: string): { modded: boolean, result: string } {


    input = input.replace("'", "");
    input = input.replace("+\n", "<br>");

    return { modded: false, result: input };
}

/// removes unwanted characters ?
function formatArg(input: any) {

    if (typeof input === 'string') {

        // console.log(input);
        let result = trim(input);

        while (result.modded) {
            result = trim(result.result);
        };

        return result.result;
    }

    // if (Array.isArray(input)) {
    //     return input.map(formatArg);
    // }

    // if (typeof input === 'object') {
    //     const result: any = {};
    //     for (const key in input) {
    //         result[key] = formatArg(input[key]);
    //     }
    //     return result;
    // }

    return input;

}


function formatTable(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => row[header]));

    let tableHtml = '<table border="0" style="color:#ffffff"><thead><tr>';
    headers.forEach(header => {
        tableHtml += `<th>${header}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    rows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
            tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    return tableHtml;
}
