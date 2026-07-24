require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "GROQ_API_KEY";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const htmlFilePath = path.join(__dirname, "random.html");

// Collect request body
function collectBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", () => { resolve(body); });
        req.on("error", (err) => { reject(err); });
    });
}

// Send request to Groq API using fetch()
async function getAIResponse(userPrompt) {
    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errorData}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response from AI.");
    }

    return data.choices[0].message.content;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {

    // GET / - serve HTML page
    if (req.method === "GET" && req.url === "/") {
        try {
            let html = fs.readFileSync(htmlFilePath, "utf-8");
            html = html.replace("__RESULT__", "");
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error reading HTML file.");
        }
        return;
    }

    // POST /ai - process prompt
    if (req.method === "POST" && req.url === "/ai") {
        try {
            const body = await collectBody(req);
            const params = new URLSearchParams(body);
            const userPrompt = params.get("prompt");

            if (!userPrompt || userPrompt.trim() === "") {
                let html = fs.readFileSync(htmlFilePath, "utf-8");
                html = html.replace("__RESULT__", "<p style='color:red;'>Please enter a prompt.</p>");
                res.writeHead(400, { "Content-Type": "text/html" });
                res.end(html);
                return;
            }

            const aiText = await getAIResponse(userPrompt.trim());

            let html = fs.readFileSync(htmlFilePath, "utf-8");
            html = html.replace("__RESULT__", `<h2>AI Response:</h2><p>${aiText}</p>`);
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
        } catch (err) {
            console.error("Error:", err.message);
            let html = fs.readFileSync(htmlFilePath, "utf-8");
            html = html.replace("__RESULT__", `<p style='color:red;'>Error: ${err.message}</p>`);
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end(html);
        }
        return;
    }

    // 404 error handling
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
