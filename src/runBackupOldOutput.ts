import * as _ from 'underscore';
import { LogFileManager } from './logFileManager';

var fs = require('fs');

var args = process.argv.slice(2);
let backupDir = '';
console.log('current Dir: ',  process.cwd());
const outPutDir = LogFileManager.getOutputDirectory();

if (args.length === 1)
{
    backupDir = outPutDir + '/' + args[0];
} else {

    const  dt = new Date();

    const dateFormated =
        `${dt.getFullYear().toString()}${(dt.getMonth()+1).toString().padStart(2, '0')}${
        dt.getDate().toString().padStart(2, '0')}${
        dt.getFullYear().toString().padStart(4, '0')}${
        dt.getHours().toString().padStart(2, '0')}${
        dt.getMinutes().toString().padStart(2, '0')}${
        dt.getSeconds().toString().padStart(2, '0')}`;

    console.log('Output Dir: ',  outPutDir);
    backupDir = outPutDir + '/' + dateFormated;
    console.log('backupDir:' + backupDir);

}

function getFilesToMove(directory: string) {

    const ls = fs.readdirSync(directory);
    // we want only move files that we create.
    const filesToMove = new Array<string>();

    for(let i = 0; i < ls.length; i++) {
        const file =  ls[i];

        if (!file.startsWith('.') //ignore all . files, we also create with this tool. we don't create . files..
            && (file.endsWith( LogFileManager.getTransactionsFileExtensionCSV())
                || file.endsWith(LogFileManager.getFileExtensionJSON())
                || file.endsWith(LogFileManager.getFileExtensionLog())
                || file.endsWith(LogFileManager.getFileExtensionBlockInfos())
                || file.endsWith(LogFileManager.getFileExtensionBlockNumber()))){
            filesToMove.push(file);
        }
    }
    return filesToMove;
}

const filesToMove = getFilesToMove(outPutDir);

if (filesToMove.length > 0) {
    fs.mkdirSync(backupDir);

    for(let i = 0; i < filesToMove.length; i++) {
        const fileToMove = filesToMove[i];
        const oldPath = `${outPutDir}/${fileToMove}`;
        const newPath = `${backupDir}/${fileToMove}`;
        console.log(`renaming: ${oldPath} -> ${newPath}`);
        fs.renameSync(oldPath, newPath);
    }
    console.log(`Backed up old CSV Files to ${backupDir}`);
} else {
    console.log(`Nothing found to backup.`);
}




