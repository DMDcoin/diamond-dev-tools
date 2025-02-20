import request from "request";
import Web3 from "web3";
import { Transaction } from "web3-core";


export async function getPendingTransactions(web3: Web3) : Promise<Array<Transaction>> {



    const fn = "parity_pendingTransactions";
    const result = sendRPCCall(web3, fn, []);

    return [];
    // "parity_pendingTransactions"
}

export async function getPendingTransactionsStats(web3: Web3) {
    sendRPCCall(web3, "parity_pendingTransactionsStats", []);
}

export async function sendRPCCall(web3: Web3, method: string, params: []) {

    var headersOpt = {
        "content-type": "application/json",
    };               

    const address = "https://beta-rpc.bit.diamonds";
    

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

    post.on("response", async (r) => {
        const result = r.read();
        //console.log(result);
    });

    const data = await post.on("data", async (d) => {
        console.log("data");

        const buffer = d as Buffer;


        if (buffer) {
            
            console.log(buffer.toString('utf8'));
        }
        // console.log(d);
    });

}
