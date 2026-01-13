# API Reference

## WebSocket Events

CodeRunner uses Socket.IO for real-time communication.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `run` | `{ files, entryFile, language, sessionId }` | Execute code |
| `stop` | `{ sessionId }` | Stop running execution |
| `input` | `{ sessionId, input }` | Send stdin input |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `stdout` | `{ sessionId, data }` | Standard output chunk |
| `stderr` | `{ sessionId, data }` | Standard error chunk |
| `exit` | `{ sessionId, code, executionTime }` | Execution completed |
| `error` | `{ sessionId, message }` | Execution error |

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/api/network-stats` | Docker network statistics |

## Example: Run Code

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.emit('run', {
  files: [{ path: 'main.py', content: 'print("Hello")' }],
  entryFile: 'main.py',
  language: 'python',
  sessionId: 'unique-session-id'
});

socket.on('stdout', ({ data }) => console.log(data));
socket.on('exit', ({ code, executionTime }) => {
  console.log(`Exited with code ${code} in ${executionTime}ms`);
});
```

## Supported Languages

| Language | File Extensions | Runtime Image |
|----------|----------------|---------------|
| Python | `.py` | `python-runtime` |
| JavaScript | `.js`, `.mjs` | `node-runtime` |
| Java | `.java` | `java-runtime` |
| C++ | `.cpp`, `.cc`, `.cxx` | `cpp-runtime` |
| SQL | `.sql` | `mysql-runtime` |
