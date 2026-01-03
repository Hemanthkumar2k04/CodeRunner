# Socket.io API

## Connection

Client connects to `http://server:3000` via Socket.io.

## Events

### Client → Server

#### `run`

Execute code with session tracking.

```json
{
  "sessionId": "1767438075576-vq74dghil",
  "language": "python",
  "files": [
    {
      "name": "main.py",
      "path": "main.py",
      "content": "print('Hello')",
      "toBeExec": true
    }
  ]
}
```

#### `stop`

Stop execution for a specific console.

```json
{
  "sessionId": "1767438075576-vq74dghil"
}
```

#### `input`

Send stdin to running process.

```json
"user input here\n"
```

### Server → Client

#### `output`

Output from stdout/stderr/system.

```json
{
  "sessionId": "1767438075576-vq74dghil",
  "type": "stdout|stderr|system",
  "data": "output text"
}
```

#### `exit`

Process exited with code.

```json
{
  "sessionId": "1767438075576-vq74dghil",
  "code": 0
}
```

#### `error`

Execution error (optional sessionId).

```json
{
  "sessionId": "1767438075576-vq74dghil",
  "message": "Container error"
}
```
