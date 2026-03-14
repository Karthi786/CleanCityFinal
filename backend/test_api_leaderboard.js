async function check() {
    try {
        let token;
        // Try login
        let authRes = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'citizen1@test.com', password: 'password123' })
        });
        
        let authData = await authRes.json();
        token = authData.token;

        if (!token) {
            // Register dummy
            let regRes = await fetch('http://localhost:5001/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Test Citizen ' + Date.now(),
                    email: `citizentest${Date.now()}@test.com`,
                    password: 'password123',
                    role: 'CITIZEN'
                })
            });
            let regData = await regRes.json();
            if (regData.error) throw new Error(regData.error);
            token = regData.token;
        }

        console.log("Got token:", token.substring(0, 10) + "...");
        let lbRes = await fetch('http://localhost:5001/api/leaderboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        let lbData = await lbRes.text();
        console.log("Leaderboard status:", lbRes.status);
        console.log("Leaderboard data:", lbData);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
check();
