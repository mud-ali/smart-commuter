const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(cors()); // Allows your Next.js app on port 3000 to talk to this server
const PORT = 8080;

const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credweb.json");

// 1. Initialize OAuth2 Client
async function getOAuthClient() {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const { client_id, client_secret, redirect_uris } = keys.web || keys.installed;
    return new google.auth.OAuth2(client_id, client_secret, "http://localhost:8080/oauth2callback");
}

// --- ROUTES ---

const { Client } = require("@googlemaps/google-maps-services-js");

const mapsClient = new Client({});
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
app.get("/directions", async (req, res) => {
    const { origin, destination, departureTime } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination required" });
    }

    // Convert ISO string to Unix timestamp (seconds)
    const depTimestamp = Math.floor(new Date(departureTime).getTime() / 1000);

    try {
        const response = await mapsClient.directions({
            params: {
                origin,
                destination,
                mode: "transit",
                alternatives: true, // This gives us multiple route options
                departure_time: depTimestamp,
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });

        const routes = response.data.routes.map((route) => {
            const leg = route.legs[0];
            return {
                durationText: leg.duration.text,
                durationValue: leg.duration.value,
                arrivalTime: leg.arrival_time.text,
                departureTime: leg.departure_time.text,
                arrivalTimestamp: leg.arrival_time.value,
                departureTimestamp: leg.departure_time.value, // Unix timestamp in seconds
                steps: leg.steps
                    .filter((s) => s.travel_mode === "TRANSIT")
                    .map((s) => ({
                        line: s.transit_details.line.short_name || s.transit_details.line.name,
                        type: s.transit_details.line.vehicle.type,
                    })),
            };
        });

        routes.sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);


        res.json(routes);
    } catch (err) {
        console.error("Directions Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Transit lookup failed" });
    }
});

app.use(express.static('../frontend/.next'));

app.get("/traffic", async (req, res) => {
    try {
        const response = await mapsClient.distancematrix({
            params: {
                origins: ["Times Square, NY"], // Replace with your work address
                destinations: ["Brooklyn Bridge, NY"], // Replace with your home address
                departure_time: "now",
                key: GOOGLE_MAPS_API_KEY,
            },
            timeout: 1000, // milliseconds
        });

        const data = response.data.rows[0].elements[0];

        // Check if data is valid
        if (data.status !== "OK") {
            throw new Error(`Maps API returned status: ${data.status}`);
        }

        const durationTypical = data.duration.value; // in seconds
        const durationTraffic = data.duration_in_traffic.value; // in seconds

        res.json({
            typicalTime: data.duration.text,
            currentTrafficTime: data.duration_in_traffic.text,
            delayMinutes: Math.max(0, (durationTraffic - durationTypical) / 60),
        });
    } catch (err) {
        console.error("Traffic API Error:", err.message);
        res.status(500).json({ error: "Failed to fetch traffic data" });
    }
});

// A. Start the Auth Flow
app.get("/auth", async (req, res) => {
    const oauth2Client = await getOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline", // Gets refresh_token
        scope: ["https://www.googleapis.com/auth/calendar.readonly"],
        // prompt: 'consent' // Forces refresh_token on every login for testing
    });
    res.redirect(authUrl);
});

// B. The Callback (Google sends the code here)
app.get("/oauth2callback", async (req, res) => {
    const { code } = req.query;
    const oauth2Client = await getOAuthClient();

    try {
        const { tokens } = await oauth2Client.getToken(code);
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        // Redirect user back to your Next.js frontend
        res.redirect("http://localhost:3000?auth=success");
    } catch (err) {
        res.status(500).send("Authentication failed");
    }
});

// C. The Data Endpoint
app.get("/schedule", async (req, res) => {
    const { date } = req.query; // Expects YYYY-MM-DD
    const targetDate = date ? new Date(date) : new Date();

    try {
        const oauth2Client = await getOAuthClient();
        const token = await fs.readFile(TOKEN_PATH);
        oauth2Client.setCredentials(JSON.parse(token));

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        // Find "Schedule" Calendar
        const list = await calendar.calendarList.list();
        const scheduleCal = list.data.items.find((c) => c.summary.includes("mma264"));

        if (!scheduleCal) return res.status(404).json({ error: "Schedule calendar not found" });

        const start = new Date(targetDate).setHours(0, 0, 0, 0);
        const end = new Date(targetDate).setHours(23, 59, 59, 999);

        const events = await calendar.events.list({
            calendarId: scheduleCal.id,
            timeMin: new Date(start).toISOString(),
            timeMax: new Date(end).toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        });

        if (!events.data.items.length) return res.json({ message: "Empty day" });

        const items = events.data.items;
        const firstStart = items[0].start.dateTime || items[0].start.date;

        // Find max end time (handles overlapping)
        const lastEnd = items.reduce((latest, ev) => {
            const evEnd = new Date(ev.end.dateTime || ev.end.date).getTime();
            return evEnd > latest ? evEnd : latest;
        }, 0);

        res.json({
            date: targetDate.toDateString(),
            firstStart,
            lastEnd: new Date(lastEnd).toISOString(),
        });
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: "Not authenticated or API error" });
    }
});

// app.get('/traffic', async (req, res) => {
//     try {
//         const oauth2Client = await getOAuthClient();
//         const token = await fs.readFile(TOKEN_PATH);
//         oauth2Client.setCredentials(JSON.parse(token));

//         // Use the Google Maps Distance Matrix API
//         // Note: This uses the same API Key or OAuth client
//         const maps = google.distanceMatrix({ version: 'v1', auth: oauth2Client });

//         // Example addresses - Replace with yours or pass via query params
//         const origin = 'Times Square, NY';
//         const destination = 'Brooklyn Bridge, NY';

//         const response = await google.maps({version: 'v1', auth: oauth2Client}).distancematrix.list({
//             origins: [origin],
//             destinations: [destination],
//             departure_time: 'now', // Crucial for live traffic data
//             traffic_model: 'best_guess'
//         });

//         const data = response.data.rows[0].elements[0];

//         res.json({
//             origin,
//             destination,
//             typicalTime: data.duration.text,
//             currentTrafficTime: data.duration_in_traffic.text,
//             delayMinutes: Math.max(0, (data.duration_in_traffic.value - data.duration.value) / 60)
//         });
//     } catch (err) {
//         res.status(500).json({ error: 'Maps API error', details: err.message });
//     }
// });

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
