import { PleskClient, getPleskSettings } from "./pleskClient";


/// checks the Plesk settings of the DNS sync without changing anything on the server.
async function run() {

    const settings = getPleskSettings();
    const client = new PleskClient(settings);

    console.log(`checking Plesk API at ${settings.url}`);

    const server = await client.getServerInfo();
    console.log(`✅ API key accepted, Plesk ${server?.panel_version ?? 'unknown version'} on ${server?.hostname ?? 'unknown host'}`);

    const domains = Array.from(new Set([settings.zone, settings.mailDomain]));

    for (const name of domains) {
        const domain = await client.findDomain(name);

        if (!domain) {
            throw new Error(`domain ${name} not found on the Plesk server or not visible for this API key`);
        }

        console.log(`✅ domain ${name} found (id ${domain.id})`);
    }

    const zone = await client.callCli('dns', ['--info', settings.zone]);
    if (zone.code != 0) {
        throw new Error(`plesk dns --info ${settings.zone} failed with code ${zone.code}: ${(zone.stderr || zone.stdout).trim()}`);
    }

    console.log(`✅ CLI gateway works, zone ${settings.zone} has ${zone.stdout.trim().split('\n').length} lines of records`);

    const mail = await client.callCli('mail', ['--help']);
    console.log(mail.code == 0
        ? '✅ mail utility is available'
        : `⚠️ mail utility returned code ${mail.code}: ${(mail.stderr || mail.stdout).trim()}`);
}

run().catch((err) => {
    console.log("error!!:");
    console.log(err);
    process.exit(1);
});
