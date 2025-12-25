# API Documentation

## Base URL

`http://localhost:3000`

## Endpoints

### 1. Execute Code

Executes a multi-file project in a secure, isolated environment.

- **URL**: `/run`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### Request Body

| Field      | Type          | Required | Description                                                            |
| ---------- | ------------- | -------- | ---------------------------------------------------------------------- |
| `language` | `string`      | Yes      | The programming language ID. Supported: `python`, `cpp`, `javascript`. |
| `files`    | `Array<File>` | Yes      | List of files to execute.                                              |

**File Object Structure:**

```json
{
  "name": "filename.ext",
  "content": "source code content",
  "toBeExec": true // Optional: Set to true for the entry point file (e.g., main.py)
}
```

#### Example Request

```json
{
  "language": "python",
  "files": [
    {
      "name": "main.py",
      "content": "from utils import add\nprint(add(5, 3))",
      "toBeExec": true
    },
    {
      "name": "utils.py",
      "content": "def add(a, b):\n    return a + b"
    }
  ]
}
```

#### Success Response (200 OK)

```json
{
  "stdout": "8\n",
  "stderr": "",
  "exitCode": 0
}
```

#### Error Response (400 Bad Request)

```json
{
  "error": "Invalid request body. 'language' and 'files' are required."
}
```

#### Error Response (500 Internal Server Error)

```json
{
  "error": "Execution failed due to system error."
}
```

### 2. Health Check

Checks if the server is running.

- **URL**: `/health`
- **Method**: `GET`

#### Success Response (200 OK)

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```
