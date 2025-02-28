import request from "request";
import Web3 from "web3";
import { Transaction } from "web3-core";
import { sleep } from "../utils/time";


export async function getPendingTransactions(web3: Web3) : Promise<Array<Transaction>> {

    const fn = "parity_pendingTransactions";
    const result = await sendRPCCall(web3, fn, []);

    // console.log("pending: ", result.length);
    
    // console.log("END: pending: ", result.length);

    
    // for (let i = 0; i < result.length; i++) {
    //     const element = result[i];
    //     //console.log("pending: ", element);
    // }

    //const mapped = result.map(x => { x as Transaction });

    return result as Array<Transaction>;
    // "parity_pendingTransactions"
}

export async function getPendingTransactionsStats(web3: Web3) {
    return sendRPCCall(web3, "parity_pendingTransactionsStats", []);
}

// function appendBuffer(source: Buffer, target: Buffer) {
//     for (let i = 0; i < source.length; i++) {
//         target.writeInt8(source.readInt8(i), target.length + 1);
//     }
// }

export async function sendRPCCall(web3: Web3, method: string, params: []) : Promise<any> {

    var headersOpt = {
        "content-type": "application/json",
    };               

    const address = "https://beta-rpc.bit.diamonds";
    //const address = "http://38.242.206.143:54100";

    let rpc_cmd =
    {
      method: method,
      params: params,
      jsonrpc: "2.0",
      id: Math.round(Math.random() * 100000)
    }

    

    const post = request.post(
        address, // todo: distribute transactions here to different nodes.
        {
            json: rpc_cmd,
            headers: headersOpt
        },
        function (error, response, body) {
            if (error) {
                //Trying to close the socket (to prevent socket hang up errors)
                //**Doesn't help**
                console.log('got error:', error);
                return;
            }
            if (response) {
                // console.log('got reponse:', response.statusCode);
                // console.log('got reponse body:', response.body);
            }


        });

    let ended = false;

    post.on("end", async () => {
        console.log("end");
        ended = true;
    });


    let responseBuffer: Buffer = Buffer.alloc(0);

    post.on("data", async (d) => {
       
        let buffer = d as Buffer;

        if (buffer) {
            // responseBuffer = Buffer.concat(responseBuffer, buffer);
            //appendBuffer(buffer, responseBuffer);
            responseBuffer = Buffer.concat([responseBuffer, buffer]);
        }
        
        // console.log(d);
    });

    while (!ended) {
        await sleep(50);
    }

    if (responseBuffer) {
        
        const resultJson = responseBuffer.toString('utf8');
        // console.log(resultJson);
        const parsed = JSON.parse(resultJson);
        return parsed.result;
    }

    return [];
}
