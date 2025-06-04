import { ConfigManager } from '../configManager';
import { nowFormatted } from '../utils/dateUtils';
import { executeOnRemotesFromCliArgs } from './executeOnRemotes';

async function run() {
  const filename = `log_backup_${nowFormatted()}.log`;

  console.log(`cycling current log file name to ${filename}`);

  const config = ConfigManager.getNetworkConfig();

  const baseDir = `~/${config.installDir}/`;
  executeOnRemotesFromCliArgs(`mv ${baseDir}diamond-node.log ${baseDir}${filename}`);
}

run();
