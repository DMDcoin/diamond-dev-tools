
import * as fs from 'fs';



export class LogFileManager {

    
    public static getOutputDirectory() : string {

        return process.cwd() + '/output';
        //console.log('current Dir: ',  process.cwd());
    }

    public static getTransactionsFileExtensionCSV() : string {
        return '.transactions.csv';
    }

    public static getFileExtensionJSON() : string {
        return '.transactions.json';
    }

    public static getFileExtensionLog() : string {
        return '.log.txt';
    }

    public static getFileExtensionBlockInfos() : string {
        return '.blocks.csv';
    }

    public static getFileExtensionBlockNumber() : string {
        return '.blocknumber.txt';
    }


    public static getLogConfigName() : string {
        if (process.env.NODE_ENV && process.env.NODE_ENV !== '') {
            return process.env.NODE_ENV;
        } else {
            return 'output';
        }
    }

    public static ensureOutputPath() {
        if (!fs.existsSync(this.getOutputDirectory()))
        {
            fs.mkdirSync(this.getOutputDirectory());
        }
        return this.getOutputDirectory();
    }

    public static getOutputPathCSV() {
        return `${LogFileManager.getOutputDirectory()}/${LogFileManager.getLogConfigName()}${LogFileManager.getTransactionsFileExtensionCSV()}`;
    }
    
    public static getOutputPathJSON() {
        return `${LogFileManager.getOutputDirectory()}/${LogFileManager.getLogConfigName()}${LogFileManager.getFileExtensionJSON()}`;
    }

    public static getOutputPathTextLog() {
        return `${LogFileManager.getOutputDirectory()}/${LogFileManager.getLogConfigName()}${LogFileManager.getFileExtensionLog()}`;
    }

    public static getOutputPathBlock() {
        return `${LogFileManager.getOutputDirectory()}/blocks${LogFileManager.getFileExtensionBlockInfos()}`;
    }

    public static getOutputPathBlockNumber() {
        return `${LogFileManager.getOutputDirectory()}/startblockNumber${LogFileManager.getFileExtensionBlockNumber()}`;
    }

    static getOutputPathNetworkOperation(networkName: string, networkOperation: string) {
        return `${LogFileManager.getOutputDirectory()}/network_ops/${networkName} ${networkOperation}}`
    }

    static writeNetworkOperationOutput(networkName: string, networkOperation: string) {
        //const fileSuccess = this.getOutputPathNetworkOperation + "_success.txt";

        // todo: logoutput.

    }


    public static writeCSVOutput(csv: string) {
        LogFileManager.ensureOutputPath();
        fs.writeFileSync(this.getOutputPathCSV(), new Buffer(csv));
    }

    public static writeJSONOutput(json: string) {
        LogFileManager.ensureOutputPath();
        fs.writeFileSync(this.getOutputPathJSON(), new Buffer(json));
    }

    public static writeLogOutput(text: string[]) {
        const resultForFile = text.join('\n');
        LogFileManager.ensureOutputPath();
        fs.writeFileSync(this.getOutputPathTextLog(), new Buffer(resultForFile));
    }

    public static writeBlockchainOutput(text: string) {
        LogFileManager.ensureOutputPath();
        
        let outFile = this.getOutputPathBlock();
        fs.writeFileSync(outFile, text);
        console.log("writeBlockchainOutput: ", outFile);
        return outFile;
    }


    public static writeBlockNumberOutput(blockNumber: number) {
        LogFileManager.ensureOutputPath();
        fs.writeFileSync(this.getOutputPathBlockNumber(), blockNumber.toString());
    }
    
    public static writeRaw(filename: string , text: string ) {
        let directory = LogFileManager.ensureOutputPath();
        let fullPath = `${directory}/${filename}`;
        fs.writeFileSync(fullPath, text);
        return fullPath;
    }
}
