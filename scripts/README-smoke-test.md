Run the smoke test

From the repository root run:

```bash
node scripts/smoke-test.js feature/milestone-2-tasks
```

This will:

- checkout the branch (if provided)
- build backend and frontend
- start both servers
- probe `http://localhost:3001/health` and `http://localhost:3000/`
- shut servers down and exit with code 0 on success

Notes:

- The script spawns real servers and expects ports 3000/3001 to be free.
- For CI usage you may prefer to adapt the script to run in a container or use ephemeral ports.
