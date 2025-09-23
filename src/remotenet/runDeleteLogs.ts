import { ConfigManager } from '../configManager';
import { executeOnRemotesFromCliArgs } from './executeOnRemotes';

const config = ConfigManager.getNetworkConfig();

// todo find better command, this kind of hard kills it.
executeOnRemotesFromCliArgs(`rm ~/${config.installDir}/diamond-node.log`);
