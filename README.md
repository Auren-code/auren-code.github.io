# D&D Sidekicks

Minimal collaborative character manager using Node.js, Express, Socket.IO and SQLite.

Run locally:

1. Install dependencies

```bash
npm install
```

2. Start server

```bash
npm start
```

3. Open http://localhost:3000 in multiple browsers to collaborate in real time.

Features:
- Create / edit / delete characters
- Persistent storage in `data.db`
- Real-time sync across clients via Socket.IO
- Ability scores, computed modifiers, skills with proficiency

Notes:
- This version uses a simple JSON file (`data.json`) for persistence to avoid native build requirements on Windows.
- If you prefer SQLite with native bindings, install Visual Studio Build Tools with the "Desktop development with C++" workload, then re-add `better-sqlite3` and run `npm install`.

Hosting frontend on GitHub Pages with a local backend
---------------------------------------------------

You can serve the static frontend from GitHub Pages while running the Node backend on your PC and exposing it temporarily to the internet (for collaboration). A simple approach uses `ngrok` to create a public HTTPS URL that tunnels to your local `npm start` server.

1. Run the backend locally:

```bash
cd "F:\Jason\Coding Projects\DnD_Sidekicks"
npm install
npm start
```

2. Start an ngrok tunnel to port 3000 (or your chosen port):

```bash
ngrok http 3000
```

Note the HTTPS forwarding URL from ngrok, e.g. `https://abcd-12-34-56.ngrok.io`.

3. Host the `public` folder on GitHub Pages (option A) or manually upload it. When people open the GitHub Pages URL, add the `api_base` query parameter pointing to your ngrok URL, for example:

```
https://your-gh-username.github.io/dnd-sidekicks/?api_base=https://abcd-12-34-56.ngrok.io
```

The frontend will detect `api_base` and connect to your local backend (HTTP API + Socket.IO) through the tunnel. CORS is already enabled on the server.

Security notes:
- Exposing your local machine to the internet has risks. Only run the tunnel while you intend to collaborate, and stop ngrok when finished.
- Consider restricting access (ngrok has basic auth and access controls) if needed.

Alternative: deploy the backend to a cloud host (Render/Fly/Railway) and point the GitHub Pages frontend at that URL for a longer-term public deployment.
