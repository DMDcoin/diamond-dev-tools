import { ConfigManager } from "./configManager";
import { ContractManager } from "./contractManager";
import { NodeManager } from "./net/nodeManager";
import { LogToHtmlAdapter } from "./server/LogToHtmlAdapter";
import { sleep } from "./utils/time";
import { Watchdog } from "./watchdog";
import express from 'express';

async function startWatchdogServer() {

    console.log(`inistializing watchdog server`);

    const log = console.log;
    // console.log = (...args: any[]) => {
    //     const message = args.join(' ');
    //     logs.push(message);
    //   };


    const web3 = ConfigManager.getWeb3();
    const nodeManager = NodeManager.get();
    const contractManager = new ContractManager(web3);
    const watchdog = new Watchdog(contractManager, nodeManager);

    //log("starting watchdog");

    const logAdapter = new LogToHtmlAdapter(true, "watchdog.html");
    logAdapter.inject();
    watchdog.startWatching(true);

    const app = express();


    app.get('/', (req, res) => {
        // res.json(logs);
        //res.write(logs.join("\n"));
        //log(logs);

        let doc = logAdapter.getLogsAsHTMLDocument(1000);
        res.send(doc);
    });


    app.get('/full', (req, res) => {
        // res.json(logs);
        //res.write(logs.join("\n"));    
        res.send(logAdapter.getLogsAsHTMLDocument(undefined));
    });


    app.get('/latest/*', (req, res) => {

        let fullpath = req.path.split('/');
        
        log("fullpath:", fullpath);

        
        let last = fullpath[fullpath.length - 1];
        let num = parseInt(last);

        if (isNaN(num) || num <= 0) {
            res.send("invalid number specified: use pattern /latest/123" );
            return;
        }

        // res.json(logs);
        //res.write(logs.join("\n"));    
        res.send(logAdapter.getLogsAsHTMLDocument(num));
    });

    app.on('error', (err) => {
        console.error('Server error:', err);
    });

    app.on('close', () => {
        console.log('Server closed');
    });


    const port = 8000;
    app.listen(port, () => {
        log(`Server is running at http://localhost:${port}`);
    });

    log("Server initialized.");
}



startWatchdogServer().then(() => {
    console.log("watchdog server stopped.");
});

