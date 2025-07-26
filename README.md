# burn-surge-ops

# Installation Instructions

### Frontend

1. ```shell
   cd frontend
   ```

2. Install dependencies

    ```shell
    npm i
    ```

3. To run http-server
    ```shell
    npm start
    ```

### Backend

1. ```shell
   cd backend
   ```

2. Create Python virtual environment

    ```shell
    python3 -m venv .venv
    ```

3. Activate Python virtual environment

    ```shell
    source .venv/bin/activate
    ```

4. Install dependencies

    ```shell
    pip install -r requirements.txt
    ```

5. To run FastAPI backend
    ```shell
    fastapi dev main.py
    ```
