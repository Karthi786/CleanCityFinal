require('dotenv').config();

const url = `${process.env.SUPABASE_URL}/rest/v1/`;
const key = process.env.SUPABASE_SERVICE_KEY;

async function inspectOpenAPIRPC() {
    try {
        console.log("Fetching OpenAPI spec to look for RPCs...");
        const response = await fetch(url, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status);
            return;
        }

        const data = await response.json();
        console.log("Paths found in OpenAPI definition:");
        const paths = Object.keys(data.paths || {});
        const rpcPaths = paths.filter(p => p.startsWith('/rpc/'));
        if (rpcPaths.length > 0) {
            console.log("RPC Paths:\n", rpcPaths.join("\n"));
        } else {
            console.log("No RPC paths found.");
        }
    } catch (err) {
        console.error("Error fetching OpenAPI:", err);
    }
}

inspectOpenAPIRPC();
