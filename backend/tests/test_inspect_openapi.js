require('dotenv').config();

const url = `${process.env.SUPABASE_URL}/rest/v1/`;
const key = process.env.SUPABASE_SERVICE_KEY;

async function inspectOpenAPI() {
    try {
        console.log("Fetching schema definition from PostgREST...");
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
        console.log("Tables found in OpenAPI definition:");
        const definitions = data.definitions || {};
        for (const tableName of Object.keys(definitions)) {
            console.log(`\nTable: ${tableName}`);
            const properties = definitions[tableName].properties || {};
            console.log("Columns:", Object.keys(properties).join(", "));
        }
    } catch (err) {
        console.error("Error fetching OpenAPI:", err);
    }
}

inspectOpenAPI();
