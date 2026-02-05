
import fs from "fs";
import { NodeManager } from "../net/nodeManager";
import { ConfigManager } from "../configManager";
import { cmd } from "../remoteCommand";


// a local Network checkpoint IO is a caching system that provides a flexible way
// to speed up local tests, 
// by reusing states (keys, stateDB) and so on.
// DO NOT USE this, if the network is already running.
export class LocalNetworkCheckpointIo {

    public constructor(public networkName: string, public additionalIdentifier: string) {

    }


    public ensureCacheDirectory(): string {
        // Logic to create cache directory for the network
        const path = this.getCacheDirectory();
        fs.mkdirSync(path, { recursive: true });
        return path;
    }

    public cacheExists(): boolean {
        const cacheDirectory = this.getCacheDirectory();
        return fs.existsSync(cacheDirectory) && fs.readdirSync(cacheDirectory).length > 0;
     }


    public getCacheDirectory(): string { 
        return process.cwd() + "/testnet/cached/" + this.networkName + "/" + this.additionalIdentifier.replace(" ", "_");
    }

    public async saveCurrentNetwork() {
        
        let sourceDirectory = ConfigManager.getNodesDirAbsolut(this.networkName);
        // store all files in the cache directory
        let targetDirectory = this.ensureCacheDirectory();
        console.log("creating backup of the network state in  ", targetDirectory);

        this.copyDirectoryRecursive(sourceDirectory, targetDirectory);
        // Copy all files from sourceDirectory to targetDirectory
        
    }

    public restoreNetworkFromState() : boolean {

        if (!this.cacheExists()) return false;

    
        let manager = NodeManager.get(this.networkName);


        if (manager.localNetworkExists()) {
            throw new Error(this.networkName + " already exists. Cannot restore network state from cache.");
        }

        let sourceDirectory = this.getCacheDirectory() + "/" + ConfigManager.getNodesDir(this.networkName) + "/*";
        let targetDirectory = ConfigManager.getNodesDirAbsolut(this.networkName);
        this.copyDirectoryRecursive(sourceDirectory, targetDirectory);
        manager.initFromTestnetManifest();
        return true;
        
        // Logic to restore network state from cache
    }

    public copyDirectoryRecursive(sourceDirectory: string, targetDirectory: string) {

        cmd(`mkdir -p ${targetDirectory}`);
        cmd(`cp -r ${sourceDirectory} ${targetDirectory}`);
    }
}